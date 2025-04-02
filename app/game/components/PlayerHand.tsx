import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/app/redux/store';
import { playPlayerCardThunk } from '@/app/redux/features/game/gameThunks';
import Player from '@/components/Player';

export default function PlayerHand() {
  const dispatch = useDispatch<AppDispatch>();
  const { playerHand } = useSelector((state: RootState) => state.player);
  const { isPlayerTurn, gameOver, roundInProgress } = useSelector((state: RootState) => state.game);

  const handleCardPlay = (card: any, index: number) => {
    dispatch(playPlayerCardThunk({ card, index }));
  };

  return (
    <div className="w-full max-w-full overflow-hidden bg-green-900 p-4 rounded-lg">
      <h3 className="text-xl font-bold mb-2">Your Hand ({playerHand.length} cards)</h3>
      <div className="w-full overflow-hidden">
        <Player
          hand={playerHand}
          onCardPlay={handleCardPlay}
          isPlayerTurn={isPlayerTurn && !gameOver && !roundInProgress}
        />
      </div>
    </div>
  );
} 