import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/redux/store';
import CardComponent from '@/components/Card';

export default function PlayArea() {
  const { playerCard, aiCard } = useSelector((state: RootState) => state.player);
  const { roundResult, tieMode } = useSelector((state: RootState) => state.game);

  return (
    <div className="bg-green-900 p-4 rounded-lg">
      <h3 className="text-xl font-bold mb-2">Play Area</h3>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex gap-4 justify-center">
          {playerCard && <CardComponent card={playerCard} isPlayable={false} />}
          {aiCard && <CardComponent card={aiCard} isPlayable={false} />}
        </div>
        {roundResult && (
          <p className={`text-lg ${tieMode ? 'text-yellow-300' : ''}`}>
            {roundResult}
          </p>
        )}
      </div>
    </div>
  );
} 