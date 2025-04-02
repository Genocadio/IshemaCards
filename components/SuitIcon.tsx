import React from 'react';
import { Suit } from '../lib/types';

interface SuitIconProps {
  suit: Suit;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export default function SuitIcon({ suit, size = 'md', color = 'currentColor' }: SuitIconProps) {
  const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
      case 'Hearts':
        return '♥';
      case 'Diamonds':
        return '♦';
      case 'Clubs':
        return '♣';
      case 'Spades':
        return '♠';
      default:
        return '';
    }
  };

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl'
  };

  return (
    <span 
      className={`${sizeClasses[size]} font-bold`}
      style={{ 
        color: suit === 'Hearts' || suit === 'Diamonds' ? 'red' : color 
      }}
    >
      {getSuitSymbol(suit)}
    </span>
  );
} 