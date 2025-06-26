"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = void 0;
const uuid_1 = require("uuid");
class PlayerService {
    generateAnonymousId() {
        return `anon_${(0, uuid_1.v4)().substring(0, 8)}`;
    }
    generateRandomName() {
        const adjectives = ['Happy', 'Clever', 'Brave', 'Swift', 'Wise', 'Calm', 'Eager', 'Gentle', 'Kind', 'Lively'];
        const nouns = ['Tiger', 'Eagle', 'Dolphin', 'Wolf', 'Lion', 'Hawk', 'Fox', 'Bear', 'Shark', 'Falcon'];
        const randomNum = Math.floor(Math.random() * 1000);
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj}${noun}${randomNum}`;
    }
    generatePlayerName(playerId, teamId, match) {
        const baseName = `Player_${playerId.substring(0, 4)}`;
        // Count players with same base name in the match
        const sameNameCount = Array.from(match.players.values())
            .filter(p => p.name.startsWith(baseName))
            .length;
        // Count players with same base name in the same team
        const sameTeamNameCount = Array.from(match.players.values())
            .filter(p => p.name.startsWith(baseName) && p.teamId === teamId)
            .length;
        if (sameNameCount > 1) {
            if (sameTeamNameCount > 1) {
                return `${baseName}_${sameTeamNameCount}`;
            }
            return `${baseName}_${teamId === 'team1' ? '1' : '2'}`;
        }
        return baseName;
    }
}
exports.PlayerService = PlayerService;
