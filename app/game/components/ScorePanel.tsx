import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/redux/store';

export default function ScorePanel() {
  const { playerScore, aiScore } = useSelector((state: RootState) => state.game);

  return (
    <div className="flex justify-between bg-green-900 p-4 rounded-lg">
      <div>Player: {playerScore}</div>
      <div>AI: {aiScore}</div>
    </div>
  );
} 