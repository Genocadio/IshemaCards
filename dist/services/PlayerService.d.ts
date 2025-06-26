import { Match } from '../types';
export declare class PlayerService {
    generateAnonymousId(): string;
    generateRandomName(): string;
    generatePlayerName(playerId: string, teamId: string, match: Match): string;
}
