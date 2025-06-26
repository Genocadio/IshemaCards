import { Card, Suit } from '../types';
export declare class DeckService {
    generateDeck(): Card[];
    shuffleDeck(cards: Card[]): void;
    selectTrumpSuit(): Suit;
}
