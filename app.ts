import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

// Types and Interfaces
interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: number; // 1-9
  id: string;
}

interface Player {
  id: string;
  teamId: 'team1' | 'team2';
  connected: boolean;
  hand: Card[];
  ws?: WebSocket;
}

interface PlayedCard {
  playerId: string;
  card: Card;
}

interface Match {
  id: string;
  players: Map<string, Player>;
  teamSize: number;
  status: 'waiting' | 'active' | 'paused' | 'completed';
  currentRound: PlayedCard[];
  roundWins: { team1: number; team2: number };
  currentPlayerId?: string;
  firstPlayerOfRound?: string;
  createdAt: Date;
}

// Game State Management
class GameServer {
  private matches = new Map<string, Match>();
  private activePlayers = new Set<string>(); // Track active playerIds across all matches
  private wss: WebSocketServer;

  constructor(port: number = 8080) {
    const server = createServer();
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    server.listen(port, () => {
      console.log(`Game server running on port ${port}`);
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    const { type, payload } = message;

    switch (type) {
      case 'create_match':
        this.handleCreateMatch(ws, payload);
        break;
      case 'join_match':
        this.handleJoinMatch(ws, payload);
        break;
      case 'play_card':
        this.handlePlayCard(ws, payload);
        break;
      case 'reconnect':
        this.handleReconnect(ws, payload);
        break;
      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  private handleCreateMatch(ws: WebSocket, payload: any) {
    const { playerId: providedPlayerId, teamSize = 2 } = payload;
    
    // Generate playerId if not provided
    const playerId = providedPlayerId || this.generateAnonymousId();
    
    // Check if playerId is already active
    if (this.activePlayers.has(playerId)) {
      ws.send(JSON.stringify({ 
        error: 'Player ID already in use in another active session' 
      }));
      return;
    }

    // Validate team size
    if (teamSize < 1 || teamSize > 3) {
      ws.send(JSON.stringify({ error: 'Team size must be between 1 and 3' }));
      return;
    }

    const matchId = uuidv4();
    const match: Match = {
      id: matchId,
      players: new Map(),
      teamSize,
      status: 'waiting',
      currentRound: [],
      roundWins: { team1: 0, team2: 0 },
      createdAt: new Date()
    };

    // Add creator as first player
    const player: Player = {
      id: playerId,
      teamId: 'team1',
      connected: true,
      hand: [],
      ws
    };

    match.players.set(playerId, player);
    this.matches.set(matchId, match);
    this.activePlayers.add(playerId);

    const joinUrl = `wss://game.io/match/${matchId}`;
    
    ws.send(JSON.stringify({
      type: 'match_created',
      payload: { matchId, joinUrl }
    }));

    console.log(`Match ${matchId} created by player ${playerId}`);
  }

  private handleJoinMatch(ws: WebSocket, payload: any) {
    const { matchId, playerId: providedPlayerId } = payload;
    
    const playerId = providedPlayerId || this.generateAnonymousId();
    
    // Check if playerId is already active
    if (this.activePlayers.has(playerId)) {
      ws.send(JSON.stringify({ 
        error: 'Player ID already in use in another active session' 
      }));
      return;
    }

    const match = this.matches.get(matchId);
    if (!match) {
      ws.send(JSON.stringify({ error: 'Match not found' }));
      return;
    }

    if (match.status !== 'waiting') {
      ws.send(JSON.stringify({ error: 'Match is not accepting new players' }));
      return;
    }

    // Check if match is full
    const maxPlayers = match.teamSize * 2;
    if (match.players.size >= maxPlayers) {
      ws.send(JSON.stringify({ error: 'Match is full' }));
      return;
    }

    // Assign team (balance teams)
    const team1Count = Array.from(match.players.values()).filter(p => p.teamId === 'team1').length;
    const team2Count = Array.from(match.players.values()).filter(p => p.teamId === 'team2').length;
    const teamId = team1Count <= team2Count ? 'team1' : 'team2';

    const player: Player = {
      id: playerId,
      teamId,
      connected: true,
      hand: [],
      ws
    };

    match.players.set(playerId, player);
    this.activePlayers.add(playerId);

    // Notify all players about the new join
    const playersArray = Array.from(match.players.values()).map(p => ({
      id: p.id,
      teamId: p.teamId,
      connected: p.connected
    }));

    const remaining = maxPlayers - match.players.size;

    this.broadcastToMatch(match, {
      type: 'player_joined',
      payload: { 
        playerId, 
        teamId, 
        players: playersArray, 
        remaining 
      }
    });

    // Start match if full
    if (match.players.size === maxPlayers) {
      this.startMatch(match);
    }

    console.log(`Player ${playerId} joined match ${matchId} on ${teamId}`);
  }

  private handlePlayCard(ws: WebSocket, payload: any) {
    const { playerId, matchId, card } = payload;
    
    const match = this.matches.get(matchId);
    if (!match) {
      ws.send(JSON.stringify({ error: 'Match not found' }));
      return;
    }

    const player = match.players.get(playerId);
    if (!player) {
      ws.send(JSON.stringify({ error: 'Player not in match' }));
      return;
    }

    if (match.status !== 'active') {
      ws.send(JSON.stringify({ error: 'Match is not active' }));
      return;
    }

    if (match.currentPlayerId !== playerId) {
      ws.send(JSON.stringify({ error: 'Not your turn' }));
      return;
    }

    // Validate card is in player's hand
    const cardIndex = player.hand.findIndex(c => c.id === card.id);
    if (cardIndex === -1) {
      ws.send(JSON.stringify({ error: 'Card not in hand' }));
      return;
    }

    // Remove card from hand and add to current round
    const playedCard = player.hand.splice(cardIndex, 1)[0];
    match.currentRound.push({ playerId, card: playedCard });

    // Broadcast card played
    this.broadcastToMatch(match, {
      type: 'card_played',
      payload: { playerId, card: playedCard }
    });

    // Check if round is complete
    if (match.currentRound.length === match.players.size) {
      this.completeRound(match);
    } else {
      // Move to next player
      this.setNextPlayer(match);
    }
  }

  private handleReconnect(ws: WebSocket, payload: any) {
    const { playerId, matchId } = payload;
    
    const match = this.matches.get(matchId);
    if (!match) {
      ws.send(JSON.stringify({ error: 'Match not found' }));
      return;
    }

    const player = match.players.get(playerId);
    if (!player) {
      ws.send(JSON.stringify({ error: 'Player not in match' }));
      return;
    }

    // Reconnect player
    player.connected = true;
    player.ws = ws;

    // Notify all players
    this.broadcastToMatch(match, {
      type: 'player_reconnected',
      payload: { playerId }
    });

    // Send current state to reconnected player
    ws.send(JSON.stringify({
      type: 'match_state',
      payload: {
        matchId,
        status: match.status,
        hand: player.hand,
        currentRound: match.currentRound,
        roundWins: match.roundWins,
        currentPlayerId: match.currentPlayerId
      }
    }));

    // Resume match if all players are connected
    if (match.status === 'paused' && this.allPlayersConnected(match)) {
      match.status = 'active';
      this.broadcastToMatch(match, {
        type: 'match_resumed',
        payload: { resumedBy: playerId }
      });
    }

    console.log(`Player ${playerId} reconnected to match ${matchId}`);
  }

  private handleDisconnection(ws: WebSocket) {
    // Find the player who disconnected
    for (const [matchId, match] of this.matches) {
      for (const [playerId, player] of match.players) {
        if (player.ws === ws) {
          player.connected = false;
          player.ws = undefined;

          // Pause match if it was active
          if (match.status === 'active') {
            match.status = 'paused';
            this.broadcastToMatch(match, {
              type: 'match_paused',
              payload: { reason: 'Player disconnected' }
            });
          }

          this.broadcastToMatch(match, {
            type: 'player_disconnected',
            payload: { playerId }
          });

          console.log(`Player ${playerId} disconnected from match ${matchId}`);
          return;
        }
      }
    }
  }

  private startMatch(match: Match) {
    match.status = 'active';
    
    // Generate and shuffle cards
    const cards = this.generateDeck();
    this.shuffleDeck(cards);
    
    // Distribute cards evenly
    const playersArray = Array.from(match.players.values());
    const cardsPerPlayer = Math.floor(cards.length / playersArray.length);
    
    playersArray.forEach((player, index) => {
      const startIndex = index * cardsPerPlayer;
      player.hand = cards.slice(startIndex, startIndex + cardsPerPlayer);
    });

    // Choose first player randomly
    const firstPlayer = playersArray[Math.floor(Math.random() * playersArray.length)];
    match.currentPlayerId = firstPlayer.id;
    match.firstPlayerOfRound = firstPlayer.id;

    // Send game start to all players
    playersArray.forEach(player => {
      if (player.ws) {
        player.ws.send(JSON.stringify({
          type: 'match_started',
          payload: {
            hands: player.hand,
            teams: {
              team1: playersArray.filter(p => p.teamId === 'team1').map(p => p.id),
              team2: playersArray.filter(p => p.teamId === 'team2').map(p => p.id)
            },
            firstPlayerId: firstPlayer.id
          }
        }));
      }
    });

    console.log(`Match ${match.id} started with ${playersArray.length} players`);
  }

  private completeRound(match: Match) {
    // Determine round winner (highest card value)
    let winner = match.currentRound[0];
    for (const playedCard of match.currentRound) {
      if (playedCard.card.value > winner.card.value) {
        winner = playedCard;
      }
    }

    const winnerPlayer = match.players.get(winner.playerId)!;
    const teamId = winnerPlayer.teamId;
    
    // Update round wins
    match.roundWins[teamId]++;

    // Broadcast round result
    this.broadcastToMatch(match, {
      type: 'round_result',
      payload: {
        winnerPlayerId: winner.playerId,
        teamId,
        playedCards: match.currentRound
      }
    });

    // Clear current round
    match.currentRound = [];

    // Check if game is complete (no cards left)
    const anyPlayerHasCards = Array.from(match.players.values()).some(p => p.hand.length > 0);
    
    if (!anyPlayerHasCards) {
      this.completeMatch(match);
    } else {
      // Winner starts next round
      match.currentPlayerId = winner.playerId;
      match.firstPlayerOfRound = winner.playerId;
    }
  }

  private completeMatch(match: Match) {
    match.status = 'completed';
    
    // Determine winning team
    const winnerTeamId = match.roundWins.team1 > match.roundWins.team2 ? 'team1' : 'team2';
    
    const stats = {
      totalRounds: match.roundWins.team1 + match.roundWins.team2,
      team1Wins: match.roundWins.team1,
      team2Wins: match.roundWins.team2,
      duration: Date.now() - match.createdAt.getTime()
    };

    this.broadcastToMatch(match, {
      type: 'game_result',
      payload: { winnerTeamId, stats }
    });

    // Clean up - remove players from active set
    for (const playerId of match.players.keys()) {
      this.activePlayers.delete(playerId);
    }

    console.log(`Match ${match.id} completed. Winner: ${winnerTeamId}`);
  }

  private setNextPlayer(match: Match) {
    const playersArray = Array.from(match.players.keys());
    const currentIndex = playersArray.indexOf(match.currentPlayerId!);
    const nextIndex = (currentIndex + 1) % playersArray.length;
    match.currentPlayerId = playersArray[nextIndex];
  }

  private generateDeck(): Card[] {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const cards: Card[] = [];
    
    suits.forEach(suit => {
      for (let value = 1; value <= 9; value++) {
        cards.push({
          suit,
          value,
          id: uuidv4()
        });
      }
    });
    
    return cards;
  }

  private shuffleDeck(cards: Card[]) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  private generateAnonymousId(): string {
    return `anon_${uuidv4().substring(0, 8)}`;
  }

  private allPlayersConnected(match: Match): boolean {
    return Array.from(match.players.values()).every(p => p.connected);
  }

  private broadcastToMatch(match: Match, message: any) {
    for (const player of match.players.values()) {
      if (player.connected && player.ws) {
        player.ws.send(JSON.stringify(message));
      }
    }
  }

  // Utility methods for monitoring
  public getMatchStats() {
    return {
      totalMatches: this.matches.size,
      activeMatches: Array.from(this.matches.values()).filter(m => m.status === 'active').length,
      waitingMatches: Array.from(this.matches.values()).filter(m => m.status === 'waiting').length,
      activePlayers: this.activePlayers.size
    };
  }

  public getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }
}

// Example usage and server startup
const gameServer = new GameServer(8080);

// Optional: Add periodic cleanup of old completed matches
setInterval(() => {
  const now = Date.now();
  const MAX_MATCH_AGE = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [matchId, match] of gameServer['matches']) {
    if (match.status === 'completed' && 
        now - match.createdAt.getTime() > MAX_MATCH_AGE) {
      gameServer['matches'].delete(matchId);
      console.log(`Cleaned up old match ${matchId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export { GameServer, Match, Player, Card };