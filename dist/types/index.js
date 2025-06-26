"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBuilder = exports.MessageType = exports.STATIC_CARDS = void 0;
// Static card deck mapping
exports.STATIC_CARDS = {
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
// ============================================================================
// MESSAGE TYPES - Comprehensive enum covering all scenarios
// ============================================================================
var MessageType;
(function (MessageType) {
    // Connection Management
    MessageType["CONNECTION_ESTABLISHED"] = "connection_established";
    MessageType["RECONNECTION_SUCCESSFUL"] = "reconnection_successful";
    MessageType["CONNECTION_ERROR"] = "connection_error";
    // Player Management
    MessageType["PLAYER_JOINED"] = "player_joined";
    MessageType["PLAYER_LEFT"] = "player_left";
    MessageType["PLAYER_DISCONNECTED"] = "player_disconnected";
    MessageType["PLAYER_RECONNECTED"] = "player_reconnected";
    // Match Lifecycle
    MessageType["MATCH_CREATED"] = "match_created";
    MessageType["MATCH_STARTED"] = "match_started";
    MessageType["MATCH_PAUSED"] = "match_paused";
    MessageType["MATCH_RESUMED"] = "match_resumed";
    MessageType["MATCH_ENDED"] = "match_ended";
    // Game State
    MessageType["GAME_STATE_UPDATE"] = "game_state_update";
    MessageType["HAND_DEALT"] = "hand_dealt";
    MessageType["TURN_CHANGED"] = "turn_changed";
    // Gameplay
    MessageType["CARD_PLAYED"] = "card_played";
    MessageType["PLAYGROUND_UPDATED"] = "playground_updated";
    MessageType["ROUND_COMPLETED"] = "round_completed";
    // Client Requests
    MessageType["PLAY_CARD_REQUEST"] = "play_card_request";
    MessageType["GET_STATE_REQUEST"] = "get_state_request";
    // System
    MessageType["ERROR"] = "error";
    MessageType["SUCCESS"] = "success";
    MessageType["HEARTBEAT"] = "heartbeat";
    MessageType["ACKNOWLEDGMENT"] = "acknowledgment";
})(MessageType || (exports.MessageType = MessageType = {}));
// ============================================================================
// HELPER FUNCTIONS FOR MESSAGE CREATION
// ============================================================================
class MessageBuilder {
    static generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static createMessage(type, payload, metadata) {
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
    static createGameStateUpdate(gameState) {
        return this.createMessage(MessageType.GAME_STATE_UPDATE, gameState, {
            priority: 'high'
        });
    }
    static createError(code, message, details) {
        return this.createMessage(MessageType.ERROR, {
            code,
            message,
            details,
            recovery: this.getRecoveryAction(code)
        }, {
            priority: 'high'
        });
    }
    static createConnectionEstablished(player, match, wasGenerated) {
        return this.createMessage(MessageType.CONNECTION_ESTABLISHED, {
            player,
            match,
            wasGenerated
        }, {
            priority: 'critical'
        });
    }
    static getRecoveryAction(errorCode) {
        const recoveryMap = {
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
exports.MessageBuilder = MessageBuilder;
