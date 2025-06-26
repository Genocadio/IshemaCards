import { Card, Suit } from '../types';
export interface PlayerMove {
    playerId: string;
    card: Card;
    teamId: string;
    moveQuality?: number;
}
interface RoundResult {
    winningTeam: 'team1' | 'team2';
    winningPlayerId: string;
    pointsEarned: number;
    moveRatings: {
        playerId: string;
        moveQuality: number;
        reasoning: string;
    }[];
    overallRoundQuality: number;
    roundAnalysis: string;
}
export declare class RoundEvaluator {
    private trumpSuit;
    private readonly CARD_POINT_VALUES;
    private readonly TRUMP_BONUS;
    private readonly MAJOR_SUIT_ORDER;
    private readonly logg;
    private playerHistory;
    private currentRound;
    private totalRounds;
    private playedCards;
    private playerCount;
    constructor(trumpSuit: Suit, totalRounds?: number, playerCount?: number);
    private log;
    evaluateRound(moves: PlayerMove[], roundStake?: number): RoundResult;
    private determineWinningTeam;
    private rateSingleMove;
    private getGamePhase;
    private rateFirstPlayerMove;
    private rateSecondPlayerMove;
    private generateMoveReasoning;
    private calculateRoundPoints;
    private calculateOverallRoundQuality;
    private updatePlayerHistory;
    private generateRoundAnalysis;
    getPlayerStats(playerId: string): {
        totalMoves: number;
        goodMovePercentage: number;
        badMovePercentage: number;
        averageRating: number;
        trumpUsageRate: number;
    } | null;
    private isSpecialTrumpRound;
    private compareCards;
    private compareCardValues;
    private getCardFromId;
    private checkFirstRoundSpecialWin;
}
export {};
