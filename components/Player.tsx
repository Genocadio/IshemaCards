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
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Check if device is mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Calculate the number of rows and cards per row
  const getRowConfig = () => {
    const totalCards = hand.length;
    if (totalCards <= 12) {
      return { rows: 2, cardsPerRow: 6 };
    } else if (totalCards <= 16) {
      return { rows: 2, cardsPerRow: 8 };
    } else if (totalCards <= 18) {
      return { rows: 3, cardsPerRow: 6 };
    } else if (totalCards <= 24) {
      return { rows: 3, cardsPerRow: 8 };
    } else {
      return { rows: 3, cardsPerRow: 9 };
    }
  };

  // Split hand into rows based on total number of cards
  const getRows = () => {
    const { rows, cardsPerRow } = getRowConfig();
    const result = [];
    
    for (let i = 0; i < rows; i++) {
      const start = i * cardsPerRow;
      const end = Math.min(start + cardsPerRow, hand.length);
      if (start < hand.length) {
        result.push(hand.slice(start, end));
      }
    }

    return result;
  };

  const rows = getRows();
  const { cardsPerRow } = getRowConfig();

  return (
    <div className="relative w-full bg-green-900 p-4 rounded-lg">
      <div className="w-full overflow-hidden">
        {isMobile ? (
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
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-wrap justify-center gap-4">
                {row.map((card, index) => {
                  const globalIndex = rowIndex * cardsPerRow + index;
                  return (
                    <div
                      key={`${card.suit}-${card.value}-${globalIndex}`}
                      className="w-[80px]"
                      onClick={() => handleCardClick(card, globalIndex)}
                    >
                      <CardComponent
                        card={card}
                        onClick={() => {}}
                        isPlayable={isPlayerTurn}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
  
      {showScrollIndicator && isMobile && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50" />
      )}
    </div>
  );
}