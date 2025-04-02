// redux/features/player/playerSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Card } from '@/lib/types';

interface PlayerState {
  playerHand: Card[];
  aiHand: Card[];
  playerCard: Card | null;
  aiCard: Card | null;
  playerQuestion: string;
}

const initialState: PlayerState = {
  playerHand: [],
  aiHand: [],
  playerCard: null,
  aiCard: null,
  playerQuestion: '',
};

export const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setPlayerHand: (state, action: PayloadAction<Card[]>) => {
      state.playerHand = action.payload;
    },
    setAIHand: (state, action: PayloadAction<Card[]>) => {
      state.aiHand = action.payload;
    },
    setPlayerCard: (state, action: PayloadAction<Card | null>) => {
      state.playerCard = action.payload;
    },
    setAICard: (state, action: PayloadAction<Card | null>) => {
      state.aiCard = action.payload;
    },
    removeCardFromPlayerHand: (state, action: PayloadAction<number>) => {
      state.playerHand = state.playerHand.filter((_, index) => index !== action.payload);
    },
    removeCardFromAIHand: (state, action: PayloadAction<number>) => {
      state.aiHand = state.aiHand.filter((_, index) => index !== action.payload);
    },
    setPlayerQuestion: (state, action: PayloadAction<string>) => {
      state.playerQuestion = action.payload;
    },
    resetPlayerState: () => initialState,
  },
});

export const {
  setPlayerHand,
  setAIHand,
  setPlayerCard,
  setAICard,
  removeCardFromPlayerHand,
  removeCardFromAIHand,
  setPlayerQuestion,
  resetPlayerState,
} = playerSlice.actions;

export default playerSlice.reducer;