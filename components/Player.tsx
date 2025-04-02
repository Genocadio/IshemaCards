import React, { useState, useEffect } from 'react';
import CardComponent from './Card';
import { Card } from '../lib/types';

interface PlayerProps {
  hand: Card[];
  onCardPlay: (card: Card, index: number) => void;
  isPlayerTurn: boolean;
}

export default function Player({ hand, onCardPlay, isPlayerTurn }: PlayerProps) {
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Check if content is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (containerRef.current) {
        const { scrollWidth, clientWidth } = containerRef.current;
        setShowScrollIndicator(scrollWidth > clientWidth);
      }
    };
    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    return () => window.removeEventListener('resize', checkScrollable);
  }, [hand]);

  const handleCardClick = (card: Card, index: number) => {
    onCardPlay(card, index);
  };

  return (
    <div className="relative w-full bg-green-900 p-4 rounded-lg">
      <div className="w-full overflow-hidden">
        <div
          ref={containerRef}
          className="w-full overflow-x-auto scrollbar-hide"
          style={{
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <div className="flex gap-4 min-w-max">
            {hand.map((card, index) => (
              <div
                key={`${card.suit}-${card.value}-${index}`}
                className="flex-shrink-0 w-[80px]"
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
  
      {showScrollIndicator && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50" />
      )}
    </div>
  );
}