// redux/features/game/gameThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../../store';
import { 
  startGame, 
  setTrumpSuit, 
  setTrumpCard, 
  setGameStarted,
  setGameOver,
  updateScores,
  updateTotalValues,
  incrementRoundCount,
  setPlayerTurn,
  setRoundResult,
  setLastRoundWinner,
  setRoundInProgress,
  setTieMode,
  setTieStake,
  setTiedCardValues,
  setCurrentRoundFirstPlayer,
  setPostGameQuestion,
  setPostGameAnswer,
  setShowPostGameQuestion,
  setShowPlayerQuestionInput,
  setShowGameStartInfo
} from './gameSlice';
import { setPlayerHand, setAIHand, setPlayerCard, setAICard, removeCardFromPlayerHand, removeCardFromAIHand } from '../player/playerSlice';
import { createCustomDeck, shuffleDeck, determineRoundWinner, getAIMove } from '@/lib/gameLogic';
import { SUITS, CARDS_PER_PLAYER } from '@/lib/constants';
import { Card, Suit, PlayerType } from '@/lib/types';

// Helper function to calculate card value
const calculateCardValue = (card: Card): number => {
  const valueMap: { [key: string]: number } = {
    'A': 11,
    '7': 10,
    'K': 4,
    'Q': 2,
    'J': 3,
    '6': 0,
    '5': 0,
    '4': 0,
    '3': 0
  };
  return valueMap[card.value] || 0;
};

// Start game thunk
export const startGameThunk = createAsyncThunk(
  'game/startGameThunk',
  async (_, { dispatch }) => {
    // Show game info panel
    dispatch(startGame());
    
    // Create and shuffle deck
    const deck = shuffleDeck(createCustomDeck());
    
    // Choose random trump suit
    const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)] as Suit;
    dispatch(setTrumpSuit(randomSuit));
    dispatch(setTrumpCard({ suit: randomSuit, value: 'A' }));
    
    // Deal cards
    const playerCards = deck.slice(0, CARDS_PER_PLAYER);
    const aiCards = deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2);
    
    dispatch(setPlayerHand(playerCards));
    dispatch(setAIHand(aiCards));
    
    // Set game started after delay
    setTimeout(() => {
      dispatch(setShowGameStartInfo(false));
      dispatch(setGameStarted(true));
      // Set initial turn order randomly
      const firstTurn = Math.random() > 0.5;
      dispatch(setPlayerTurn(firstTurn));
      // Set initial lastRoundWinner based on who plays first
      dispatch(setLastRoundWinner(firstTurn ? 'ai' : 'player'));
    }, 3000);
  }
);

// Handle player card play
export const playPlayerCardThunk = createAsyncThunk(
  'game/playPlayerCard',
  async ({ card, index }: { card: Card; index: number }, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { isPlayerTurn, roundInProgress, gameOver, roundCount } = state.game;
    const { aiCard } = state.player;

    if (!isPlayerTurn || gameOver || roundInProgress || roundCount >= CARDS_PER_PLAYER) return;

    // Set current round first player if this is the first card played
    if (!aiCard) {
      dispatch(setCurrentRoundFirstPlayer('player'));
    }

    // Remove the card from player's hand
    dispatch(removeCardFromPlayerHand(index));
    dispatch(setPlayerCard(card));

    // If AI has already played, resolve the round
    if (aiCard) {
      dispatch(setRoundInProgress(true));
      setTimeout(() => {
        dispatch(resolveRoundThunk({ playerCard: card, aiCard }));
      }, 800);
    } else {
      // Otherwise, it's AI's turn
      dispatch(setPlayerTurn(false));
    }
  }
);

