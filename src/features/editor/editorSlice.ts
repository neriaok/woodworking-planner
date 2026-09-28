import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { addPiece, duplicatePiece, newProject, removePiece } from '../scene/sceneSlice';

export type Tool = 'move' | 'rotate' | 'resize' | 'split';
export type ViewMode = 'free' | 'front' | 'side' | 'top';

export interface EditorState {
  selectedId: string | null;
  tool: Tool;
  view: ViewMode;
  /** Bumped on every view request so choosing the same view again re-frames the camera. */
  viewRequest: number;
  gridSnap: boolean;
  lockProportions: boolean;
  showHuman: boolean;
  showDimensions: boolean;
  /** True while a piece or handle is being dragged (camera controls pause). */
  isDragging: boolean;
}

const initialState: EditorState = {
  selectedId: 'demo-top',
  tool: 'move',
  view: 'free',
  viewRequest: 0,
  gridSnap: true,
  lockProportions: false,
  showHuman: true,
  showDimensions: true,
  isDragging: false,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
    setTool: (state, action: PayloadAction<Tool>) => {
      state.tool = action.payload;
    },
    requestView: (state, action: PayloadAction<ViewMode>) => {
      state.view = action.payload;
      state.viewRequest += 1;
    },
    toggleGridSnap: (state) => {
      state.gridSnap = !state.gridSnap;
    },
    toggleLockProportions: (state) => {
      state.lockProportions = !state.lockProportions;
    },
    toggleHuman: (state) => {
      state.showHuman = !state.showHuman;
    },
    toggleDimensions: (state) => {
      state.showDimensions = !state.showDimensions;
    },
    setDragging: (state, action: PayloadAction<boolean>) => {
      state.isDragging = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addPiece, (state, action) => {
        state.selectedId = action.payload.id;
      })
      .addCase(duplicatePiece, (state, action) => {
        state.selectedId = action.payload.newId;
      })
      .addCase(removePiece, (state, action) => {
        if (state.selectedId === action.payload) state.selectedId = null;
      })
      .addCase(newProject, (state) => {
        state.selectedId = null;
      });
  },
});

export const {
  selectPiece,
  setTool,
  requestView,
  toggleGridSnap,
  toggleLockProportions,
  toggleHuman,
  toggleDimensions,
  setDragging,
} = editorSlice.actions;

export default editorSlice.reducer;
