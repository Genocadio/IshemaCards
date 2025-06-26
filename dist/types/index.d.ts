import { WebSocket } from 'ws';
export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type CardValue = '3' | '4' | '5' | '6' | '7' | 'J' | 'Q' | 'K' | 'A';
export type CardId = 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'SJ' | 'SQ' | 'SK' | 'SA' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'HJ' | 'HQ' | 'HK' | 'HA' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'CJ' | 'CQ' | 'CK' | 'CA' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'DJ' | 'DQ' | 'DK' | 'DA';
export interface Card {
    suit: Suit;
    value: CardValue;
    pointValue: number;
    id: CardId;
}
export declare const STATIC_CARDS: Record<CardId, Card>;
export interface Player {
    id: string;
    name: string;
    teamId: 'team1' | 'team2';
    connected: boolean;
    hand: Card[];
    ws?: WebSocket;
    anonymousId?: string;
}
export interface PlayedCard {
    playerId: string;
    card: Card;
}
export interface Match {
    id: string;
    players: Map<string, Player>;
    teamSize: number;
    status: 'waiting' | 'active' | 'paused' | 'completed';
    playground: PlayedCard[];
    roundWins: {
        team1: number;
        team2: number;
    };
    teamScores: {
        team1: number;
        team2: number;
    };
    trumpSuit: Suit;
    createdAt: Date;
    currentPlayerId?: string;
    firstPlayerOfRound?: string;
    inviteCodes?: {
        team1: string;
        team2: string;
    };
}
export interface BaseMessage<T = any> {
    type: MessageType;
    timestamp: string;
    payload: T;
    metadata?: MessageMetadata;
}
export interface MessageMetadata {
    messageId?: string;
    correlationId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    requiresAck?: boolean;
}
export declare enum MessageType {
    CONNECTION_ESTABLISHED = "connection_established",
    RECONNECTION_SUCCESSFUL = "reconnection_successful",
    CONNECTION_ERROR = "connection_error",
    PLAYER_JOINED = "player_joined",
    PLAYER_LEFT = "player_left",
    PLAYER_DISCONNECTED = "player_disconnected",
    PLAYER_RECONNECTED = "player_reconnected",
    MATCH_CREATED = "match_created",
    MATCH_STARTED = "match_started",
    MATCH_PAUSED = "match_paused",
    MATCH_RESUMED = "match_resumed",
    MATCH_ENDED = "match_ended",
    GAME_STATE_UPDATE = "game_state_update",
    HAND_DEALT = "hand_dealt",
    TURN_CHANGED = "turn_changed",
    CARD_PLAYED = "card_played",
    PLAYGROUND_UPDATED = "playground_updated",
    ROUND_COMPLETED = "round_completed",
    PLAY_CARD_REQUEST = "play_card_request",
    GET_STATE_REQUEST = "get_state_request",
    ERROR = "error",
    SUCCESS = "success",
    HEARTBEAT = "heartbeat",
    ACKNOWLEDGMENT = "acknowledgment"
}
export interface ConnectionEstablishedPayload {
    player: PlayerInfo;
    match: MatchSummary;
    wasGenerated: {
        playerId: boolean;
        playerName: boolean;
    };
}
export interface ReconnectionSuccessfulPayload {
    player: PlayerInfo;
    match: MatchSummary;
    gameState: GameState;
    missedEvents?: MissedEvent[];
}
export interface GameState {
    match: {
        id: string;
        status: MatchStatus;
        currentRound: number;
        totalRounds: number;
        trumpSuit?: string;
        createdAt: string;
    };
    players: {
        all: PlayerInfo[];
        current?: string;
        you: PlayerInfo;
    };
    teams: {
        team1: TeamInfo;
        team2: TeamInfo;
    };
    scores: {
        roundWins: {
            team1: number;
            team2: number;
        };
        totalPoints: {
            team1: number;
            team2: number;
        };
    };
    gameplay: {
        yourHand: Card[];
        playground: PayloadPlayedCard[];
        lastPlayed?: {
            player: PlayerInfo;
            card: Card;
        };
    };
    timing: {
        roundStarted?: string;
        turnStarted?: string;
        lastActivity?: string;
    };
}
export interface PlayerInfo {
    id: string;
    name: string;
    teamId: 'team1' | 'team2';
    connected: boolean;
    isAnonymous?: boolean;
    cardsRemaining?: number;
}
export interface TeamInfo {
    id: 'team1' | 'team2';
    players: PlayerInfo[];
    connectedCount: number;
    totalSlots: number;
    missingCount: number;
    score: number;
    roundWins: number;
}
export interface MatchSummary {
    id: string;
    status: MatchStatus;
    teamSize: number;
    playersCount: number;
    maxPlayers: number;
    inviteCode?: string;
}
export interface PayloadPlayedCard {
    playerId: string;
    playerName: string;
    card: Card;
    playedAt: string;
}
export type MatchStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';
export interface MissedEvent {
    type: MessageType;
    timestamp: string;
    summary: string;
}
export interface PlayerJoinedPayload {
    player: PlayerInfo;
    match: MatchSummary;
    teams: {
        team1: TeamInfo;
        team2: TeamInfo;
    };
}
export interface PlayerDisconnectedPayload {
    player: PlayerInfo;
    match: MatchSummary;
    reconnectInfo: {
        inviteCode: string;
        playerId: string;
        expiresAt: string;
    };
}
export interface MatchStartedPayload {
    gameState: GameState;
    startingPlayer: PlayerInfo;
    trumpSuit: string;
}
export interface MatchPausedPayload {
    reason: 'player_disconnected' | 'system_maintenance' | 'manual';
    pausedBy?: PlayerInfo;
    resumeInfo: string;
    gameState: GameState;
}
export interface MatchResumedPayload {
    resumedBy: PlayerInfo;
    gameState: GameState;
}
export interface CardPlayedPayload {
    gameState: GameState;
    playedCard: {
        player: PlayerInfo;
        card: Card;
        playedAt: string;
    };
}
export interface RoundCompletedPayload {
    gameState: GameState;
    roundResult: {
        winner: PlayerInfo;
        winningTeam: 'team1' | 'team2';
        pointsEarned: number;
        playedCards: PayloadPlayedCard[];
        analysis?: {
            roundQuality: string;
            roundAnalysis: string;
        };
    };
}
export interface TurnChangedPayload {
    gameState: GameState;
    currentPlayer: PlayerInfo;
    isYourTurn: boolean;
    turnStartedAt: string;
}
export interface PlayCardRequestPayload {
    cardId: string;
}
export interface GetStateRequestPayload {
    includeHistory?: boolean;
    since?: string;
}
export interface ErrorPayload {
    code: string;
    message: string;
    details?: any;
    recovery?: {
        action: string;
        description: string;
    };
}
export interface SuccessPayload {
    action: string;
    message: string;
    data?: any;
}
export interface HeartbeatPayload {
    serverTime: string;
    matchId?: string;
    playerId?: string;
}
export declare class MessageBuilder {
    private static generateId;
    static createMessage<T>(type: MessageType, payload: T, metadata?: Partial<MessageMetadata>): BaseMessage<T>;
    static createGameStateUpdate(gameState: GameState): BaseMessage<GameState>;
    static createError(code: string, message: string, details?: any): BaseMessage<ErrorPayload>;
    static createConnectionEstablished(player: PlayerInfo, match: MatchSummary, wasGenerated: {
        playerId: boolean;
        playerName: boolean;
    }): BaseMessage<ConnectionEstablishedPayload>;
    private static getRecoveryAction;
}
