// app/game/components/GameBoard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/app/redux/store';
import { 
  startGameThunk, 
  playAICardThunk,
  handlePlayerQuestionAnswerThunk
} from '@/app/redux/features/game/gameThunks';
import { 
  resetGame,
  setGameStarted,
  setGameOver
} from '@/app/redux/features/game/gameSlice';
import { resetPlayerState } from '@/app/redux/features/player/playerSlice';
import SuitIcon from '@/components/SuitIcon';
import CardComponent from '@/components/Card';
import PlayerHand from '@/app/game/components/PlayerHand';
import { CARDS_PER_PLAYER } from '@/lib/constants';
import { Card } from '@/lib/types';


export default function GameBoard() {
  const dispatch = useDispatch<AppDispatch>();
  const [playerQuestion, setPlayerQuestion] = useState<string>('');
  
  const { 
    gameStarted, 
    gameOver, 
    showGameStartInfo,
    isPlayerTurn,
    roundInProgress,
    roundResult,
    tieMode,
    tieStake,
    tiedCardValues,
    postGameQuestion,
    postGameAnswer,
    showPostGameQuestion,
    showPlayerQuestionInput,
    playerTotalValue,
    aiTotalValue,
    trumpSuit,
    roundCount,
    playerScore,
    aiScore,
    lastRoundWinner
  } = useSelector((state: RootState) => state.game);

  const { playerHand, aiHand, playerCard, aiCard } = useSelector((state: RootState) => state.player);

  // Effect to handle AI turn
  useEffect(() => {
    if (gameStarted && !isPlayerTurn && !gameOver && !roundInProgress) {
      const timeoutId = setTimeout(() => {
        dispatch(playAICardThunk());
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [isPlayerTurn, gameStarted, gameOver, roundInProgress, dispatch]);

  const handleStartGame = () => {
    dispatch(startGameThunk());
  };

  const handleResetGame = () => {
    dispatch(resetGame());
    dispatch(resetPlayerState());
  };

  const handlePlayerQuestion = () => {
    if (playerQuestion.trim()) {
      dispatch(handlePlayerQuestionAnswerThunk({ isQuestion: true, text: playerQuestion }));
      setPlayerQuestion('');
    }
  };

  const handlePlayerAnswer = () => {
    if (playerQuestion.trim()) {
      dispatch(handlePlayerQuestionAnswerThunk({ isQuestion: false, text: playerQuestion }));
      setPlayerQuestion('');
    }
  };

  // Helper function to determine game winner based on card values
  const getGameWinner = (): string => {
    if (playerTotalValue > aiTotalValue) {
      return 'You Win!';
    } else if (aiTotalValue > playerTotalValue) {
      return 'AI Wins!';
    } else {
      return "It's a Tie!";
    }
  };

  // Helper function to determine the correct turn message
  const getTurnMessage = (): string => {
    if (gameOver) return "";

    if (roundInProgress) {
      return roundResult || "Resolving round...";
    }

    if (tieMode) {
      return `Tie-Breaker Round! ${tieStake} points at stake.`;
    }

    if (isPlayerTurn) {
      if (aiCard && !playerCard) {
        return "AI has played - Your turn now";
      }
      return "Your turn - Play a card";
    } else {
      return "AI's turn";
    }
  };

  return (
    <div className="min-h-screen bg-green-800 text-white p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-center mb-6">Ishema Cards</h1>

        {showGameStartInfo ? (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
            <div className="bg-green-900 p-8 rounded-lg max-w-md text-center">
              <h2 className="text-2xl font-bold mb-4">Game Starting</h2>
              <p className="text-xl mb-4">The trump suit for this game is:</p>
              <div className="flex justify-center mb-4">
                {trumpSuit && <SuitIcon suit={trumpSuit} size="lg" />}
              </div>
              <p className="text-lg">Trump cards will beat any card of another suit!</p>
            </div>
          </div>
        ) : !gameStarted ? (
          <div className="flex flex-col items-center justify-center space-y-6 bg-green-900 p-8 rounded-lg">
            <h2 className="text-2xl font-bold">Welcome to Card Duel!</h2>
            <p className="text-center max-w-md">
              A 2-player card game with trumps. Play with cards 3-7, J, Q, K, A against the AI!
            </p>
            <button
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
              onClick={handleStartGame}
            >
              Start Game
            </button>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            <div className="flex flex-wrap justify-between items-center bg-green-900 p-3 rounded-lg gap-2">
              <div className="flex items-center">
                <h2 className="text-base sm:text-lg font-semibold mr-2">Trump:</h2>
                <div className="flex items-center">
                  {trumpSuit && <SuitIcon suit={trumpSuit} size="md" />}
                </div>
              </div>
              <div className="flex items-center">
                <h2 className="text-base sm:text-lg font-semibold mr-2">Round:</h2>
                <p className="text-base sm:text-xl">{roundCount + 1} / {CARDS_PER_PLAYER}</p>
              </div>
              <div className="flex items-center">
                <h2 className="text-base sm:text-lg font-semibold mr-2">Rounds:</h2>
                <p className="text-base sm:text-xl">You {playerScore} - {aiScore} AI</p>
              </div>
              <div className="flex items-center">
                <p className="text-sm">Score: {playerTotalValue} - {aiTotalValue}</p>
              </div>
              {tieMode && (
                <div className="flex items-center">
                  <p className="text-sm font-bold text-yellow-300">
                    {tieStake} points at stake, {tiedCardValues} card value points
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-4">
              <h2 className="text-xl font-semibold">AI's Hand ({aiHand.length} cards)</h2>
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

            <div className="bg-green-900 p-4 rounded-lg text-center">
              {!gameOver && (
                <p className="text-xl font-bold">
                  {getTurnMessage()}
                </p>
              )}
              {roundResult && !gameOver && tieMode && (
                <p className="text-lg mt-2 text-yellow-300">
                  {roundResult}
                </p>
              )}
              {roundResult && !gameOver && !tieMode && !roundInProgress && lastRoundWinner && (
                <p className="text-lg mt-2">
                  {lastRoundWinner === 'player'
                    ? "AI will play first in the next round"
                    : "You will play first in the next round"}
                </p>
              )}
              {gameOver && (
                <div className="mt-4">
                  <h2 className="text-2xl font-bold mb-2">
                    {getGameWinner()}
                  </h2>
                  <p className="text-lg mb-4">Final Score: You {playerScore} - {aiScore} AI</p>
                  <p className="text-lg mb-4">Total Card Value: You {playerTotalValue} - {aiTotalValue} AI</p>

                  {showPostGameQuestion && (
                    <div className="bg-green-800 p-4 rounded-lg mb-4">
                      <h3 className="text-xl font-semibold mb-2">Post-Game Question</h3>
                      <p className="mb-2">Q: {postGameQuestion}</p>
                      {postGameAnswer && (
                        <p className="text-yellow-300">A: {postGameAnswer}</p>
                      )}
                    </div>
                  )}

                  {showPlayerQuestionInput && (
                    <div className="bg-green-800 p-4 rounded-lg mb-4">
                      <h3 className="text-xl font-semibold mb-2">
                        {playerTotalValue > aiTotalValue ? 'Ask AI a Question' : 'Answer AI\'s Question'}
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={playerQuestion}
                          onChange={(e) => setPlayerQuestion(e.target.value)}
                          placeholder={playerTotalValue > aiTotalValue ?
                            "Type your question..." :
                            "Type your answer..."}
                          className="flex-1 px-3 py-2 rounded bg-green-900 text-white placeholder-green-400"
                        />
                        <button
                          onClick={playerTotalValue > aiTotalValue ? handlePlayerQuestion : handlePlayerAnswer}
                          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
                        >
                          {playerTotalValue > aiTotalValue ? 'Ask' : 'Answer'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 justify-center">
                    <button
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded"
                      onClick={handleResetGame}
                    >
                      Play Again
                    </button>
                    <button
                      className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                      onClick={() => {
                        dispatch(setGameStarted(false));
                        dispatch(setGameOver(false));
                        handleResetGame();
                      }}
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-4">
              <h2 className="text-xl font-semibold">Your Hand ({playerHand.length} cards)</h2>
              <div className="h-32 flex justify-center items-center">
                {playerCard ? (
                  <CardComponent card={playerCard} isPlayable={false} />
                ) : (
                  <div className="text-lg">
                    {isPlayerTurn ? 'Select a card to play' : 'No card played yet'}
                  </div>
                )}
              </div>

              <div className="w-full overflow-hidden">
                <PlayerHand />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}