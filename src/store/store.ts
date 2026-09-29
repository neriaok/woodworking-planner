import { configureStore } from '@reduxjs/toolkit';
import sceneReducer from '../features/scene/sceneSlice';
import editorReducer from '../features/editor/editorSlice';
import libraryReducer from '../features/library/librarySlice';

export const store = configureStore({
  reducer: {
    scene: sceneReducer,
    editor: editorReducer,
    library: libraryReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
