import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/redux/store';
import CardComponent from '@/components/Card';

export default function AIHand() {
  const { aiHand, aiCard } = useSelector((state: RootState) => state.player);
  const { isPlayerTurn } = useSelector((state: RootState) => state.game);

  return (
    <div className="bg-green-900 p-4 rounded-lg">
      <h3 className="text-xl font-bold mb-2">AI's Hand ({aiHand.length} cards)</h3>
      <div className="h-32 flex justify-center items-center">
        {aiCard ? (
          <CardComponent card={aiCard} isPlayable={false} />
        ) : (
          <div className="text-lg">
            {!isPlayerTurn ? "AI is thinking..." : "No card played yet"}
          </div>
        )}
      </div>
    </div>
  );
} 