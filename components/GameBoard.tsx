// Updated tie handling logic to properly accumulate and award all values from tied rounds

import React, { useState, useEffect } from 'react';
import Player from './Player';
import CardComponent from './Card';
import SuitIcon from './SuitIcon';
import {
  createDeck,
  shuffleDeck,
  determineRoundWinner,
  getAIMove
} from '../lib/gameLogic';
import { SUITS, CARDS_PER_PLAYER } from '../lib/constants';
import { Card, Suit, CardValue, PlayerType } from '../lib/types';

export default function GameBoard() {
  // Game state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [trumpSuit, setTrumpSuit] = useState<Suit | ''>('');
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [aiHand, setAIHand] = useState<Card[]>([]);
  const [playerCard, setPlayerCard] = useState<Card | null>(null);
  const [aiCard, setAICard] = useState<Card | null>(null);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [aiScore, setAIScore] = useState<number>(0);
  const [playerTotalValue, setPlayerTotalValue] = useState<number>(0);
  const [aiTotalValue, setAITotalValue] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [roundResult, setRoundResult] = useState<string>('');
  const [lastRoundWinner, setLastRoundWinner] = useState<'player' | 'ai' | null>(null);
  const [showGameStartInfo, setShowGameStartInfo] = useState<boolean>(false);
  const [trumpCard, setTrumpCard] = useState<Card | null>(null);
  const [roundInProgress, setRoundInProgress] = useState<boolean>(false);
  // Add state for tie handling
  const [tieMode, setTieMode] = useState<boolean>(false);
  const [tieStake, setTieStake] = useState<number>(0);
  // Add accumulator for tied card values
  const [tiedCardValues, setTiedCardValues] = useState<number>(0);
  // Add state to track who played first in current round
  const [currentRoundFirstPlayer, setCurrentRoundFirstPlayer] = useState<'player' | 'ai' | null>(null);
  // Add new state for post-game Q&A
  const [postGameQuestion, setPostGameQuestion] = useState<string>('');
  const [postGameAnswer, setPostGameAnswer] = useState<string>('');
  const [showPostGameQuestion, setShowPostGameQuestion] = useState<boolean>(false);
  const [playerQuestion, setPlayerQuestion] = useState<string>('');
  const [showPlayerQuestionInput, setShowPlayerQuestionInput] = useState<boolean>(false);

  // Helper function to calculate card value - modified for new card set
  const calculateCardValue = (card: Card): number => {
    const valueMap: { [key: string]: number } = {
      'A': 11,
      'K': 10,
      'Q': 10,
      'J': 10,
      '7': 7,
      '6': 6,
      '5': 5,
      '4': 4,
      '3': 3
    };
    return valueMap[card.value] || 0;
  };

  // Start a new game
  const startGame = () => {
    // Create and shuffle deck with modified card set (3-7, A, K, Q, J)
    const deck = shuffleDeck(createCustomDeck());

    // Choose random trump suit and create a representative trump card
    const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
    setTrumpSuit(randomSuit);
    setTrumpCard({ suit: randomSuit, value: 'A' }); // Use Ace as visual representation

    // Deal cards
    const playerCards = deck.slice(0, CARDS_PER_PLAYER);
    const aiCards = deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2);

    setPlayerHand(playerCards);
    setAIHand(aiCards);
    setPlayerScore(0);
    setAIScore(0);
    setPlayerTotalValue(0);
    setAITotalValue(0);
    setRoundCount(0);
    setPlayerCard(null);
    setAICard(null);
    setLastRoundWinner(null);
    setRoundInProgress(false);
    setTieMode(false);
    setTieStake(0);
    setTiedCardValues(0);

    // Show trump card info before starting the game
    setShowGameStartInfo(true);

    setTimeout(() => {
      setShowGameStartInfo(false);
      setGameStarted(true);
      setGameOver(false);
      // First turn is random for the first round
      const firstTurn = Math.random() > 0.5;
      setIsPlayerTurn(firstTurn);
      // Set initial lastRoundWinner based on who plays first
      setLastRoundWinner(firstTurn ? 'ai' : 'player');
    }, 3000); // Show trump info for 3 seconds
  };

  // Function to create a custom deck with only 3-7 and face cards (A, K, Q, J)
  const createCustomDeck = (): Card[] => {
    const deck: Card[] = [];
    const cardValues = ['3', '4', '5', '6', '7', 'J', 'Q', 'K', 'A'];

    SUITS.forEach(suit => {
      cardValues.forEach(value => {
        deck.push({ suit, value: value as CardValue });
      });
    });

    return deck;
  };

  // Effect to handle AI turn when it's not player's turn
  useEffect(() => {
    // Only have AI play if the game has started, it's AI's turn, and the game isn't over
    if (gameStarted && !isPlayerTurn && !gameOver && !roundInProgress && roundCount < CARDS_PER_PLAYER) {
      // Add a small delay for better UX
      const timeoutId = setTimeout(() => {
        if (!trumpSuit) return;

        // Set current round first player if this is the first card played
        if (!playerCard && !aiCard) {
          setCurrentRoundFirstPlayer('ai');
        }

        const aiMove = getAIMove(aiHand, playerCard, trumpSuit);

        // Remove the card from AI's hand
        const newAIHand = aiHand.filter(c =>
          !(c.suit === aiMove.suit && c.value === aiMove.value)
        );
        setAIHand(newAIHand);

        // Set the AI's played card
        setAICard(aiMove);

        // If player has already played, resolve the round
        if (playerCard) {
          setRoundInProgress(true);
          setTimeout(() => resolveRound(playerCard, aiMove), 1000);
        } else {
          // Otherwise, it's player's turn
          setIsPlayerTurn(true);
        }
      }, 800);

      return () => clearTimeout(timeoutId);
    }
  }, [isPlayerTurn, gameStarted, gameOver, playerCard, trumpSuit, roundInProgress, roundCount]);

  // Handle player card play
  const handleCardPlay = (card: Card, index: number) => {
    if (!isPlayerTurn || gameOver || roundInProgress || roundCount >= CARDS_PER_PLAYER) return;

    // Set current round first player if this is the first card played
    if (!playerCard && !aiCard) {
      setCurrentRoundFirstPlayer('player');
    }

    // Remove the card from player's hand
    const newHand = [...playerHand];
    newHand.splice(index, 1);
    setPlayerHand(newHand);

    // Set the played card
    setPlayerCard(card);

    // If AI has already played, resolve the round
    if (aiCard) {
      setRoundInProgress(true);
      setTimeout(() => resolveRound(card, aiCard), 800);
    } else {
      // Otherwise, it's AI's turn
      setIsPlayerTurn(false);
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

  // Function to handle post-game questions and answers
  const handlePostGameQuestions = (
    winner: 'player' | 'ai',
    finalScore: { player: number; ai: number },
    totalValues: { player: number; ai: number },
    lastRoundCards: { player: Card; ai: Card }
  ) => {
    // Dummy questions for AI to ask player
    const aiQuestions = [
      "How do you feel about the game?",
      "What was your favorite moment?",
      "Would you like to play again?"
    ];

    // Randomly select a question
    const questionIndex = Math.floor(Math.random() * aiQuestions.length);
    const question = aiQuestions[questionIndex] || "Would you like to play again?";


    // Set the question in state
    setPostGameQuestion(question);
    setShowPostGameQuestion(true);

    // If AI won, show input for player's answer
    if (winner === 'ai') {
      setShowPlayerQuestionInput(true);
    }

    // Log the Q&A session
    console.log('\n=== Post-Game Q&A Session ===');
    console.log('Game Results:');
    console.log('Final Score:', finalScore);
    console.log('Total Card Values:', totalValues);
    console.log('Last Round Cards:', lastRoundCards);
    console.log('Game Winner:', getGameWinner());
    console.log('Total Rounds Played:', roundCount + 1);
    console.log(`\nQuestion from ${winner === 'player' ? 'Player' : 'AI'}:`, question);
    console.log('===========================\n');
  };

  // Function to handle player asking AI a question
  const handlePlayerQuestion = () => {
    if (playerQuestion.trim()) {
      // Generate a contextual response based on the question
      let aiResponse = 'I am an AI focused on playing card games. I aim to provide strategic and engaging gameplay.';

      // Simple keyword matching for more relevant responses
      if (playerQuestion.toLowerCase().includes('strategy')) {
        aiResponse = 'My strategy involves analyzing card values and prioritizing trump suits when possible.';
      } else if (playerQuestion.toLowerCase().includes('win') || playerQuestion.toLowerCase().includes('lost')) {
        aiResponse = playerTotalValue > aiTotalValue ?
          'I need to improve my strategy for next time!' :
          'I analyze patterns and calculate probabilities to maximize winning chances.';
      } else if (playerQuestion.toLowerCase().includes('favorite')) {
        aiResponse = 'As an AI, I don\'t have preferences, but I\'m designed to provide challenging gameplay.';
      }

      console.log('\n=== Player Question to AI ===');
      console.log('Question:', playerQuestion);
      console.log('AI Response:', aiResponse);
      console.log('===========================\n');

      // Show the answer in the UI
      setPostGameAnswer(aiResponse);
      setShowPostGameQuestion(true);
      setShowPlayerQuestionInput(false);
      setPlayerQuestion('');
    }
  };

  // Function to handle player's answer to AI's question
  const handlePlayerAnswer = () => {
    if (playerQuestion.trim()) {
      console.log('\n=== Player Answer to AI ===');
      console.log('AI Question:', postGameQuestion);
      console.log('Player Answer:', playerQuestion);
      console.log('===========================\n');

      // Show the answer in the UI
      setPostGameAnswer(playerQuestion);
      setShowPostGameQuestion(true);
      setShowPlayerQuestionInput(false);
      setPlayerQuestion('');
    }
  };

  // Reset game
  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setShowGameStartInfo(false);
    setPlayerHand([]);
    setAIHand([]);
    setPlayerCard(null);
    setAICard(null);
    setPlayerScore(0);
    setAIScore(0);
    setPlayerTotalValue(0);
    setAITotalValue(0);
    setRoundCount(0);
    setIsPlayerTurn(true);
    setRoundResult('');
    setTrumpSuit('');
    setLastRoundWinner(null);
    setTrumpCard(null);
    setRoundInProgress(false);
    setTieMode(false);
    setTieStake(0);
    setTiedCardValues(0);
    // Reset Q&A state
    setPostGameQuestion('');
    setPostGameAnswer('');
    setShowPostGameQuestion(false);
    setPlayerQuestion('');
    setShowPlayerQuestionInput(false);
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

  // Resolve the current round
  const resolveRound = (playerCardPlayed: Card, aiCardPlayed: Card) => {
    // TypeScript guard for trumpSuit being a valid Suit type
    if (!trumpSuit) return;

    const firstCard = currentRoundFirstPlayer === 'player' ? playerCardPlayed : aiCardPlayed;
    const secondCard = currentRoundFirstPlayer === 'player' ? aiCardPlayed : playerCardPlayed;

    let winner: PlayerType | null = null;

    // Check if second player followed suit
    const followedSuit = secondCard.suit === firstCard.suit;
    const secondPlayedTrump = secondCard.suit === trumpSuit;
    const firstPlayedTrump = firstCard.suit === trumpSuit;

    if (!followedSuit) {
      if (secondPlayedTrump && !firstPlayedTrump) {
        // Second player played trump while first didn't - second player wins
        winner = currentRoundFirstPlayer === 'player' ? 'ai' : 'player';
      } else {
        // Second player didn't follow suit and didn't play trump - first player wins
        winner = currentRoundFirstPlayer || null;
      }
    } else {
      // Both cards are same suit or both are trumps - compare values
      winner = determineRoundWinner(playerCardPlayed, aiCardPlayed, trumpSuit);
    }

    // Calculate total value of cards in this round
    const playerCardValue = calculateCardValue(playerCardPlayed);
    const aiCardValue = calculateCardValue(aiCardPlayed);
    const roundTotalValue = playerCardValue + aiCardValue;

    // Increment the stake for this round
    const currentStake = tieMode ? tieStake + 1 : 1;

    if (winner === 'player') {
      // Player wins the round and any accumulated tie stakes
      setPlayerScore(prevScore => prevScore + currentStake);

      // Add current round card values plus any accumulated tied card values
      const totalValueToAdd = roundTotalValue + tiedCardValues;
      setPlayerTotalValue(prevValue => prevValue + totalValueToAdd);

      const scoreMessage = currentStake > 1
        ? `You won this round and all ${currentStake} tie stake points! (${totalValueToAdd} card points)`
        : `You won this round! (${totalValueToAdd} card points)`;

      setRoundResult(scoreMessage);
      setLastRoundWinner('player');
      setTieMode(false);
      setTieStake(0);
      setTiedCardValues(0); // Reset tied card values
    } else if (winner === 'ai') {
      // AI wins the round and any accumulated tie stakes
      setAIScore(prevScore => prevScore + currentStake);

      // Add current round card values plus any accumulated tied card values
      const totalValueToAdd = roundTotalValue + tiedCardValues;
      setAITotalValue(prevValue => prevValue + totalValueToAdd);

      const scoreMessage = currentStake > 1
        ? `AI won this round and all ${currentStake} tie stake points! (${totalValueToAdd} card points)`
        : `AI won this round! (${totalValueToAdd} card points)`;

      setRoundResult(scoreMessage);
      setLastRoundWinner('ai');
      setTieMode(false);
      setTieStake(0);
      setTiedCardValues(0); // Reset tied card values
    } else {
      // It's a tie - enter tie mode and increase the stake
      setRoundResult(`This round is a tie! Another round will be played with ${roundTotalValue} more card points at stake.`);
      setTieMode(true);
      setTieStake(currentStake);
      // Accumulate tied card values
      setTiedCardValues(prevValue => prevValue + roundTotalValue);
    }

    // Always increment round count after both players have played
    if (roundCount < CARDS_PER_PLAYER) {
      setRoundCount(prevCount => {
        const newCount = prevCount + 1;
        console.log(`Moving to round ${newCount} of ${CARDS_PER_PLAYER}`);

        // Immediately check if we've reached the final round
        if (newCount >= CARDS_PER_PLAYER) {
          console.log('Final round reached');
        }

        return newCount;
      });
    }

    // Check for game end - when both players have no cards left and not in tie mode
    const isLastRound = playerHand.length === 0 && aiHand.length === 0;
    const isFinalRound = roundCount + 1 >= CARDS_PER_PLAYER;
    if ((isLastRound || isFinalRound) && !tieMode) {
      // Log final game results to console
      console.log('Game Over!');
      console.log('Final Score:', { player: playerScore, ai: aiScore });
      console.log('Total Card Values:', { player: playerTotalValue, ai: aiTotalValue });
      console.log('Last Round Cards:', { player: playerCardPlayed, ai: aiCardPlayed });
      console.log('Game Winner:', getGameWinner());

      // Determine winner for Q&A session
      const winner = playerTotalValue > aiTotalValue ? 'player' : 'ai';

      // Handle post-game questions immediately
      setTimeout(() => {
        setGameOver(true);
        setRoundInProgress(false);
        setPlayerCard(null);
        setAICard(null);
        setRoundCount(CARDS_PER_PLAYER);
        setIsPlayerTurn(false);


        // Moved inside to align with gameOver state
        handlePostGameQuestions(
          winner,
          { player: playerScore, ai: aiScore },
          { player: playerTotalValue, ai: aiTotalValue },
          { player: playerCardPlayed, ai: aiCardPlayed }
        );
      }, 1500);
    } else {
      // Set up next round after delay
      setTimeout(() => {
        setPlayerCard(null);
        setAICard(null);
        setRoundResult('');
        setRoundInProgress(false);

        // Set turn order based on winner and tie mode
        if (tieMode) {
          // In tie mode, the previous loser continues to play first
          setIsPlayerTurn(lastRoundWinner === 'ai');
        } else {
          // In normal mode, loser plays first
          setIsPlayerTurn(winner === 'ai');
        }

        // Reset current round first player
        setCurrentRoundFirstPlayer(null);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-green-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
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
              onClick={startGame}
            >
              Start Game
            </button>
          </div>
        ) : (
          <div className="space-y-6">
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
                      onClick={resetGame}
                    >
                      Play Again
                    </button>
                    <button
                      className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                      onClick={() => {
                        setGameStarted(false);
                        setGameOver(false);
                        resetGame();
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

              <Player
                hand={playerHand}
                onCardPlay={handleCardPlay}
                isPlayerTurn={isPlayerTurn && !gameOver && !roundInProgress}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}