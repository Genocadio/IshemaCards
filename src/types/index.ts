import { WebSocket } from 'ws';

export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type CardValue = '3' | '4' | '5' | '6' | '7' | 'J' | 'Q' | 'K' | 'A';

// Static card IDs for each card in the deck
export type CardId = 
  | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'SJ' | 'SQ' | 'SK' | 'SA'  // Spades
  | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'HJ' | 'HQ' | 'HK' | 'HA'  // Hearts
  | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'CJ' | 'CQ' | 'CK' | 'CA'  // Clubs
  | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'DJ' | 'DQ' | 'DK' | 'DA'; // Diamonds

export interface Card {
  suit: Suit;
  value: CardValue;
  pointValue: number;
  id: CardId; // Now using static CardId type
}

// Static card deck mapping
export const STATIC_CARDS: Record<CardId, Card> = {
  // Spades
  'S3': { suit: 'Spades', value: '3', pointValue: 0, id: 'S3' },
  'S4': { suit: 'Spades', value: '4', pointValue: 0, id: 'S4' },
  'S5': { suit: 'Spades', value: '5', pointValue: 0, id: 'S5' },
  'S6': { suit: 'Spades', value: '6', pointValue: 0, id: 'S6' },
  'S7': { suit: 'Spades', value: '7', pointValue: 10, id: 'S7' },
  'SJ': { suit: 'Spades', value: 'J', pointValue: 3, id: 'SJ' },
  'SQ': { suit: 'Spades', value: 'Q', pointValue: 2, id: 'SQ' },
  'SK': { suit: 'Spades', value: 'K', pointValue: 4, id: 'SK' },
  'SA': { suit: 'Spades', value: 'A', pointValue: 11, id: 'SA' },
  
  // Hearts
  'H3': { suit: 'Hearts', value: '3', pointValue: 0, id: 'H3' },
  'H4': { suit: 'Hearts', value: '4', pointValue: 0, id: 'H4' },
  'H5': { suit: 'Hearts', value: '5', pointValue: 0, id: 'H5' },
  'H6': { suit: 'Hearts', value: '6', pointValue: 0, id: 'H6' },
  'H7': { suit: 'Hearts', value: '7', pointValue: 10, id: 'H7' },
  'HJ': { suit: 'Hearts', value: 'J', pointValue: 3, id: 'HJ' },
  'HQ': { suit: 'Hearts', value: 'Q', pointValue: 2, id: 'HQ' },
  'HK': { suit: 'Hearts', value: 'K', pointValue: 4, id: 'HK' },
  'HA': { suit: 'Hearts', value: 'A', pointValue: 11, id: 'HA' },
  
  // Clubs
  'C3': { suit: 'Clubs', value: '3', pointValue: 0, id: 'C3' },
  'C4': { suit: 'Clubs', value: '4', pointValue: 0, id: 'C4' },
  'C5': { suit: 'Clubs', value: '5', pointValue: 0, id: 'C5' },
  'C6': { suit: 'Clubs', value: '6', pointValue: 0, id: 'C6' },
  'C7': { suit: 'Clubs', value: '7', pointValue: 10, id: 'C7' },
  'CJ': { suit: 'Clubs', value: 'J', pointValue: 3, id: 'CJ' },
  'CQ': { suit: 'Clubs', value: 'Q', pointValue: 2, id: 'CQ' },
  'CK': { suit: 'Clubs', value: 'K', pointValue: 4, id: 'CK' },
  'CA': { suit: 'Clubs', value: 'A', pointValue: 11, id: 'CA' },
  
  // Diamonds
  'D3': { suit: 'Diamonds', value: '3', pointValue: 0, id: 'D3' },
  'D4': { suit: 'Diamonds', value: '4', pointValue: 0, id: 'D4' },
  'D5': { suit: 'Diamonds', value: '5', pointValue: 0, id: 'D5' },
  'D6': { suit: 'Diamonds', value: '6', pointValue: 0, id: 'D6' },
  'D7': { suit: 'Diamonds', value: '7', pointValue: 10, id: 'D7' },
  'DJ': { suit: 'Diamonds', value: 'J', pointValue: 3, id: 'DJ' },
  'DQ': { suit: 'Diamonds', value: 'Q', pointValue: 2, id: 'DQ' },
  'DK': { suit: 'Diamonds', value: 'K', pointValue: 4, id: 'DK' },
  'DA': { suit: 'Diamonds', value: 'A', pointValue: 11, id: 'DA' }
};

export interface Player {
  id: string;
  name: string;
  teamId: 'team1' | 'team2';
  connected: boolean;
  hand: Card[];
  ws?: WebSocket;
  anonymousId?: string;  // Store the original anonymous ID if player is anonymous
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
  roundWins: { team1: number, team2: number };
  teamScores: { team1: number, team2: number };
  trumpSuit: Suit;
  createdAt: Date;
  currentPlayerId?: string;
  firstPlayerOfRound?: string;
  inviteCodes?: { team1: string, team2: string };
  playOrder?: string[];
  firstPlayerIndex?: number;
  turnIndex?: number;
}

// ============================================================================
// STANDARDIZED WEBSOCKET MESSAGE STRUCTURE
// ============================================================================

// Base message structure - ALL messages follow this format
export interface BaseMessage<T = any> {
  type: MessageType;
  timestamp: string; // ISO string
  payload: T;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  messageId?: string; // Unique message ID for tracking
  correlationId?: string; // For request/response correlation
  priority?: 'low' | 'normal' | 'high' | 'critical';
  requiresAck?: boolean; // If client should acknowledge receipt
}

