import { Card, Suit, STATIC_CARDS } from '../types';

export class DeckService {
  public generateDeck(): Card[] {
    // Return all cards from the static deck
    return Object.values(STATIC_CARDS);
  }

  public shuffleDeck(cards: Card[]): void {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  public selectTrumpSuit(): Suit {
    const suits: Suit[] = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
    return suits[Math.floor(Math.random() * suits.length)];
  }
} 