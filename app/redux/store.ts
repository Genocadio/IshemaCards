import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './features/game/gameSlice';
import playerReducer from './features/player/playerSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    player: playerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;