import { v4 as uuidv4 } from 'uuid';
import { Player, Match } from '../types';

export class PlayerService {
  public generateAnonymousId(): string {
    return `anon_${uuidv4().substring(0, 8)}`;
  }

  public generateRandomName(): string {
    const adjectives = ['Happy', 'Clever', 'Brave', 'Swift', 'Wise', 'Calm', 'Eager', 'Gentle', 'Kind', 'Lively'];
    const nouns = ['Tiger', 'Eagle', 'Dolphin', 'Wolf', 'Lion', 'Hawk', 'Fox', 'Bear', 'Shark', 'Falcon'];
    const randomNum = Math.floor(Math.random() * 1000);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}${randomNum}`;
  }

  public generatePlayerName(playerId: string, teamId: string, match: Match): string {
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