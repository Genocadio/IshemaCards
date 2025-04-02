import { Card, Suit, CardValue, PlayerType } from './types';
import { SUITS, VALUES } from './constants';

// Create a full deck
export function createDeck(): Card[] {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({ suit, value });
    });
  });
  return deck;
}

// Shuffle deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Determine card value for comparison
export function getCardValue(card: Card, values: CardValue[] = VALUES): number {
  return values.indexOf(card.value);
}

// Determine winner of a round
export function determineRoundWinner(card1: Card, card2: Card, trumpSuit: Suit): PlayerType {
  // If one card is trump and the other isn't, trump wins
  if (card1.suit === trumpSuit && card2.suit !== trumpSuit) {
    return 'player';
  }
  if (card2.suit === trumpSuit && card1.suit !== trumpSuit) {
    return 'ai';
  }
  
  // If both or neither are trump, compare values
  const value1 = getCardValue(card1);
  const value2 = getCardValue(card2);
  
  if (value1 > value2) {
    return 'player';
  } else if (value2 > value1) {
    return 'ai';
  } else {
    return 'tie'; // Should never happen in this game with unique cards
  }
}

// AI logic for selecting a card
export function getAIMove(aiHand: Card[], playerCard: Card | null, trumpSuit: Suit): Card {
  // If player hasn't played a card yet, play the lowest non-trump card
  if (!playerCard) {
    // Sort by value and prefer non-trump cards
    const sortedHand = [...aiHand].sort((a, b) => {
      // Prioritize non-trump cards
      if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
      if (a.suit !== trumpSuit && b.suit === trumpSuit) return -1;
      
      // Then sort by value (lowest first)
      return getCardValue(a) - getCardValue(b);
    });
    
    return sortedHand[0];
  }
  
  // If player has played, try to win with the lowest card possible
  const winningCards = aiHand.filter(card => {
    // Trump beats non-trump
    if (card.suit === trumpSuit && playerCard.suit !== trumpSuit) {
      return true;
    }
    
    // Same suit, higher value wins
    if (card.suit === playerCard.suit && getCardValue(card) > getCardValue(playerCard)) {
      return true;
    }
    
    return false;
  });
  
  if (winningCards.length > 0) {
    // Sort winning cards by value (lowest first)
    winningCards.sort((a, b) => getCardValue(a) - getCardValue(b));
    return winningCards[0];
  }
  
  // If can't win, play lowest value card
  const sortedHand = [...aiHand].sort((a, b) => getCardValue(a) - getCardValue(b));
  return sortedHand[0];
}