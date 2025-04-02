import React, { useState, useEffect } from 'react';
import CardComponent from './Card';
import { Card } from '../lib/types';

interface PlayerProps {
  hand: Card[];
  onCardPlay: (card: Card, index: number) => void;
  isPlayerTurn: boolean;
}

export default function Player({ hand, onCardPlay, isPlayerTurn }: PlayerProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCardClick = (card: Card, index: number) => {
    onCardPlay(card, index);
  };

  if (isMobile) {
    return (
      <div className="relative w-full overflow-hidden">
        <div className="flex justify-center items-center">
          <div
            className="flex items-center space-x-4 overflow-x-auto py-8 px-12"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              scrollSnapType: 'x mandatory',
            }}
          >
            {hand.map((card, index) => (
              <div 
                key={`${card.suit}-${card.value}-${index}`}
                className="flex-shrink-0 scroll-snap-align-center"
                onClick={() => handleCardClick(card, index)}
              >
                <CardComponent 
                  card={card} 
                  onClick={() => {}}
                  isPlayable={isPlayerTurn}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-4 p-4">
      {hand.map((card, index) => (
        <div 
          key={`${card.suit}-${card.value}-${index}`}
          onClick={() => handleCardClick(card, index)}
        >
          <CardComponent 
            card={card} 
            onClick={() => {}}
            isPlayable={isPlayerTurn}
          />
        </div>
      ))}
    </div>
  );
}