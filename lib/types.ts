export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type CardValue = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  value: CardValue;
}

export type PlayerType = 'player' | 'ai' | 'tie';