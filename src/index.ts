import { GameServer } from './GameServer';

// Create and start the game server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const gameServer = new GameServer(port);

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