// ============================================================================
// MESSAGE TYPES - Comprehensive enum covering all scenarios
// ============================================================================

export enum MessageType {
  // Connection Management
  CONNECTION_ESTABLISHED = 'connection_established',
  RECONNECTION_SUCCESSFUL = 'reconnection_successful',
  CONNECTION_ERROR = 'connection_error',
  
  // Player Management
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  PLAYER_DISCONNECTED = 'player_disconnected',
  PLAYER_RECONNECTED = 'player_reconnected',
  
  // Match Lifecycle
  MATCH_CREATED = 'match_created',
  MATCH_STARTED = 'match_started',
  MATCH_PAUSED = 'match_paused',
  MATCH_RESUMED = 'match_resumed',
  MATCH_ENDED = 'match_ended',
  
  // Game State
  GAME_STATE_UPDATE = 'game_state_update',
  HAND_DEALT = 'hand_dealt',
  TURN_CHANGED = 'turn_changed',
  
  // Gameplay
  CARD_PLAYED = 'card_played',
  PLAYGROUND_UPDATED = 'playground_updated',
  ROUND_COMPLETED = 'round_completed',
  
  // Client Requests
  PLAY_CARD_REQUEST = 'play_card_request',
  GET_STATE_REQUEST = 'get_state_request',
  
  // System
  ERROR = 'error',
  SUCCESS = 'success',
  HEARTBEAT = 'heartbeat',
  ACKNOWLEDGMENT = 'acknowledgment'
}

// ============================================================================
// STANDARDIZED PAYLOAD STRUCTURES
// ============================================================================

// Connection Payloads
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

// Game State - The SINGLE source of truth structure
export interface GameState {
  match: {
    id: string;
    status: MatchStatus;
    currentRound: number;
    totalRounds: number;
    trumpSuit?: string;
    createdAt: string;
    turnIndex: number;
    firstPlayerIndex: number;
    playOrder: string[];
  };
  
  players: {
    all: PlayerInfo[];
    current?: string; // Current player ID
    you: PlayerInfo; // The receiving player's info
  };
  
  teams: {
    team1: TeamInfo;
    team2: TeamInfo;
  };
  
  scores: {
    roundWins: { team1: number; team2: number };
    totalPoints: { team1: number; team2: number };
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

// Supporting Interfaces
export interface PlayerInfo {
  id: string;
  name: string;
  teamId: 'team1' | 'team2';
  connected: boolean;
  isAnonymous?: boolean;
  cardsRemaining?: number; // Only visible to other players
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

// ============================================================================
// SPECIFIC MESSAGE PAYLOADS
// ============================================================================

// Player Events
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

// Match Events
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

// Gameplay Events
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

// Client Requests
export interface PlayCardRequestPayload {
  cardId: string;
}

export interface GetStateRequestPayload {
  includeHistory?: boolean;
  since?: string; // ISO timestamp
}

// System Messages
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

// ============================================================================
// HELPER FUNCTIONS FOR MESSAGE CREATION
// ============================================================================

export class MessageBuilder {
  private static generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static createMessage<T>(
    type: MessageType, 
    payload: T, 
    metadata?: Partial<MessageMetadata>
  ): BaseMessage<T> {
    return {
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata: metadata ? {
        messageId: this.generateId(),
        priority: 'normal',
        requiresAck: false,
        ...metadata
      } : undefined
    };
  }

  static createGameStateUpdate(gameState: GameState): BaseMessage<GameState> {
    return this.createMessage(MessageType.GAME_STATE_UPDATE, gameState, {
      priority: 'high'
    });
  }

  static createError(code: string, message: string, details?: any): BaseMessage<ErrorPayload> {
    return this.createMessage(MessageType.ERROR, {
      code,
      message,
      details,
      recovery: this.getRecoveryAction(code)
    }, {
      priority: 'high'
    });
  }

  static createConnectionEstablished(
    player: PlayerInfo, 
    match: MatchSummary, 
    wasGenerated: { playerId: boolean; playerName: boolean }
  ): BaseMessage<ConnectionEstablishedPayload> {
    return this.createMessage(MessageType.CONNECTION_ESTABLISHED, {
      player,
      match,
      wasGenerated
    }, {
      priority: 'critical'
    });
  }

  private static getRecoveryAction(errorCode: string): { action: string; description: string } | undefined {
    const recoveryMap: Record<string, { action: string; description: string }> = {
      'INVALID_CARD': {
        action: 'resync_state',
        description: 'Your game state is out of sync. Requesting a full state update is recommended.'
      },
      'NOT_YOUR_TURN': {
        action: 'wait_for_turn',
        description: 'It is not your turn to play. Please wait for the TURN_CHANGED event.'
      },
      'MATCH_NOT_FOUND': {
        action: 'reconnect',
        description: 'The match was not found on the server. Please try to reconnect with your invite code.'
      },
      'PLAYER_NOT_FOUND': {
        action: 'reconnect',
        description: 'Your player ID was not found in the match. Please try to reconnect.'
      },
      'MATCH_NOT_ACTIVE': {
        action: 'wait_for_state_change',
        description: 'The match is not currently active. Wait for a MATCH_STARTED or MATCH_RESUMED event.'
      },
      'INVALID_STATE': {
        action: 'reconnect',
        description: 'Your connection is in an invalid state. Please try to reconnect.'
      }
    };
    
    return recoveryMap[errorCode];
  }
}