import { configureStore } from '@reduxjs/toolkit';
import sceneReducer from '../features/scene/sceneSlice';
import editorReducer from '../features/editor/editorSlice';

export const store = configureStore({
  reducer: {
    scene: sceneReducer,
    editor: editorReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
