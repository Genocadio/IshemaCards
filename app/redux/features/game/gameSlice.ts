// redux/features/game/gameSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Card, Suit, PlayerType } from '@/lib/types';

interface GameState {
  gameStarted: boolean;
  gameOver: boolean;
  trumpSuit: Suit | '';
  trumpCard: Card | null;
  playerScore: number;
  aiScore: number;
  playerTotalValue: number;
  aiTotalValue: number;
  roundCount: number;
  isPlayerTurn: boolean;
  roundResult: string;
  lastRoundWinner: 'player' | 'ai' | null;
  roundInProgress: boolean;
  tieMode: boolean;
  tieStake: number;
  tiedCardValues: number;
  currentRoundFirstPlayer: 'player' | 'ai' | null;
  postGameQuestion: string;
  postGameAnswer: string;
  showPostGameQuestion: boolean;
  showPlayerQuestionInput: boolean;
  showGameStartInfo: boolean;
}

const initialState: GameState = {
  gameStarted: false,
  gameOver: false,
  trumpSuit: '',
  trumpCard: null,
  playerScore: 0,
  aiScore: 0,
  playerTotalValue: 0,
  aiTotalValue: 0,
  roundCount: 0,
  isPlayerTurn: true,
  roundResult: '',
  lastRoundWinner: null,
  roundInProgress: false,
  tieMode: false,
  tieStake: 0,
  tiedCardValues: 0,
  currentRoundFirstPlayer: null,
  postGameQuestion: '',
  postGameAnswer: '',
  showPostGameQuestion: false,
  showPlayerQuestionInput: false,
  showGameStartInfo: false,
};

// Define actions and reducers here
export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    startGame: (state) => {
      state.showGameStartInfo = true;
    },
    setGameStarted: (state, action: PayloadAction<boolean>) => {
      state.gameStarted = action.payload;
    },
    setGameOver: (state, action: PayloadAction<boolean>) => {
      state.gameOver = action.payload;
    },
    setTrumpSuit: (state, action: PayloadAction<Suit>) => {
      state.trumpSuit = action.payload;
    },
    setTrumpCard: (state, action: PayloadAction<Card>) => {
      state.trumpCard = action.payload;
    },
    updateScores: (state, action: PayloadAction<{ playerScore: number; aiScore: number }>) => {
      state.playerScore = action.payload.playerScore;
      state.aiScore = action.payload.aiScore;
    },
    updateTotalValues: (state, action: PayloadAction<{ playerTotalValue: number; aiTotalValue: number }>) => {
      state.playerTotalValue = action.payload.playerTotalValue;
      state.aiTotalValue = action.payload.aiTotalValue;
    },
    incrementRoundCount: (state) => {
      state.roundCount += 1;
    },
    setPlayerTurn: (state, action: PayloadAction<boolean>) => {
      state.isPlayerTurn = action.payload;
    },
    setRoundResult: (state, action: PayloadAction<string>) => {
      state.roundResult = action.payload;
    },
    setLastRoundWinner: (state, action: PayloadAction<'player' | 'ai' | null>) => {
      state.lastRoundWinner = action.payload;
    },
    setRoundInProgress: (state, action: PayloadAction<boolean>) => {
      state.roundInProgress = action.payload;
    },
    setTieMode: (state, action: PayloadAction<boolean>) => {
      state.tieMode = action.payload;
    },
    setTieStake: (state, action: PayloadAction<number>) => {
      state.tieStake = action.payload;
    },
    setTiedCardValues: (state, action: PayloadAction<number>) => {
      state.tiedCardValues = action.payload;
    },
    setCurrentRoundFirstPlayer: (state, action: PayloadAction<'player' | 'ai' | null>) => {
      state.currentRoundFirstPlayer = action.payload;
    },
    setPostGameQuestion: (state, action: PayloadAction<string>) => {
      state.postGameQuestion = action.payload;
    },
    setPostGameAnswer: (state, action: PayloadAction<string>) => {
      state.postGameAnswer = action.payload;
    },
    setShowPostGameQuestion: (state, action: PayloadAction<boolean>) => {
      state.showPostGameQuestion = action.payload;
    },
    setShowPlayerQuestionInput: (state, action: PayloadAction<boolean>) => {
      state.showPlayerQuestionInput = action.payload;
    },
    setShowGameStartInfo: (state, action: PayloadAction<boolean>) => {
      state.showGameStartInfo = action.payload;
    },
    resetGame: () => initialState,
  },
});

export const { 
  startGame, 
  setGameStarted, 
  setGameOver, 
  setTrumpSuit, 
  setTrumpCard,
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
  setShowGameStartInfo,
  resetGame 
} = gameSlice.actions;

export default gameSlice.reducer;