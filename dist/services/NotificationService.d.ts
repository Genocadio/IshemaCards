import { Match } from '../types';
export declare class NotificationService {
    broadcastToMatch(match: Match, message: any, excludePlayerId?: string): void;
    personalizeMessage(message: any, playerId: string): any;
}