// Handle AI turn
export const playAICardThunk = createAsyncThunk(
  'game/playAICard',
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { gameStarted, isPlayerTurn, gameOver, roundInProgress, roundCount, trumpSuit } = state.game;
    const { aiHand, playerCard } = state.player;

    if (!gameStarted || isPlayerTurn || gameOver || roundInProgress || roundCount >= CARDS_PER_PLAYER || !trumpSuit) return;

    // Set current round first player if this is the first card played
    if (!playerCard) {
      dispatch(setCurrentRoundFirstPlayer('ai'));
    }

    const aiMove = getAIMove(aiHand, playerCard, trumpSuit);
    
    // Find the index of the played card in the AI's hand
    const cardIndex = aiHand.findIndex(card => 
      card.suit === aiMove.suit && card.value === aiMove.value
    );

    // Remove the card from AI's hand and set it as the played card
    if (cardIndex !== -1) {
      dispatch(removeCardFromAIHand(cardIndex));
      dispatch(setAICard(aiMove));

      // If player has already played, resolve the round
      if (playerCard) {
        dispatch(setRoundInProgress(true));
        setTimeout(() => {
          dispatch(resolveRoundThunk({ playerCard, aiCard: aiMove }));
        }, 800);
      } else {
        // Otherwise, it's player's turn
        dispatch(setPlayerTurn(true));
      }
    }
  }
);

// Resolve round
export const resolveRoundThunk = createAsyncThunk(
  'game/resolveRound',
  async ({ playerCard, aiCard }: { playerCard: Card; aiCard: Card }, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { trumpSuit, currentRoundFirstPlayer, tieMode, tieStake, tiedCardValues } = state.game;
    const { playerScore, aiScore, playerTotalValue, aiTotalValue, roundCount } = state.game;

    if (!trumpSuit) return;

    const firstCard = currentRoundFirstPlayer === 'player' ? playerCard : aiCard;
    const secondCard = currentRoundFirstPlayer === 'player' ? aiCard : playerCard;

    let winner: PlayerType | null = null;

    // Check if second player followed suit
    const followedSuit = secondCard.suit === firstCard.suit;
    const secondPlayedTrump = secondCard.suit === trumpSuit;
    const firstPlayedTrump = firstCard.suit === trumpSuit;

    if (!followedSuit) {
      if (secondPlayedTrump && !firstPlayedTrump) {
        winner = currentRoundFirstPlayer === 'player' ? 'ai' : 'player';
      } else {
        winner = currentRoundFirstPlayer || null;
      }
    } else {
      winner = determineRoundWinner(playerCard, aiCard, trumpSuit);
    }

    // Calculate total value of cards in this round
    const playerCardValue = calculateCardValue(playerCard);
    const aiCardValue = calculateCardValue(aiCard);
    const roundTotalValue = playerCardValue + aiCardValue;

    // Increment the stake for this round
    const currentStake = tieMode ? tieStake + 1 : 1;

    if (winner === 'player') {
      dispatch(updateScores({ playerScore: playerScore + currentStake, aiScore }));
      dispatch(updateTotalValues({ 
        playerTotalValue: playerTotalValue + roundTotalValue + tiedCardValues, 
        aiTotalValue 
      }));

      const scoreMessage = currentStake > 1
        ? `You won this round and all ${currentStake} tie stake points! (${roundTotalValue + tiedCardValues} card points)`
        : `You won this round! (${roundTotalValue + tiedCardValues} card points)`;

      dispatch(setRoundResult(scoreMessage));
      dispatch(setLastRoundWinner('player'));
      dispatch(setTieMode(false));
      dispatch(setTieStake(0));
      dispatch(setTiedCardValues(0));
    } else if (winner === 'ai') {
      dispatch(updateScores({ playerScore, aiScore: aiScore + currentStake }));
      dispatch(updateTotalValues({ 
        playerTotalValue, 
        aiTotalValue: aiTotalValue + roundTotalValue + tiedCardValues 
      }));

      const scoreMessage = currentStake > 1
        ? `AI won this round and all ${currentStake} tie stake points! (${roundTotalValue + tiedCardValues} card points)`
        : `AI won this round! (${roundTotalValue + tiedCardValues} card points)`;

      dispatch(setRoundResult(scoreMessage));
      dispatch(setLastRoundWinner('ai'));
      dispatch(setTieMode(false));
      dispatch(setTieStake(0));
      dispatch(setTiedCardValues(0));
    } else {
      dispatch(setRoundResult(`This round is a tie! Another round will be played with ${roundTotalValue} more card points at stake.`));
      dispatch(setTieMode(true));
      dispatch(setTieStake(currentStake));
      dispatch(setTiedCardValues(tiedCardValues + roundTotalValue));
    }

    // Always increment round count after both players have played
    if (roundCount < CARDS_PER_PLAYER) {
      dispatch(incrementRoundCount());
    }

    // Check for game end
    const isLastRound = roundCount + 1 >= CARDS_PER_PLAYER;
    if (isLastRound && !tieMode) {
      setTimeout(() => {
        dispatch(setGameOver(true));
        dispatch(setRoundInProgress(false));
        dispatch(setPlayerCard(null));
        dispatch(setAICard(null));
        dispatch(handlePostGameQuestionsThunk());
      }, 1500);
    } else {
      // Set up next round after delay
      setTimeout(() => {
        dispatch(setPlayerCard(null));
        dispatch(setAICard(null));
        dispatch(setRoundResult(''));
        dispatch(setRoundInProgress(false));

        // Set turn order based on winner and tie mode
        if (tieMode) {
          dispatch(setPlayerTurn(state.game.lastRoundWinner === 'ai'));
        } else {
          dispatch(setPlayerTurn(winner === 'ai'));
        }

        dispatch(setCurrentRoundFirstPlayer(null));
      }, 1500);
    }
  }
);

