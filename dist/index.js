"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameServer_1 = require("./GameServer");
// Create and start the game server
const gameServer = new GameServer_1.GameServer(8080);
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
