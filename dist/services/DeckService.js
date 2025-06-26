"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckService = void 0;
const types_1 = require("../types");
class DeckService {
    generateDeck() {
        // Return all cards from the static deck
        return Object.values(types_1.STATIC_CARDS);
    }
    shuffleDeck(cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
    }
    selectTrumpSuit() {
        const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
        return suits[Math.floor(Math.random() * suits.length)];
    }
}
exports.DeckService = DeckService;
