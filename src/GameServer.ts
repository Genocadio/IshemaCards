import { WebSocket, Server as WebSocketServer } from 'ws';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { 
  Match, 
  Player, 
  Card,
  MessageType,
  MessageBuilder,
  PlayerInfo,
  TeamInfo,
  MatchSummary,
  GameState,
  MatchStatus,
  PayloadPlayedCard,
  PlayedCard as InternalPlayedCard,
  PlayerJoinedPayload,
  CardPlayedPayload,
  RoundCompletedPayload,
  TurnChangedPayload,
  MatchStartedPayload,
  PlayerDisconnectedPayload,
  MatchPausedPayload,
  MatchResumedPayload,
  ReconnectionSuccessfulPayload,
  PlayerExitedPayload,
  MatchCancelledPayload
} from './types';
import { RoundEvaluator, PlayerMove } from './lib/RoundEvaluator';
import { DeckService } from './services/DeckService';
import { PlayerService } from './services/PlayerService';
import { NotificationService } from './services/NotificationService';

// Extend WebSocket to include our custom properties
interface GameWebSocket extends WebSocket {
  playerId?: string;
  matchId?: string;
  inviteCode?: string;
}

export class GameServer {
  private matches = new Map<string, Match>();
  private inviteCodes = new Map<string, { matchId: string, teamId: 'team1' | 'team2'}>();
  private activePlayers = new Set<string>(); // Track active playerIds across all matches
  private wss: WebSocketServer;
  private httpServer: HttpServer;
  private roundEvaluators = new Map<string, RoundEvaluator>(); // Track evaluator per match

  private deckService: DeckService;
  private playerService: PlayerService;
  private notificationService: NotificationService;

  // Disconnection handling with delay
  private disconnectionTimers = new Map<string, NodeJS.Timeout>();
  private reconnectionCounters = new Map<string, number>();
  
  // Persistence
  private readonly PERSISTENCE_FILE = path.join(process.cwd(), 'invite-codes.json');

  constructor(port: number = 8080) {
    this.httpServer = createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.deckService = new DeckService();
    this.playerService = new PlayerService();
    this.notificationService = new NotificationService();
    
    // Load persisted invite codes on startup
    this.loadInviteCodes();
    
    this.wss.on('connection', (ws: GameWebSocket, req: IncomingMessage) => {
      // Keepalive: mark alive and handle pongs
      (ws as any).isAlive = true;
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });
      console.log('New WebSocket connection attempt');
      
      // Extract connection info from URL path and query parameters
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // Expect URL format: ws://host:port/invite/{inviteCode}?playerId=optional&name=optional
      if (pathParts[0] !== 'invite' || !pathParts[1]) {
        console.log('Connection rejected: Invalid URL format.', { url: req.url });
        ws.close(1008, 'Invalid connection URL. Use: /invite/{inviteCode}');
        return;
      }

      const inviteCode = pathParts[1];
      const providedPlayerId = url.searchParams.get('playerId');
      const providedName = url.searchParams.get('name');

      console.log('Connection attempt:', { 
        inviteCode, 
        providedPlayerId,
        providedName
      });

      // Validate invite code
      const joinInfo = this.inviteCodes.get(inviteCode);
      if (!joinInfo) {
        console.log('Connection rejected: Invalid or expired invite code.', { 
          inviteCode,
          totalInviteCodes: this.inviteCodes.size,
          availableInviteCodes: Array.from(this.inviteCodes.keys()),
          totalMatches: this.matches.size,
          matchIds: Array.from(this.matches.keys())
        });
        ws.close(1008, 'Invalid or expired invite code');
        return;
      }
      
      const { matchId, teamId } = joinInfo;
      const match = this.matches.get(matchId);
      if (!match) {
        console.log('Connection rejected: Match no longer exists.', { matchId, inviteCode });
        ws.close(1008, 'Match no longer exists');
        return;
      }

      // Store connection info
      ws.matchId = matchId;
      ws.inviteCode = inviteCode;

      // Handle player connection - this will auto-generate ID/name if needed
      const connectionResult = this.handlePlayerConnection(ws, match, teamId, providedPlayerId, providedName);
      
      if (!connectionResult.success) {
        console.log('Connection rejected:', { 
          reason: connectionResult.error,
          matchId,
          teamId,
          providedPlayerId,
          inviteCode
        });
        ws.close(1008, connectionResult.error);
        return;
      }

      // Set up message handlers
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received message:', { type: message.type, from: ws.playerId });
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing message:', error);
          const errorMessage = MessageBuilder.createError('INVALID_MESSAGE', 'Invalid message format');
          ws.send(JSON.stringify(errorMessage));
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Periodic ping for keepalive and dead connection detection
    const pingIntervalMs = 30000;
    const pingInterval = setInterval(() => {
      this.wss.clients.forEach((client: any) => {
        if (client.isAlive === false) {
          try { client.terminate(); } catch {}
          return;
        }
        client.isAlive = false;
        try { client.ping(); } catch {}
      });
    }, pingIntervalMs);
    this.wss.on('close', () => clearInterval(pingInterval));

    this.httpServer.listen(port, () => {
      console.log(`Game server running on port ${port}`);
      console.log(`WebSocket connections: ws://localhost:${port}/invite/{inviteCode}`);
    });
  }

  // Persistence methods
  private loadInviteCodes(): void {
    try {
      if (fs.existsSync(this.PERSISTENCE_FILE)) {
        const data = fs.readFileSync(this.PERSISTENCE_FILE, 'utf8');
        const persistedData = JSON.parse(data);
        
        // Restore invite codes
        if (persistedData.inviteCodes) {
          for (const [code, info] of Object.entries(persistedData.inviteCodes)) {
            this.inviteCodes.set(code, info as { matchId: string, teamId: 'team1' | 'team2'});
          }
        }
        
        console.log(`Loaded ${this.inviteCodes.size} invite codes from persistence file`);
      } else {
        console.log('No persistence file found, starting with empty invite codes');
      }
    } catch (error) {
      console.error('Error loading invite codes from persistence file:', error);
    }
  }

