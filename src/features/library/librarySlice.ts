import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LibraryItem } from '../../lib/projectFile';

/** The inventory: parts the user owns, saved once and reusable in any project. */
export interface LibraryState {
  items: LibraryItem[];
  loaded: boolean;
}

const initialState: LibraryState = { items: [], loaded: false };

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    setLibrary: (state, action: PayloadAction<LibraryItem[]>) => {
      state.items = action.payload;
      state.loaded = true;
    },
    addLibraryItem: (state, action: PayloadAction<LibraryItem>) => {
      state.items.unshift(action.payload);
    },
    removeLibraryItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
  },
});

export const { setLibrary, addLibraryItem, removeLibraryItem } = librarySlice.actions;
export default librarySlice.reducer;