// Handle post-game questions
export const handlePostGameQuestionsThunk = createAsyncThunk(
  'game/handlePostGameQuestions',
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { playerTotalValue, aiTotalValue } = state.game;

    // Dummy questions for AI to ask player
    const aiQuestions = [
      "How do you feel about the game?",
      "What was your favorite moment?",
      "Would you like to play again?"
    ];

    // Randomly select a question
    const questionIndex = Math.floor(Math.random() * aiQuestions.length);
    const question = aiQuestions[questionIndex] || "Would you like to play again?";

    dispatch(setPostGameQuestion(question));
    dispatch(setShowPostGameQuestion(true));

    // If AI won, show input for player's answer
    if (playerTotalValue <= aiTotalValue) {
      dispatch(setShowPlayerQuestionInput(true));
    }
  }
);

// Handle player question/answer
export const handlePlayerQuestionAnswerThunk = createAsyncThunk(
  'game/handlePlayerQuestionAnswer',
  async ({ isQuestion, text }: { isQuestion: boolean; text: string }, { dispatch, getState }) => {
    if (text.trim()) {
      const state = getState() as RootState;
      const { playerTotalValue, aiTotalValue } = state.game;

      if (isQuestion) {
        // Generate a contextual response based on the question
        let aiResponse = 'I am an AI focused on playing card games. I aim to provide strategic and engaging gameplay.';

        // Simple keyword matching for more relevant responses
        if (text.toLowerCase().includes('strategy')) {
          aiResponse = 'My strategy involves analyzing card values and prioritizing trump suits when possible.';
        } else if (text.toLowerCase().includes('win') || text.toLowerCase().includes('lost')) {
          aiResponse = playerTotalValue > aiTotalValue ?
            'I need to improve my strategy for next time!' :
            'I analyze patterns and calculate probabilities to maximize winning chances.';
        } else if (text.toLowerCase().includes('favorite')) {
          aiResponse = 'As an AI, I don\'t have preferences, but I\'m designed to provide challenging gameplay.';
        }

        dispatch(setPostGameAnswer(aiResponse));
      } else {
        dispatch(setPostGameAnswer(text));
      }

      dispatch(setShowPostGameQuestion(true));
      dispatch(setShowPlayerQuestionInput(false));
    }
  }
);

// Add other thunks for complex game operations