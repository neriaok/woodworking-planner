import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Axis } from '../../types/scene';
import {
  addPiece,
  duplicatePiece,
  groupNodes,
  newProject,
  removePiece,
  replaceWithPieces,
  setHidden,
  ungroup,
} from '../scene/sceneSlice';

export type Tool = 'move' | 'rotate' | 'resize' | 'split' | 'motion';
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
  /** Picking pieces to group with the anchor: taps toggle pieces instead of selecting. */
  pickMode: { anchorId: string; picked: string[] } | null;
  /** Where a cut would go, shown as a plane in the scene while the split tool is open. */
  cutPreview: { id: string; axis: Axis; offsetMm: number } | null;
  /** See-through mode: fixed pieces turn translucent so doors, drawers and insides show. */
  xray: boolean;
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
  pickMode: null,
  cutPreview: null,
  xray: false,
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
    startPicking: (state, action: PayloadAction<string>) => {
      state.pickMode = { anchorId: action.payload, picked: [action.payload] };
    },
    togglePicked: (state, action: PayloadAction<string>) => {
      if (!state.pickMode) return;
      const { picked } = state.pickMode;
      state.pickMode.picked = picked.includes(action.payload)
        ? picked.filter((id) => id !== action.payload)
        : [...picked, action.payload];
    },
    cancelPicking: (state) => {
      state.pickMode = null;
    },
    toggleXray: (state) => {
      state.xray = !state.xray;
    },
    setCutPreview: (state, action: PayloadAction<EditorState['cutPreview']>) => {
      state.cutPreview = action.payload;
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
      })
      .addCase(groupNodes, (state, action) => {
        state.selectedId = action.payload.groupId;
        state.pickMode = null;
      })
      .addCase(ungroup, (state) => {
        state.selectedId = null;
      })
      .addCase(setHidden, (state, action) => {
        if (action.payload.hidden && state.selectedId === action.payload.id) state.selectedId = null;
      })
      .addCase(replaceWithPieces, (state, action) => {
        // Select the first new piece; its group is one tap away.
        state.selectedId = action.payload.ids[0] ?? null;
        state.cutPreview = null;
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
  startPicking,
  togglePicked,
  cancelPicking,
  setCutPreview,
  toggleXray,
} = editorSlice.actions;

export default editorSlice.reducer;