  private saveInviteCodes(): void {
    try {
      const data = {
        inviteCodes: Object.fromEntries(this.inviteCodes),
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(this.PERSISTENCE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving invite codes to persistence file:', error);
    }
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/create-match') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { teamSize = 2 } = JSON.parse(body);
          this.handleCreateMatchHttp(req, res, Number(teamSize));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      // Health check endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        stats: this.getMatchStats(),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  }

  private handleCreateMatchHttp(req: IncomingMessage, res: ServerResponse, teamSize: number) {
    // Validate team size
    if (teamSize < 1 || teamSize > 3) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Team size must be between 1 and 3' }));
      return;
    }

    const matchId = uuidv4();
    // Generate shorter, more user-friendly invite codes
    const team1InviteCode = this.generateInviteCode();
    const team2InviteCode = this.generateInviteCode();

    const match: Match = {
      id: matchId,
      players: new Map(),
      teamSize,
      status: 'waiting',
      playground: [],
      roundWins: { team1: 0, team2: 0 },
      teamScores: { team1: 0, team2: 0 },
      trumpSuit: 'Spades',  // Will be set when match starts
      createdAt: new Date(),
      inviteCodes: {
        team1: team1InviteCode,
        team2: team2InviteCode
      }
    };

    this.matches.set(matchId, match);
    this.inviteCodes.set(team1InviteCode, { matchId, teamId: 'team1' });
    this.inviteCodes.set(team2InviteCode, { matchId, teamId: 'team2' });
    
    // Persist invite codes
    this.saveInviteCodes();

    const addressInfo = this.httpServer.address();
    const localPort = addressInfo && typeof addressInfo === 'object' ? (addressInfo as any).port : 8080;
    // Build external host and protocol from forwarded headers when behind proxy (e.g., Render)
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || undefined;
    const forwardedHost = (req.headers['x-forwarded-host'] as string) || undefined;
    const hostHeader = req.headers.host || `localhost:${localPort}`;
    const externalProto = forwardedProto || (hostHeader.toString().startsWith('localhost') ? 'ws' : 'ws');
    const externalHost = forwardedHost || hostHeader;
    const wsScheme = externalProto === 'https' ? 'wss' : (externalProto === 'http' ? 'ws' : externalProto);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      matchId,
      teamSize,
      team1: {
        inviteCode: team1InviteCode,
        wsUrl: `${wsScheme}://${externalHost}/invite/${team1InviteCode}`,
        joinUrl: `${wsScheme}://${externalHost}/invite/${team1InviteCode}?name=YourName`
      },
      team2: {
        inviteCode: team2InviteCode,
        wsUrl: `${wsScheme}://${externalHost}/invite/${team2InviteCode}`,
        joinUrl: `${wsScheme}://${externalHost}/invite/${team2InviteCode}?name=YourName`
      },
      info: {
        message: 'Share the appropriate team invite URL with players',
        optionalParams: 'Add ?playerId=yourId&name=yourName to reconnect with existing identity'
      }
    }));

