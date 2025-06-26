import { Match } from '../types';

export class NotificationService {
  public broadcastToMatch(match: Match, message: any, excludePlayerId?: string): void {
    for (const player of match.players.values()) {
      if (player.connected && player.ws && player.id !== excludePlayerId) {
        // Create a personalized message for each player
        const personalizedMessage = this.personalizeMessage(message, player.id);
        player.ws.send(JSON.stringify(personalizedMessage));
      }
    }
  }

  public personalizeMessage(message: any, playerId: string): any {
    const personalized = { ...message };
    
    if (personalized.type === 'player_joined') {
      const payload = personalized.payload;
      // Only include IDs for the current player
      if (Array.isArray(payload.players)) {
        payload.players = payload.players.map((p: any) => ({
          name: p.id === playerId ? "you" : p.name,
          teamId: p.teamId,
          connected: p.connected,
          id: p.id === playerId ? playerId : undefined
        }));
      }
      // Only include playerId if it's the current player
      if (payload.playerId === playerId) {
        payload.playerId = playerId;
      } else {
        delete payload.playerId;
      }
    }
    else if (personalized.type === 'match_resumed') {
      const payload = personalized.payload;
      
      // Add player's own ID to their turn order
      if (payload.players?.turnOrder && Array.isArray(payload.players.turnOrder)) {
        payload.players.turnOrder = payload.players.turnOrder.map((p: any) => ({
          name: p.name,
          teamId: p.teamId,
          isCurrentTurn: p.isCurrentTurn,
          id: p.name === "you" ? playerId : undefined
        }));
      }

      // Add player's own ID if they are the current player
      if (payload.currentPlayerName === "you") {
        payload.currentPlayerId = playerId;
      } else {
        delete payload.currentPlayerId;
      }

      // Add player's own ID if they resumed the match
      if (payload.resumedBy === "you") {
        payload.resumedById = playerId;
      } else {
        delete payload.resumedById;
      }
    }
    else if (personalized.type === 'match_started') {
      const payload = personalized.payload;
      
      // Add player's own ID to their team info
      if (payload.teams) {
        payload.teams = {
          team1: Array.isArray(payload.teams.team1) ? payload.teams.team1.map((p: any) => ({
            name: p.name,
            id: p.name === "you" ? playerId : undefined
          })) : [],
          team2: Array.isArray(payload.teams.team2) ? payload.teams.team2.map((p: any) => ({
            name: p.name,
            id: p.name === "you" ? playerId : undefined
          })) : []
        };
      }

      // Add player's own ID if they are the first player
      if (payload.firstPlayerName === "you") {
        payload.firstPlayerId = playerId;
      } else {
        // For other players, only send the name without ID
        delete payload.firstPlayerId;
      }
    }
    else if (personalized.type === 'round_result') {
      const payload = personalized.payload;
      
      // Add player's own ID if they are the winner
      if (payload.winnerPlayerName === "you") {
        payload.winnerPlayerId = playerId;
      } else {
        // For other players, only send the name without ID
        delete payload.winnerPlayerId;
      }

      // Add player's own ID to their played cards
      if (payload.playedCards && Array.isArray(payload.playedCards)) {
        payload.playedCards = payload.playedCards.map((card: any) => ({
          playerName: card.playerName,
          card: card.card,
          playerId: card.playerName === "you" ? playerId : undefined
        }));
      }
    }
    else if (personalized.type === 'card_played') {
      const payload = personalized.payload;
      
      // Add player's own ID if they played the card
      if (payload.playerName === "you") {
        payload.playerId = playerId;
      } else {
        // For other players, only send the name without ID
        delete payload.playerId;
      }
    }
    else if (personalized.type === 'player_returned') {
      const payload = personalized.payload;
      
      // Only include IDs for the current player
      if (payload.players && Array.isArray(payload.players)) {
        payload.players = payload.players.map((p: any) => ({
          name: p.name,
          teamId: p.teamId,
          connected: p.connected,
          id: p.name === "you" ? playerId : undefined
        }));
      }
    }
    else if (personalized.type === 'session_restored') {
      const payload = personalized.payload;
      
      // Only include IDs for the current player
      if (payload.players && Array.isArray(payload.players)) {
        payload.players = payload.players.map((p: any) => ({
          name: p.name,
          teamId: p.teamId,
          connected: p.connected,
          id: p.id === playerId ? playerId : undefined
        }));
      }
    }
    else if (personalized.type === 'player_disconnected') {
      const payload = personalized.payload;
      
      // Only include IDs for the current player
      if (payload.players && Array.isArray(payload.players)) {
        payload.players = payload.players.map((p: any) => ({
          name: p.name,
          teamId: p.teamId,
          connected: p.connected,
          id: p.name === "you" ? playerId : undefined
        }));
      }
    }

    return personalized;
  }
} 