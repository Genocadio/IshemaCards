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
export function getCardValue(card: Card): number {
  const valueMap: { [key: string]: number } = {
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
  return valueMap[card.value] || 0;
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
  const value1 = getCardValue(card1);
  const value2 = getCardValue(card2);
  
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
    const originalValue1 = VALUES.indexOf(card1.value);
    const originalValue2 = VALUES.indexOf(card2.value);
    
    if (originalValue1 > originalValue2) {
      return 'player';
    } else if (originalValue2 > originalValue1) {
      return 'ai';
    }
  }
  
  return 'tie'; // Should never happen in this game with unique cards
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
      const valueA = getCardValue(a);
      const valueB = getCardValue(b);
      
      // If both have non-zero values, compare them
      if (valueA > 0 && valueB > 0) {
        return valueA - valueB;
      }
      
      // If one has zero value, it should be played first
      if (valueA === 0 && valueB > 0) return -1;
      if (valueB === 0 && valueA > 0) return 1;
      
      // If both have zero values, compare original values
      if (valueA === 0 && valueB === 0) {
        return VALUES.indexOf(a.value) - VALUES.indexOf(b.value);
      }
      
      return 0;
    });
    
    return sortedHand[0];
  }
  
  // If player has played, try to win with the lowest card possible
  const winningCards = aiHand.filter(card => {
    // Trump beats non-trump
    if (card.suit === trumpSuit && playerCard.suit !== trumpSuit) {
      return true;
    }
    
    // Same suit, compare values
    if (card.suit === playerCard.suit) {
      const cardValue = getCardValue(card);
      const playerValue = getCardValue(playerCard);
      
      // If both have non-zero values, compare them
      if (cardValue > 0 && playerValue > 0) {
        return cardValue > playerValue;
      }
      
      // If one has zero value, non-zero wins
      if (cardValue > 0 && playerValue === 0) {
        return true;
      }
      
      // If both have zero values, compare original values
      if (cardValue === 0 && playerValue === 0) {
        return VALUES.indexOf(card.value) > VALUES.indexOf(playerCard.value);
      }
    }
    
    return false;
  });
  
  if (winningCards.length > 0) {
    // Sort winning cards by value (lowest first)
    winningCards.sort((a, b) => {
      const valueA = getCardValue(a);
      const valueB = getCardValue(b);
      
      // If both have non-zero values, compare them
      if (valueA > 0 && valueB > 0) {
        return valueA - valueB;
      }
      
      // If one has zero value, it should be played first
      if (valueA === 0 && valueB > 0) return -1;
      if (valueB === 0 && valueA > 0) return 1;
      
      // If both have zero values, compare original values
      if (valueA === 0 && valueB === 0) {
        return VALUES.indexOf(a.value) - VALUES.indexOf(b.value);
      }
      
      return 0;
    });
    return winningCards[0];
  }
  
  // If can't win, play lowest value card
  const sortedHand = [...aiHand].sort((a, b) => {
    const valueA = getCardValue(a);
    const valueB = getCardValue(b);
    
    // If both have non-zero values, compare them
    if (valueA > 0 && valueB > 0) {
      return valueA - valueB;
    }
    
    // If one has zero value, it should be played first
    if (valueA === 0 && valueB > 0) return -1;
    if (valueB === 0 && valueA > 0) return 1;
    
    // If both have zero values, compare original values
    if (valueA === 0 && valueB === 0) {
      return VALUES.indexOf(a.value) - VALUES.indexOf(b.value);
    }
    
    return 0;
  });
  return sortedHand[0];
}