    console.log(`Match ${matchId} created with team size ${teamSize}`);
    console.log(`Team 1 invite: ${team1InviteCode}`);
    console.log(`Team 2 invite: ${team2InviteCode}`);
    console.log(`Total invite codes now: ${this.inviteCodes.size}`);
    console.log(`Available invite codes: ${Array.from(this.inviteCodes.keys()).join(', ')}`);
  }

  private generateInviteCode(): string {
    // Generate a more user-friendly invite code (6 characters, alphanumeric)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.inviteCodes.has(result)) {
      return this.generateInviteCode();
    }
    
    return result;
  }

  private handlePlayerConnection(
    ws: GameWebSocket, 
    match: Match, 
    teamId: 'team1' | 'team2', 
    providedPlayerId?: string | null, 
    providedName?: string | null
  ): { success: boolean; error?: string; playerId?: string } {
    
    // Check if this is a reconnection attempt
    const existingPlayer = providedPlayerId ? match.players.get(providedPlayerId) : null;
    
    if (existingPlayer) {
      return this.handlePlayerReconnection(ws, match, existingPlayer);
    }

    // New player joining
    if (match.status !== 'waiting') {
      return { success: false, error: 'Match is not accepting new players' };
    }

    // Check if the team is full
    const teamPlayers = Array.from(match.players.values()).filter(p => p.teamId === teamId);
    if (teamPlayers.length >= match.teamSize) {
      return { success: false, error: 'This team is full' };
    }

    // Auto-generate player ID and name if not provided
    const playerId = providedPlayerId || this.playerService.generateAnonymousId();
    const playerName = providedName || this.playerService.generateRandomName();
    
    // Check if playerId is already active in any match
    if (providedPlayerId && this.activePlayers.has(playerId)) {
      // Find if the player is in any match (active or waiting)
      const existingMatch = this.findPlayerMatch(playerId);
      if (existingMatch) {
        // Always prefer the new match - remove player from existing match
        this.removePlayerFromMatch(playerId, existingMatch);
        console.log(`Removed player ${playerId} from existing match ${existingMatch.id} to join new match`);
      }
    }

    // Create new player
    const player: Player = {
      id: playerId,
      name: playerName,
      teamId,
      connected: true,
      hand: [],
      ws,
      anonymousId: playerId.startsWith('anon_') ? playerId : undefined
    };

    // If player was in other waiting matches, remove them
    if (providedPlayerId) {
      this.removePlayerFromWaitingMatches(playerId);
    }

    match.players.set(playerId, player);
    this.activePlayers.add(playerId);
    ws.playerId = playerId;

    console.log('New player joined:', {
      playerId,
      playerName,
      teamId,
      isGenerated: !providedPlayerId || !providedName
    });

    // Send welcome message to the player
    const playerInfo = this.createPlayerInfo(player, match);
    const matchSummary = this.createMatchSummary(match);
    const welcomeMessage = MessageBuilder.createConnectionEstablished(
      playerInfo,
      matchSummary,
      {
        playerId: !providedPlayerId,
        playerName: !providedName
      }
    );
    ws.send(JSON.stringify(welcomeMessage));

    // Notify all players about the new join
    const team1Info = this.createTeamInfo('team1', match);
    const team2Info = this.createTeamInfo('team2', match);

    const playerJoinedPayload: PlayerJoinedPayload = {
      player: playerInfo,
      match: this.createMatchSummary(match),
      teams: {
        team1: team1Info,
        team2: team2Info,
      }
    };
    const playerJoinedMessage = MessageBuilder.createMessage(MessageType.PLAYER_JOINED, playerJoinedPayload);

    this.notificationService.broadcastToMatch(match, playerJoinedMessage);
    
    // Start match if full
    if (match.players.size === match.teamSize * 2) {
      // Build and store the play order
      match.playOrder = this.buildAlternatingPlayOrder(match);
      match.firstPlayerIndex = 0;
      match.turnIndex = 0;
      this.startMatch(match);
    }

    return { success: true, playerId };
  }

  // Helper method to find if a player is in an active/started match
  private findPlayerActiveMatch(playerId: string): Match | null {
    for (const [matchId, match] of this.matches) {
      if (match.players.has(playerId) && match.status !== 'waiting') {
        return match;
      }
    }
    return null;
  }

  // Helper method to find any match a player is in (regardless of status)
  private findPlayerMatch(playerId: string): Match | null {
    for (const [matchId, match] of this.matches) {
      if (match.players.has(playerId)) {
        return match;
      }
    }
    return null;
  }

  // Helper method to remove a player from a specific match
  private removePlayerFromMatch(playerId: string, match: Match): void {
    const player = match.players.get(playerId);
    if (!player) return;

    // Close existing WebSocket connection if connected
    if (player.ws && player.connected) {
      try {
        player.ws.close();
      } catch (error) {
        console.error(`Error closing WebSocket for player ${playerId}:`, error);
      }
    }

    // Remove player from match
    match.players.delete(playerId);
    this.activePlayers.delete(playerId);

    // Clean up disconnection timers and reconnection counters
    const timer = this.disconnectionTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectionTimers.delete(playerId);
    }
    this.reconnectionCounters.delete(playerId);

    // If match becomes empty, clean it up
    if (match.players.size === 0) {
      this.cleanupEmptyMatch(match);
    } else {
      // Notify remaining players about the player leaving
      this.notifyPlayerLeft(match, player);
    }

    console.log(`Player ${playerId} removed from match ${match.id}`);
  }

  // Helper method to clean up an empty match
  private cleanupEmptyMatch(match: Match): void {
    // Clean up invite codes
    if (match.inviteCodes) {
      this.inviteCodes.delete(match.inviteCodes.team1);
      this.inviteCodes.delete(match.inviteCodes.team2);
      this.saveInviteCodes();
    }

    // Clean up round evaluator
    this.roundEvaluators.delete(match.id);

    // Remove match from matches map
    this.matches.delete(match.id);

    console.log(`Cleaned up empty match ${match.id}`);
  }

  // Helper method to notify remaining players about a player leaving
  private notifyPlayerLeft(match: Match, leftPlayer: Player): void {
    const playerInfo = this.createPlayerInfo(leftPlayer, match);
    const matchSummary = this.createMatchSummary(match);

    // Notify remaining players
    Array.from(match.players.values()).forEach(p => {
      if (p.ws && p.connected) {
        const playerLeftPayload = {
          player: playerInfo,
          match: matchSummary,
          reason: 'joined_another_match'
        };
        const playerLeftMessage = MessageBuilder.createMessage(MessageType.PLAYER_LEFT, playerLeftPayload);
        p.ws.send(JSON.stringify(playerLeftMessage));
      }
    });
  }

  // Helper method to remove player from all waiting matches
  private removePlayerFromWaitingMatches(playerId: string): void {
    for (const [matchId, match] of this.matches) {
      if (match.status === 'waiting' && match.players.has(playerId)) {
        this.removePlayerFromMatch(playerId, match);
      }
    }
  }

  private handlePlayerReconnection(
    ws: GameWebSocket, 
    match: Match, 
    existingPlayer: Player
  ): { success: boolean; error?: string; playerId?: string } {
    
    // Clear any pending disconnection timer for this player
    const existingTimer = this.disconnectionTimers.get(existingPlayer.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectionTimers.delete(existingPlayer.id);
      console.log(`Cleared pending disconnection timer for player ${existingPlayer.name} (${existingPlayer.id})`);
    }

    // Increment reconnection counter to prevent race conditions
    const currentCounter = this.reconnectionCounters.get(existingPlayer.id) || 0;
    const newCounter = currentCounter + 1;
    this.reconnectionCounters.set(existingPlayer.id, newCounter);
    
    // Handle existing connection safely: mark old socket to be ignored on close
    if (existingPlayer.connected && existingPlayer.ws) {
      const oldWs: any = existingPlayer.ws;
      oldWs.__ignoreClose = true;
      try { existingPlayer.ws.close(); } catch {}
    }

    // Update player's connection
    existingPlayer.connected = true;
    existingPlayer.ws = ws;
    this.activePlayers.add(existingPlayer.id);
    ws.playerId = existingPlayer.id;

    console.log(`Player reconnected (attempt #${newCounter}):`, {
      playerId: existingPlayer.id,
      playerName: existingPlayer.name,
      teamId: existingPlayer.teamId,
      matchStatus: match.status
    });

    // Calculate current round number
    const currentRoundNumber = match.roundWins.team1 + match.roundWins.team2 + 1;

    // Prepare detailed team information
    const allPlayersList = Array.from(match.players.values());

    const team1Players = allPlayersList.filter(p => p.teamId === 'team1');
    const team2Players = allPlayersList.filter(p => p.teamId === 'team2');

    const team1ConnectedCount = team1Players.filter(p => p.connected).length;
    const team2ConnectedCount = team2Players.filter(p => p.connected).length;
    
    const team1Disconnected = team1Players.filter(p => !p.connected).map(p => p.name);
    const team2Disconnected = team2Players.filter(p => !p.connected).map(p => p.name);

    const team1UnfilledSlots = match.teamSize - team1Players.length;
    const team2UnfilledSlots = match.teamSize - team2Players.length;
    
    const team1MissingCount = team1Disconnected.length + team1UnfilledSlots;
    const team2MissingCount = team2Disconnected.length + team2UnfilledSlots;

    const teamDetails = {
      team1: {
        totalSlots: match.teamSize,
        connectedCount: team1ConnectedCount,
        missingCount: team1MissingCount,
        disconnectedNames: team1Disconnected,
        unfilledSlots: team1UnfilledSlots,
      },
      team2: {
        totalSlots: match.teamSize,
        connectedCount: team2ConnectedCount,
        missingCount: team2MissingCount,
        disconnectedNames: team2Disconnected,
        unfilledSlots: team2UnfilledSlots,
      }
    };

    // Send reconnection confirmation and current state
    const playerInfo = this.createPlayerInfo(existingPlayer, match);
    const matchSummary = this.createMatchSummary(match);
    const gameState = this.createGameState(match, existingPlayer.id);

    const reconnectPayload: ReconnectionSuccessfulPayload = {
      player: playerInfo,
      match: matchSummary,
      gameState: gameState,
    };
    const reconnectMessage = MessageBuilder.createMessage(MessageType.RECONNECTION_SUCCESSFUL, reconnectPayload);
    ws.send(JSON.stringify(reconnectMessage));

    // Notify other players about the reconnection
    const playerReconnectedPayload = {
      player: playerInfo,
      match: matchSummary,
    };
    const playerReconnectedMessage = MessageBuilder.createMessage(MessageType.PLAYER_RECONNECTED, playerReconnectedPayload);
    this.notificationService.broadcastToMatch(match, playerReconnectedMessage, existingPlayer.id);

    // Resume match if all players are connected
    if (match.status === 'paused' && this.allPlayersConnected(match)) {
      match.status = 'active';
      
      const resumingPlayerInfo = this.createPlayerInfo(existingPlayer, match);
      
      Array.from(match.players.values()).forEach(p => {
        if (p.ws && p.connected) {
          const gameState = this.createGameState(match, p.id);
          const resumePayload: MatchResumedPayload = {
            resumedBy: resumingPlayerInfo,
            gameState: gameState
          };
          const resumeMessage = MessageBuilder.createMessage(MessageType.MATCH_RESUMED, resumePayload);
          p.ws.send(JSON.stringify(resumeMessage));
        }
      });

      // Notify the current player it's their turn
      this.notifyTurnChange(match);
    }

    return { success: true, playerId: existingPlayer.id };
  }

  private handleMessage(ws: GameWebSocket, message: any) {
    const { type, payload } = message;

    switch (type) {
      case MessageType.PLAY_CARD_REQUEST:
        this.handlePlayCard(ws, payload);
        break;
      case MessageType.GET_STATE_REQUEST:
        this.handleGetGameState(ws);
        break;
      case MessageType.EXIT_GAME_REQUEST:
        this.handleExitGame(ws, payload);
        break;
      default:
        const errorMessage = MessageBuilder.createError('UNKNOWN_MESSAGE_TYPE', 'Unknown message type');
        ws.send(JSON.stringify(errorMessage));
    }
  }

  private handleGetGameState(ws: GameWebSocket) {
    const matchId = ws.matchId;
    const playerId = ws.playerId;
    
    if (!matchId || !playerId) {
      const errorMessage = MessageBuilder.createError('INVALID_STATE', 'Invalid connection state');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    const match = this.matches.get(matchId);
    if (!match) {
      const errorMessage = MessageBuilder.createError('MATCH_NOT_FOUND', 'Match not found');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    const player = match.players.get(playerId);
    if (!player) {
      const errorMessage = MessageBuilder.createError('PLAYER_NOT_FOUND', 'Player not in match');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    // Send current game state
    const gameState = this.createGameState(match, playerId);
    const gameStateMessage = MessageBuilder.createGameStateUpdate(gameState);
    ws.send(JSON.stringify(gameStateMessage));
  }

  private handleExitGame(ws: GameWebSocket, payload: any) {
    const matchId = ws.matchId;
    const playerId = ws.playerId;
    
    if (!matchId || !playerId) {
      const errorMessage = MessageBuilder.createError('INVALID_STATE', 'Invalid connection state');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    const match = this.matches.get(matchId);
    if (!match) {
      const errorMessage = MessageBuilder.createError('MATCH_NOT_FOUND', 'Match not found');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    const player = match.players.get(playerId);
    if (!player) {
      const errorMessage = MessageBuilder.createError('PLAYER_NOT_FOUND', 'Player not in match');
      ws.send(JSON.stringify(errorMessage));
      return;
    }

    console.log(`Player ${player.name} (${playerId}) requested to exit game intentionally`, {
      reason: payload.reason,
      message: payload.message
    });

    // Send confirmation to the exiting player
    const exitConfirmation = MessageBuilder.createMessage(MessageType.SUCCESS, {
      action: 'exit_game',
      message: 'You have successfully exited the game',
      data: { matchId, playerId }
    });
    ws.send(JSON.stringify(exitConfirmation));

    // Handle intentional exit
    this.handleIntentionalPlayerExit(player, match, payload.reason || 'intentional_exit', payload.message);
  }

  private handleIntentionalPlayerExit(player: Player, match: Match, reason: string, message?: string) {
    const playerInfo = this.createPlayerInfo(player, match);
    const matchSummary = this.createMatchSummary(match);

    // Close the WebSocket connection
    if (player.ws) {
      try {
        player.ws.close(1000, 'Player exited game intentionally');
      } catch (error) {
        console.error(`Error closing WebSocket for exiting player ${player.id}:`, error);
      }
    }

    // Remove player from match
    match.players.delete(player.id);
    this.activePlayers.delete(player.id);

    // Clean up disconnection timers and reconnection counters
    const timer = this.disconnectionTimers.get(player.id);
    if (timer) {
      clearTimeout(timer);
      this.disconnectionTimers.delete(player.id);
    }
    this.reconnectionCounters.delete(player.id);

    // Broadcast player exited message to remaining players
    const playerExitedPayload: PlayerExitedPayload = {
      player: playerInfo,
      match: matchSummary,
      reason: reason,
      message: message
    };
    const playerExitedMessage = MessageBuilder.createMessage(MessageType.PLAYER_EXITED, playerExitedPayload);
    this.notificationService.broadcastToMatch(match, playerExitedMessage);

    // Handle match state based on current status
    if (match.status === 'waiting') {
      // Match hasn't started yet - just make slot available
      console.log(`Player ${player.name} (${player.id}) exited from waiting match ${match.id} - slot available`);
      
      // If match becomes empty, clean it up
      if (match.players.size === 0) {
        this.cleanupEmptyMatch(match);
      }
    } else if (match.status === 'active' || match.status === 'paused') {
      // Match has started - cancel the match
      this.cancelMatch(match, playerInfo, reason, message);
    }

    console.log(`Player ${player.name} (${player.id}) intentionally exited from match ${match.id}`);
  }

  private cancelMatch(match: Match, cancelledBy: PlayerInfo, reason: string, message?: string) {
    // Set match status to cancelled
    match.status = 'cancelled';

    // Clean up round evaluator
    this.roundEvaluators.delete(match.id);

    // Broadcast match cancelled message to all remaining players
    const matchCancelledPayload: MatchCancelledPayload = {
      cancelledBy: cancelledBy,
      reason: reason,
      message: message
    };
    const matchCancelledMessage = MessageBuilder.createMessage(MessageType.MATCH_CANCELLED, matchCancelledPayload);

    // Send cancellation message to all remaining players
    Array.from(match.players.values()).forEach(p => {
      if (p.ws && p.connected) {
        p.ws.send(JSON.stringify(matchCancelledMessage));
      }
    });

    // Clean up - remove all players from active set and clean up timers/counters
    for (const playerId of match.players.keys()) {
      this.activePlayers.delete(playerId);
      
      // Clean up disconnection timers
      const timer = this.disconnectionTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectionTimers.delete(playerId);
      }
      
      // Clean up reconnection counters
      this.reconnectionCounters.delete(playerId);
    }

    // Clean up invite codes
    if (match.inviteCodes) {
      this.inviteCodes.delete(match.inviteCodes.team1);
      this.inviteCodes.delete(match.inviteCodes.team2);
      this.saveInviteCodes();
    }

    // Remove match from matches map
    this.matches.delete(match.id);

    console.log(`Match ${match.id} cancelled due to player exit. Reason: ${reason}`);
  }

  private handlePlayCard(ws: GameWebSocket, payload: any) {
    const { cardId } = payload;
    
    const matchId = ws.matchId;
    const playerId = ws.playerId;
    
    console.log('Play card request:', { cardId, matchId, playerId });

    if (!matchId || !playerId) {
      const error = MessageBuilder.createError('INVALID_STATE', 'Invalid connection state');
      ws.send(JSON.stringify(error));
      return;
    }

    const match = this.matches.get(matchId);
    if (!match) {
      const error = MessageBuilder.createError('MATCH_NOT_FOUND', 'Match not found');
      ws.send(JSON.stringify(error));
      return;
    }

    const player = match.players.get(playerId);
    if (!player) {
      const error = MessageBuilder.createError('PLAYER_NOT_FOUND', 'Player not in match');
      ws.send(JSON.stringify(error));
      return;
    }

    if (match.status !== 'active') {
      const error = MessageBuilder.createError('MATCH_NOT_ACTIVE', 'Match is not active');
      ws.send(JSON.stringify(error));
      return;
    }

    if (match.currentPlayerId !== playerId) {
      const error = MessageBuilder.createError('NOT_YOUR_TURN', 'It is not your turn to play');
      ws.send(JSON.stringify(error));
      return;
    }

    // Validate card is in player's hand
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      const error = MessageBuilder.createError(
        'INVALID_CARD', 
        'Card not in your hand. Your hand on the server may be out of sync.',
        {
          requestedCardId: cardId,
          serverHand: player.hand.map(c => c.id)
        }
      );
      ws.send(JSON.stringify(error));
      return;
    }

    // Play the card
    const playedCardObject = player.hand.splice(cardIndex, 1)[0];
    const playedAt = new Date().toISOString();
    match.playground.push({ playerId, card: playedCardObject });

    // Broadcast card played
    const playerInfo = this.createPlayerInfo(player, match);

    Array.from(match.players.values()).forEach(p => {
      if (p.ws && p.connected) {
        const gameState = this.createGameState(match, p.id);
        const cardPlayedPayload: CardPlayedPayload = {
          gameState,
          playedCard: {
            player: playerInfo,
            card: playedCardObject,
            playedAt
          }
        };
        const message = MessageBuilder.createMessage(MessageType.CARD_PLAYED, cardPlayedPayload);
        p.ws.send(JSON.stringify(message));
      }
    });

    // Check if round is complete
    if (match.playground.length === match.players.size) {
      this.completeRound(match);
    } else {
      // Move to next player
      this.setNextPlayer(match);
    }
  }

  private completeRound(match: Match) {
    setTimeout(() => {
      const roundEvaluator = this.roundEvaluators.get(match.id);
      if (!roundEvaluator) {
        console.error('No round evaluator found for match:', match.id);
        return;
      }

      // Convert current round to PlayerMove format for the evaluator
      const moves: PlayerMove[] = match.playground.map(playedCard => ({
        playerId: playedCard.playerId,
        card: playedCard.card,
        teamId: match.players.get(playedCard.playerId)!.teamId
      }));

      // Evaluate the round using RoundEvaluator
      const roundResult = roundEvaluator.evaluateRound(moves);

      // Create a copy of played cards for the payload before clearing the playground
      const playedCardsForPayload = match.playground.map(pc => this.createPayloadPlayedCard(pc, match));

      // Update match state based on evaluation
      const winnerTeam = roundResult.winningTeam;
      const winnerPlayerId = roundResult.winningPlayerId;
      const pointsEarned = roundResult.pointsEarned;

      // Update scores
      match.roundWins[winnerTeam]++;
      match.teamScores[winnerTeam] += pointsEarned;

      // Rotate playOrder so winner is first
      if (match.playOrder && match.playOrder.length > 0) {
        const winnerIdx = match.playOrder.indexOf(winnerPlayerId);
        if (winnerIdx !== -1) {
          match.playOrder = [
            ...match.playOrder.slice(winnerIdx),
            ...match.playOrder.slice(0, winnerIdx)
          ];
          match.firstPlayerIndex = 0;
          match.turnIndex = 0;
          match.currentPlayerId = match.playOrder[0];
          match.firstPlayerOfRound = match.playOrder[0];
        }
      }

      // Clear the playground for the next round.
      match.playground = [];

      // Send round result to all players
      const winnerPlayerInfo = this.createPlayerInfo(match.players.get(winnerPlayerId)!, match);

      Array.from(match.players.values()).forEach(p => {
        if(p.ws && p.connected) {
          const roundCompletedPayload: RoundCompletedPayload = {
            // This gameState now correctly reflects the winner as the next player and the cleared playground
            gameState: this.createGameState(match, p.id),
            roundResult: {
              winner: winnerPlayerInfo,
              winningTeam: winnerTeam,
              pointsEarned: pointsEarned,
              playedCards: playedCardsForPayload,
              analysis: {
                roundQuality: String(roundResult.overallRoundQuality),
                roundAnalysis: roundResult.roundAnalysis
              }
            }
          };
          const message = MessageBuilder.createMessage(MessageType.ROUND_COMPLETED, roundCompletedPayload);
          p.ws.send(JSON.stringify(message));
        }
      });

      // Check if the game is complete (i.e., players have no more cards)
      const anyPlayerHasCards = Array.from(match.players.values()).some(p => p.hand.length > 0);
      
      if (!anyPlayerHasCards) {
        this.completeMatch(match);
      } else {
        // If the game continues, explicitly notify clients about the turn change.
        this.notifyTurnChange(match);
      }
    }, 1000);
  }

  private completeMatch(match: Match) {
    match.status = 'completed';
    
    // Determine winning team based on total points
    const winnerTeamId: 'team1' | 'team2' = match.teamScores.team1 > match.teamScores.team2 ? 'team1' : 'team2';
    
    const stats = {
      totalRounds: match.roundWins.team1 + match.roundWins.team2,
      team1Points: match.teamScores.team1,
      team2Points: match.teamScores.team2,
      duration: Date.now() - match.createdAt.getTime()
    };

    // Clean up the round evaluator
    this.roundEvaluators.delete(match.id);

    // Send final game state to all players
    Array.from(match.players.values()).forEach(p => {
      if (p.ws && p.connected) {
        const gameState = this.createGameState(match, p.id);
        const matchEndedMessage = MessageBuilder.createMessage(MessageType.MATCH_ENDED, { gameState });
        p.ws.send(JSON.stringify(matchEndedMessage));
      }
    });

    // Clean up - remove players from active set and clean up timers/counters
    for (const playerId of match.players.keys()) {
      this.activePlayers.delete(playerId);
      
      // Clean up disconnection timers
      const timer = this.disconnectionTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectionTimers.delete(playerId);
      }
      
      // Clean up reconnection counters
      this.reconnectionCounters.delete(playerId);
    }

    // Clean up invite codes immediately on match completion
    if (match.inviteCodes) {
      this.inviteCodes.delete(match.inviteCodes.team1);
      this.inviteCodes.delete(match.inviteCodes.team2);
      this.saveInviteCodes();
    }

    console.log(`Match ${match.id} completed. Winner: ${winnerTeamId} with ${match.teamScores[winnerTeamId]} points`);
  }

  private setNextPlayer(match: Match) {
    if (!match.playOrder || match.playOrder.length === 0) return;
    match.turnIndex = ((match.turnIndex ?? 0) + 1) % match.playOrder.length;
    match.currentPlayerId = match.playOrder[match.turnIndex];
    this.notifyTurnChange(match);
  }

  private notifyTurnChange(match: Match) {
    if (!match.currentPlayerId) return;

    const currentPlayer = match.players.get(match.currentPlayerId);
    if (!currentPlayer) return;

    const currentPlayerInfo = this.createPlayerInfo(currentPlayer, match);
    const turnStartedAt = new Date().toISOString();

    Array.from(match.players.values()).forEach(p => {
      if (p.ws && p.connected) {
        const gameState = this.createGameState(match, p.id);
        const turnChangedPayload: TurnChangedPayload = {
          gameState,
          currentPlayer: currentPlayerInfo,
          isYourTurn: p.id === match.currentPlayerId,
          turnStartedAt
        };
        const message = MessageBuilder.createMessage(MessageType.TURN_CHANGED, turnChangedPayload);
        p.ws.send(JSON.stringify(message));
      }
    });
  }

  private startMatch(match: Match) {
    match.status = 'active';
    
    // Generate and shuffle cards
    const cards = this.deckService.generateDeck();
    this.deckService.shuffleDeck(cards);
    
    // Select trump suit
    const trumpSuit = this.deckService.selectTrumpSuit();
    match.trumpSuit = trumpSuit;

    // Distribute cards evenly
    const playersArray = Array.from(match.players.values());
    const cardsPerPlayer = Math.floor(cards.length / playersArray.length);
    // Track total rounds = cards per player
    (match as any).totalRounds = cardsPerPlayer;
    
    // Create a new RoundEvaluator for this match with accurate rounds
    this.roundEvaluators.set(match.id, new RoundEvaluator(
      trumpSuit,
      Math.max(1, cardsPerPlayer),
      match.players.size
    ));
    
    playersArray.forEach((player, index) => {
      const startIndex = index * cardsPerPlayer;
      player.hand = cards.slice(startIndex, startIndex + cardsPerPlayer);
    });

    // Use playOrder for turn logic
    if (match.playOrder && match.playOrder.length > 0) {
      match.firstPlayerIndex = 0;
      match.turnIndex = 0;
      match.currentPlayerId = match.playOrder[0];
      match.firstPlayerOfRound = match.playOrder[0];
    }
    const firstPlayer = match.players.get(match.currentPlayerId!);
    const firstPlayerInfo = firstPlayer ? this.createPlayerInfo(firstPlayer, match) : undefined;

    // Send game start to all players with custom payload
    playersArray.forEach(player => {
      if (player.ws && player.connected) {
        const gameState = this.createGameState(match, player.id);
        const matchStartedPayload: MatchStartedPayload = {
          gameState,
          startingPlayer: firstPlayerInfo!,
          trumpSuit: match.trumpSuit,
        };
        const message = MessageBuilder.createMessage(MessageType.MATCH_STARTED, matchStartedPayload);
        player.ws.send(JSON.stringify(message));
      }
    });

    // Notify the current player that it's their turn
    this.notifyTurnChange(match);

    console.log(`Match ${match.id} started with ${playersArray.length} players. Trump suit: ${trumpSuit}`);
  }

  private handleDisconnection(ws: GameWebSocket) {
    if (!ws.playerId || !ws.matchId) {
      return;
    }

    const match = this.matches.get(ws.matchId);
    if (!match) {
      return;
    }

    const player = match.players.get(ws.playerId);
    if (!player) {
      return;
    }

    // Guard against stale socket close flipping state during reconnection
    if (player.ws && player.ws !== ws && (player.ws as any).__ignoreClose === true) {
      // This close event is from an old socket; ignore
      return;
    }

    // Clear any existing disconnection timer for this player
    const existingTimer = this.disconnectionTimers.get(ws.playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectionTimers.delete(ws.playerId);
    }

    // Set a 5-second delay before publishing disconnection
    const disconnectionTimer = setTimeout(() => {
      this.publishPlayerDisconnection(ws.playerId!, ws.matchId!, ws.inviteCode!, player);
    }, 5000);

    this.disconnectionTimers.set(ws.playerId, disconnectionTimer);

    // Mark player as disconnected immediately but don't publish yet
    player.connected = false;
    player.ws = undefined;
    this.activePlayers.delete(ws.playerId);

    console.log(`Player ${player.name} (${ws.playerId}) disconnected from match ${ws.matchId} - waiting 5s before publishing`);
  }

  private publishPlayerDisconnection(playerId: string, matchId: string, inviteCode: string, player: Player) {
    const match = this.matches.get(matchId);
    if (!match) {
      return;
    }

    // Check if player has reconnected during the delay
    if (player.connected) {
      console.log(`Player ${player.name} (${playerId}) reconnected during disconnection delay - not publishing disconnection`);
      return;
    }

    // Clear the timer reference
    this.disconnectionTimers.delete(playerId);

    const playerInfo = this.createPlayerInfo(player, match);
    const matchSummary = this.createMatchSummary(match);

    // Pause match if it was active
    if (match.status === 'active') {
      match.status = 'paused';
      
      // Broadcast MATCH_PAUSED
      Array.from(match.players.values()).forEach(p => {
        if (p.ws && p.connected) {
          const pausedPayload: MatchPausedPayload = {
            reason: 'player_disconnected',
            pausedBy: playerInfo,
            resumeInfo: 'Match will resume when all players have reconnected.',
            gameState: this.createGameState(match, p.id)
          };
          const message = MessageBuilder.createMessage(MessageType.MATCH_PAUSED, pausedPayload);
          p.ws.send(JSON.stringify(message));
        }
      });
    }

    // Notify other players about the disconnection
    const disconnectedPayload: PlayerDisconnectedPayload = {
      player: playerInfo,
      match: matchSummary,
      reconnectInfo: {
        inviteCode: inviteCode,
        playerId: player.id,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour to reconnect
      }
    };
    const disconnectedMessage = MessageBuilder.createMessage(MessageType.PLAYER_DISCONNECTED, disconnectedPayload);
    this.notificationService.broadcastToMatch(match, disconnectedMessage, player.id);

    console.log(`Published disconnection for player ${player.name} (${playerId}) after 5s delay`);
  }

  private allPlayersConnected(match: Match): boolean {
    return Array.from(match.players.values()).every(p => p.connected);
  }

  // Utility methods
  public getMatchStats() {
    return {
      totalMatches: this.matches.size,
      activeMatches: Array.from(this.matches.values()).filter(m => m.status === 'active').length,
      waitingMatches: Array.from(this.matches.values()).filter(m => m.status === 'waiting').length,
      pausedMatches: Array.from(this.matches.values()).filter(m => m.status === 'paused').length,
      completedMatches: Array.from(this.matches.values()).filter(m => m.status === 'completed').length,
      cancelledMatches: Array.from(this.matches.values()).filter(m => m.status === 'cancelled').length,
      activePlayers: this.activePlayers.size,
      activeInviteCodes: this.inviteCodes.size
    };
  }

  public getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  public cleanupExpiredMatches(maxAgeHours: number = 24) {
    const now = Date.now();
    const expiredMatches: string[] = [];

    for (const [matchId, match] of this.matches) {
      const ageHours = (now - match.createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours && (match.status === 'completed' || !this.allPlayersConnected(match))) {
        expiredMatches.push(matchId);
        
        // Clean up invite codes
        if (match.inviteCodes) {
          this.inviteCodes.delete(match.inviteCodes.team1);
          this.inviteCodes.delete(match.inviteCodes.team2);
        }
        
        // Clean up round evaluator
        this.roundEvaluators.delete(matchId);
        
        // Remove players from active set and clean up timers/counters
        for (const playerId of match.players.keys()) {
          this.activePlayers.delete(playerId);
          
          // Clean up disconnection timers
          const timer = this.disconnectionTimers.get(playerId);
          if (timer) {
            clearTimeout(timer);
            this.disconnectionTimers.delete(playerId);
          }
          
          // Clean up reconnection counters
          this.reconnectionCounters.delete(playerId);
        }
      }
    }

    expiredMatches.forEach(matchId => {
      this.matches.delete(matchId);
    });

    if (expiredMatches.length > 0) {
      console.log(`Cleaned up ${expiredMatches.length} expired matches`);
      // Save invite codes after cleanup
      this.saveInviteCodes();
    }

    return expiredMatches.length;
  }

  // ============================================================================
  // PAYLOAD CREATION HELPERS
  // ============================================================================

  private createPlayerInfo(player: Player, match: Match): PlayerInfo {
    return {
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      connected: player.connected,
      isAnonymous: !!player.anonymousId,
      cardsRemaining: player.hand.length
    };
  }

  private createTeamInfo(teamId: 'team1' | 'team2', match: Match): TeamInfo {
    const teamPlayers = Array.from(match.players.values()).filter(p => p.teamId === teamId);
    const teamPlayerInfo = teamPlayers.map(p => this.createPlayerInfo(p, match));
    const connectedCount = teamPlayers.filter(p => p.connected).length;
    
    return {
      id: teamId,
      players: teamPlayerInfo,
      connectedCount,
      totalSlots: match.teamSize,
      missingCount: match.teamSize - teamPlayers.length + (teamPlayers.length - connectedCount),
      score: match.teamScores[teamId],
      roundWins: match.roundWins[teamId]
    };
  }

  private createMatchSummary(match: Match): MatchSummary {
    return {
      id: match.id,
      status: match.status,
      teamSize: match.teamSize,
      playersCount: match.players.size,
      maxPlayers: match.teamSize * 2,
      inviteCode: undefined // Should be provided contextually if needed
    };
  }
  
  private createPayloadPlayedCard(playedCard: InternalPlayedCard, match: Match): PayloadPlayedCard {
    const player = match.players.get(playedCard.playerId)!;
    return {
      playerId: player.id,
      playerName: player.name,
      card: playedCard.card,
      playedAt: new Date().toISOString() // This should be stored on the playedCard eventually
    };
  }

  private createGameState(match: Match, forPlayerId: string): GameState {
    const receivingPlayer = match.players.get(forPlayerId)!;
    const allPlayers = Array.from(match.players.values()).map(p => this.createPlayerInfo(p, match));
    const lastPlayedInternal = match.playground.length > 0 ? match.playground[match.playground.length - 1] : undefined;
    const lastPlayedPlayer = lastPlayedInternal ? match.players.get(lastPlayedInternal.playerId) : undefined;
    return {
      match: {
        id: match.id,
        status: match.status,
        currentRound: match.roundWins.team1 + match.roundWins.team2 + 1,
        totalRounds: (match as any).totalRounds ?? 8,
        trumpSuit: match.trumpSuit,
        createdAt: match.createdAt.toISOString(),
        turnIndex: match.turnIndex ?? 0,
        firstPlayerIndex: match.firstPlayerIndex ?? 0,
        playOrder: match.playOrder ?? []
      },
      players: {
        all: allPlayers,
        current: match.currentPlayerId,
        you: this.createPlayerInfo(receivingPlayer, match)
      },
      teams: {
        team1: this.createTeamInfo('team1', match),
        team2: this.createTeamInfo('team2', match)
      },
      scores: {
        roundWins: match.roundWins,
        totalPoints: match.teamScores
      },
      gameplay: {
        yourHand: receivingPlayer.hand,
        playground: match.playground.map(p => this.createPayloadPlayedCard(p, match)),
        lastPlayed: lastPlayedInternal && lastPlayedPlayer ? {
          player: this.createPlayerInfo(lastPlayedPlayer, match),
          card: lastPlayedInternal.card
        } : undefined
      },
      timing: {
        // These should be tracked on the match object
        roundStarted: undefined,
        turnStarted: undefined,
        lastActivity: new Date().toISOString()
      }
    };
  }

  // Helper to build a team-alternating play order
  private buildAlternatingPlayOrder(match: Match): string[] {
    const team1 = Array.from(match.players.values()).filter(p => p.teamId === 'team1');
    const team2 = Array.from(match.players.values()).filter(p => p.teamId === 'team2');
    const order: string[] = [];
    // Randomly pick which team starts
    const startTeam = Math.random() < 0.5 ? 'team1' : 'team2';
    let t1 = [...team1];
    let t2 = [...team2];
    let currentTeam = startTeam;
    while (t1.length > 0 || t2.length > 0) {
      if (currentTeam === 'team1' && t1.length > 0) {
        order.push(t1.shift()!.id);
      } else if (currentTeam === 'team2' && t2.length > 0) {
        order.push(t2.shift()!.id);
      }
      currentTeam = currentTeam === 'team1' ? 'team2' : 'team1';
    }
    return order;
  }
}