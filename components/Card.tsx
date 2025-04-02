import React from 'react';
import { Card as CardType } from '../lib/types';
import Image from 'next/image';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isPlayable?: boolean;
}

export default function Card({ card, onClick, isPlayable = true }: CardProps) {
  const { suit, value } = card;
  
  // Convert suit to lowercase for the folder path
  const suitLower = suit.toLowerCase();
  
  return (
    <div 
      className={`relative w-20 h-32 rounded-lg shadow-md overflow-hidden
        ${isPlayable ? 'cursor-pointer hover:shadow-lg transform hover:-translate-y-1 transition-all' : 'opacity-90'}`}
      onClick={isPlayable ? onClick : undefined}
    >
      <Image
        src={`/cards/${suitLower}/${value}.webp`}
        alt={`${value} of ${suit}`}
        fill
        style={{ objectFit: 'cover' }}
        priority={isPlayable}
        sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw'
      />
    </div>
  );
}