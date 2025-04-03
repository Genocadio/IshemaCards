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

export const createCustomDeck = (): Card[] => {
  const deck: Card[] = [];
  const cardValues = ['3', '4', '5', '6', '7', 'J', 'Q', 'K', 'A'];

  SUITS.forEach(suit => {
    cardValues.forEach(value => {
      deck.push({ suit, value: value as CardValue });
    });
  });

  return deck;
};

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
export function getCardValue(card: Card, trumpSuit: Suit, includeTrumpBonus: boolean = false): number {
  const baseValueMap: { [key: string]: number } = {
    'A': 11,
    '7': 10,
    'K': 4,
    'Q': 2,
    'J': 3,
    '6': 0,
    '5': 0,
    '4': 0,
    '3': 0
  };

  const value = baseValueMap[card.value] ?? 0;
  return includeTrumpBonus && card.suit === trumpSuit ? value + 20 : value;
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
  
  // If both or neither are trump, compare values using new value system
  const value1 = getCardValue(card1, trumpSuit, true); // Include trump bonus for comparison
  const value2 = getCardValue(card2, trumpSuit, true); // Include trump bonus for comparison
  
  // If both cards have non-zero values, compare them
  if (value1 > 0 && value2 > 0) {
    if (value1 > value2) {
      return 'player';
    } else if (value2 > value1) {
      return 'ai';
    }
  }
  
  // If one card has zero value and the other doesn't, non-zero wins
  if (value1 > 0 && value2 === 0) {
    return 'player';
  }
  if (value2 > 0 && value1 === 0) {
    return 'ai';
  }
  
  // If both cards have zero value, compare their original values
  if (value1 === 0 && value2 === 0) {
    // Define the order of zero-value cards (higher number = higher value)
    const zeroValueOrder: { [key: string]: number } = {
      '6': 4,
      '5': 3,
      '4': 2,
      '3': 1
    };
    
    const order1 = zeroValueOrder[card1.value] || 0;
    const order2 = zeroValueOrder[card2.value] || 0;
    
    if (order1 > order2) {
      return 'player';
    } else if (order2 > order1) {
      return 'ai';
    }
  }
  
  return 'tie'; // Should only happen if both cards are exactly the same
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';

// AI logic for selecting a card with difficulty levels
export function getAIMove(aiHand: Card[], playerCard: Card | null, trumpSuit: Suit, difficulty: AIDifficulty = 'medium'): Card {
  // Sort cards by value (lowest to highest) without trump bonus for initial sorting
  const sorted = [...aiHand].sort((a, b) => 
    getCardValue(a, trumpSuit, false) - getCardValue(b, trumpSuit, false)
  );

  if (!playerCard) {
    // When going first, strategy varies by difficulty
    switch (difficulty) {
      case 'easy': {
        // Easy: Always play lowest card
        return sorted[0];
      }
      
      case 'medium': {
        // Medium: Prefer non-scoring cards but may play scoring cards
        const nonScoring = sorted.filter(card => ['3', '4', '5', '6'].includes(card.value));
        return nonScoring.length > 0 ? nonScoring[0] : sorted[0];
      }
      
      case 'hard': {
        // Hard: Strategic first move
        const trumpCards = sorted.filter(c => c.suit === trumpSuit);
        const nonScoring = sorted.filter(card => ['3', '4', '5', '6'].includes(card.value));
        
        // If we have high trump cards, save them
        if (trumpCards.length > 0 && getCardValue(trumpCards[0], trumpSuit, false) > 0) {
          // Play lowest non-scoring if available
          if (nonScoring.length > 0) return nonScoring[0];
          // Otherwise play lowest non-trump
          const nonTrump = sorted.filter(c => c.suit !== trumpSuit);
          return nonTrump.length > 0 ? nonTrump[0] : sorted[0];
        }
        
        // If no high trump cards, play lowest non-scoring
        return nonScoring.length > 0 ? nonScoring[0] : sorted[0];
      }
    }
  }

  // When going second, try to win the round
  const sameSuit = sorted.filter(c => c.suit === playerCard.suit);
  const trumpCards = sorted.filter(c => c.suit === trumpSuit);
  const playerValue = getCardValue(playerCard, trumpSuit, false);

  switch (difficulty) {
    case 'easy': {
      // Easy: Basic strategy, just try to follow suit or play trump
      if (sameSuit.length > 0) return sameSuit[0];
      if (trumpCards.length > 0) return trumpCards[0];
      return sorted[0];
    }
    
    case 'medium': {
      // Medium: Try to win with lowest possible card
      for (const c of sameSuit) {
        if (getCardValue(c, trumpSuit, false) > playerValue) {
          return c;
        }
      }
      if (trumpCards.length > 0 && playerCard.suit !== trumpSuit) {
        return trumpCards[0];
      }
      const nonScoring = sorted.filter(card => ['3', '4', '5', '6'].includes(card.value));
      return nonScoring.length > 0 ? nonScoring[0] : sorted[0];
    }
    
    case 'hard': {
      // Hard: Advanced strategy
      // 1. Try to win with lowest possible card of same suit
      for (const c of sameSuit) {
        if (getCardValue(c, trumpSuit, false) > playerValue) {
          return c;
        }
      }
      
      // 2. If can't follow suit, consider trump strategy
      if (trumpCards.length > 0) {
        // If player played trump, only play higher trump
        if (playerCard.suit === trumpSuit) {
          for (const c of trumpCards) {
            if (getCardValue(c, trumpSuit, false) > playerValue) {
              return c;
            }
          }
        } else {
          // If player didn't play trump, use lowest trump
          return trumpCards[0];
        }
      }
      
      // 3. If can't win, play lowest non-scoring card
      const nonScoring = sorted.filter(card => ['3', '4', '5', '6'].includes(card.value));
      if (nonScoring.length > 0) {
        // In hard mode, prefer to keep higher non-scoring cards
        return nonScoring[nonScoring.length - 1];
      }
      
      // 4. As last resort, play lowest value card
      return sorted[0];
    }
  }
}