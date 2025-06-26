import { WebSocket, Server as WebSocketServer } from 'ws';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
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
  ReconnectionSuccessfulPayload
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

  constructor(port: number = 8080) {
    this.httpServer = createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.deckService = new DeckService();
    this.playerService = new PlayerService();
    this.notificationService = new NotificationService();
    
    this.wss.on('connection', (ws: GameWebSocket, req: IncomingMessage) => {
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
        console.log('Connection rejected: Invalid or expired invite code.', { inviteCode });
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

    this.httpServer.listen(port, () => {
      console.log(`Game server running on port ${port}`);
      console.log(`WebSocket connections: ws://localhost:${port}/invite/{inviteCode}`);
    });
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
          this.handleCreateMatchHttp(res, Number(teamSize));
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

  private handleCreateMatchHttp(res: ServerResponse, teamSize: number) {
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

    const port = this.httpServer.address() && typeof this.httpServer.address() === 'object' 
      ? (this.httpServer.address() as any).port 
      : 8080;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      matchId,
      teamSize,
      team1: {
        inviteCode: team1InviteCode,
        wsUrl: `ws://localhost:${port}/invite/${team1InviteCode}`,
        joinUrl: `ws://localhost:${port}/invite/${team1InviteCode}?name=YourName`
      },
      team2: {
        inviteCode: team2InviteCode,
        wsUrl: `ws://localhost:${port}/invite/${team2InviteCode}`,
        joinUrl: `ws://localhost:${port}/invite/${team2InviteCode}?name=YourName`
      },
      info: {
        message: 'Share the appropriate team invite URL with players',
        optionalParams: 'Add ?playerId=yourId&name=yourName to reconnect with existing identity'
      }
    }));

    console.log(`Match ${matchId} created with team size ${teamSize}`);
    console.log(`Team 1 invite: ${team1InviteCode}`);
    console.log(`Team 2 invite: ${team2InviteCode}`);
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
    if (this.activePlayers.has(playerId)) {
      return { 
        success: false, 
        error: 'Player ID already in use. Please choose a different ID or let the system generate one.' 
      };
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
      this.startMatch(match);
    }

    return { success: true, playerId };
  }

  private handlePlayerReconnection(
    ws: GameWebSocket, 
    match: Match, 
    existingPlayer: Player
  ): { success: boolean; error?: string; playerId?: string } {
    
    // Handle existing connection
    if (existingPlayer.connected && existingPlayer.ws) {
      existingPlayer.ws.close();
    }

    // Update player's connection
    existingPlayer.connected = true;
    existingPlayer.ws = ws;
    this.activePlayers.add(existingPlayer.id);
    ws.playerId = existingPlayer.id;

    console.log('Player reconnected:', {
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

      // The winner of the round starts the next round.
      // This must be set BEFORE creating the game state for the payload.
      match.currentPlayerId = winnerPlayerId;
      match.firstPlayerOfRound = winnerPlayerId;
      
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

    // Clean up - remove players from active set
    for (const playerId of match.players.keys()) {
      this.activePlayers.delete(playerId);
    }

    console.log(`Match ${match.id} completed. Winner: ${winnerTeamId} with ${match.teamScores[winnerTeamId]} points`);
  }

  private setNextPlayer(match: Match) {
    const playersArray = Array.from(match.players.values());
    const currentIndex = playersArray.findIndex(p => p.id === match.currentPlayerId);
    const nextIndex = (currentIndex + 1) % playersArray.length;
    match.currentPlayerId = playersArray[nextIndex].id;
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

    // Create a new RoundEvaluator for this match
    this.roundEvaluators.set(match.id, new RoundEvaluator(
      trumpSuit,
      8, // totalRounds
      match.players.size
    ));
    
    // Distribute cards evenly
    const playersArray = Array.from(match.players.values());
    const cardsPerPlayer = Math.floor(cards.length / playersArray.length);
    
    playersArray.forEach((player, index) => {
      const startIndex = index * cardsPerPlayer;
      player.hand = cards.slice(startIndex, startIndex + cardsPerPlayer);
    });

    // Randomly select first player
    const firstPlayer = playersArray[Math.floor(Math.random() * playersArray.length)];
    match.currentPlayerId = firstPlayer.id;
    match.firstPlayerOfRound = firstPlayer.id;

    const firstPlayerInfo = this.createPlayerInfo(firstPlayer, match);

    // Send game start to all players with custom payload
    playersArray.forEach(player => {
      if (player.ws && player.connected) {
        const gameState = this.createGameState(match, player.id);
        const matchStartedPayload: MatchStartedPayload = {
          gameState,
          startingPlayer: firstPlayerInfo,
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

    player.connected = false;
    player.ws = undefined;
    this.activePlayers.delete(ws.playerId);

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

    // Notify other players
    const disconnectedPayload: PlayerDisconnectedPayload = {
      player: playerInfo,
      match: matchSummary,
      reconnectInfo: {
        inviteCode: ws.inviteCode!,
        playerId: player.id,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour to reconnect
      }
    };
    const disconnectedMessage = MessageBuilder.createMessage(MessageType.PLAYER_DISCONNECTED, disconnectedPayload);
    this.notificationService.broadcastToMatch(match, disconnectedMessage, player.id);

    console.log(`Player ${player.name} (${ws.playerId}) disconnected from match ${ws.matchId}`);
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
        
        // Remove players from active set
        for (const playerId of match.players.keys()) {
          this.activePlayers.delete(playerId);
        }
      }
    }

    expiredMatches.forEach(matchId => {
      this.matches.delete(matchId);
    });

    if (expiredMatches.length > 0) {
      console.log(`Cleaned up ${expiredMatches.length} expired matches`);
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
        totalRounds: 8, // This should be configurable
        trumpSuit: match.trumpSuit,
        createdAt: match.createdAt.toISOString()
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
}