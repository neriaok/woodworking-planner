import { createSlice, nanoid, original, type PayloadAction } from '@reduxjs/toolkit';
import type { Axis, Box, Material, SceneNode, SizeMm, TextureMode, Vec3Mm } from '../../types/scene';
import {
  boxMax,
  effectiveSize,
  localSizeFromEffective,
  nodeBox,
  positionAfterRotation,
  rotateQuarter,
  unionBox,
} from '../../lib/geometry';
import { resolveHeight, scaleProportional, MIN_SIZE_MM } from '../../lib/snapping';

const HISTORY_LIMIT = 100;
/** Gap (mm) left between the scene and a newly added or duplicated piece. */
const PLACEMENT_GAP_MM = 100;

export interface SceneState {
  projectName: string;
  nodes: SceneNode[];
  past: SceneNode[][];
  future: SceneNode[][];
}

const piece = (
  id: string,
  name: string,
  sizeMm: SizeMm,
  positionMm: Vec3Mm,
  material: Material,
): SceneNode => ({
  id,
  name,
  type: 'piece',
  parentId: null,
  positionMm,
  rotation: { x: 0, y: 0, z: 0 },
  sizeMm,
  material,
});

/** A small example so the editor is not empty on first open: the kitchen-island idea. */
export const createDemoNodes = (): SceneNode[] => [
  piece('demo-dresser', 'שידה', { w: 1000, h: 850, d: 450 }, { x: -500, y: 0, z: -225 }, {
    type: 'preset',
    value: 'whiteMdf',
  }),
  piece('demo-top', 'משטח', { w: 1400, h: 40, d: 600 }, { x: -700, y: 850, z: -300 }, {
    type: 'preset',
    value: 'oak',
  }),
  piece('demo-board', 'קרש', { w: 1800, h: 20, d: 200 }, { x: 900, y: 0, z: -100 }, {
    type: 'preset',
    value: 'pine',
  }),
];

const initialState: SceneState = {
  projectName: 'אי מטבח',
  nodes: createDemoNodes(),
  past: [],
  future: [],
};

/** Snapshot the nodes as they were before this action, and drop the redo stack. */
const pushHistory = (state: SceneState): void => {
  const base = original(state);
  if (!base) return;
  state.past.push(base.nodes);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
};

const boxesExcept = (nodes: readonly SceneNode[], id: string | null): Box[] =>
  nodes.filter((n) => n.id !== id && !n.hidden).map(nodeBox);

/** Place a new piece on the floor in front of everything (towards the default camera). */
const placeInFront = (nodes: readonly SceneNode[], size: Vec3Mm): Vec3Mm => {
  const bounds = unionBox(nodes.map(nodeBox));
  if (!bounds) return { x: -Math.round(size.x / 2), y: 0, z: -Math.round(size.z / 2) };
  return { x: bounds.min.x, y: 0, z: boxMax(bounds, 'z') + PLACEMENT_GAP_MM };
};

const findNode = (state: SceneState, id: string): SceneNode | undefined =>
  state.nodes.find((n) => n.id === id);

export interface AddPiecePayload {
  id: string;
  name: string;
  sizeMm: SizeMm;
  material: Material;
}

const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    addPiece: {
      reducer: (state, action: PayloadAction<AddPiecePayload>) => {
        pushHistory(state);
        const { id, name, sizeMm, material } = action.payload;
        const size = effectiveSize(sizeMm, { x: 0, y: 0, z: 0 });
        state.nodes.push(piece(id, name, sizeMm, placeInFront(state.nodes, size), material));
      },
      prepare: (input: Omit<AddPiecePayload, 'id'>) => ({ payload: { ...input, id: nanoid() } }),
    },

    duplicatePiece: {
      reducer: (state, action: PayloadAction<{ id: string; newId: string }>) => {
        const source = findNode(state, action.payload.id);
        if (!source) return;
        pushHistory(state);
        const box = nodeBox(source);
        const moved: Box = {
          min: { x: boxMax(box, 'x') + PLACEMENT_GAP_MM, y: box.min.y, z: box.min.z },
          size: box.size,
        };
        const y = resolveHeight(moved, boxesExcept(state.nodes, null));
        state.nodes.push({
          ...source,
          rotation: { ...source.rotation },
          sizeMm: { ...source.sizeMm },
          id: action.payload.newId,
          name: `${source.name} (עותק)`,
          positionMm: { ...moved.min, y },
        });
      },
      prepare: (id: string) => ({ payload: { id, newId: nanoid() } }),
    },

    removePiece: (state, action: PayloadAction<string>) => {
      if (!findNode(state, action.payload)) return;
      pushHistory(state);
      state.nodes = state.nodes.filter((n) => n.id !== action.payload);
    },

    renamePiece: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const node = findNode(state, action.payload.id);
      if (!node || node.name === action.payload.name) return;
      pushHistory(state);
      node.name = action.payload.name;
    },

    setMaterial: (state, action: PayloadAction<{ id: string; material: Material }>) => {
      const node = findNode(state, action.payload.id);
      if (!node) return;
      pushHistory(state);
      node.material = action.payload.material;
    },

    setTextureMode: (state, action: PayloadAction<{ id: string; mode: TextureMode }>) => {
      const node = findNode(state, action.payload.id);
      if (!node || node.material.type !== 'photo' || node.material.textureMode === action.payload.mode) return;
      pushHistory(state);
      node.material.textureMode = action.payload.mode;
    },

    rotatePiece: (state, action: PayloadAction<{ id: string; axis: Axis }>) => {
      const node = findNode(state, action.payload.id);
      if (!node) return;
      pushHistory(state);
      const before = nodeBox(node);
      node.rotation = rotateQuarter(node.rotation, action.payload.axis);
      node.positionMm = positionAfterRotation(before, effectiveSize(node.sizeMm, node.rotation));
    },

    /** Set the world-space length along one axis (from the numeric panel). */
    setAxisLength: (
      state,
      action: PayloadAction<{ id: string; axis: Axis; lengthMm: number; proportional: boolean }>,
    ) => {
      const node = findNode(state, action.payload.id);
      if (!node) return;
      const { axis, proportional } = action.payload;
      const lengthMm = Math.max(MIN_SIZE_MM, Math.round(action.payload.lengthMm));
      const box = nodeBox(node);
      if (box.size[axis] === lengthMm) return;
      pushHistory(state);

      let next: Box;
      if (proportional) {
        next = scaleProportional(box, axis === 'y' ? '+y' : `+${axis}`, lengthMm);
        if (axis !== 'y') {
          // Keep the centre along the edited axis too, like the other axes.
          next.min[axis] = Math.round(box.min[axis] + box.size[axis] / 2 - next.size[axis] / 2);
        }
      } else {
        const size = { ...box.size, [axis]: lengthMm };
        const min = { ...box.min };
        if (axis !== 'y') min[axis] = Math.round(box.min[axis] + box.size[axis] / 2 - lengthMm / 2);
        next = { min, size };
      }
      node.positionMm = next.min;
      node.sizeMm = localSizeFromEffective(next.size, node.rotation);
    },

    /** Height of the piece's bottom above the floor. */
    setElevation: (state, action: PayloadAction<{ id: string; yMm: number }>) => {
      const node = findNode(state, action.payload.id);
      const y = Math.max(0, Math.round(action.payload.yMm));
      if (!node || node.positionMm.y === y) return;
      pushHistory(state);
      node.positionMm.y = y;
    },

    // --- Continuous gestures: checkpoint once, then apply transient updates. ---

    checkpoint: (state) => {
      pushHistory(state);
    },

    /** Drop the last checkpoint if the gesture ended without changing anything (a tap). */
    discardCheckpointIfUnchanged: (state) => {
      const base = original(state);
      if (base && base.past[base.past.length - 1] === base.nodes) state.past.pop();
    },

    movePieceTransient: (state, action: PayloadAction<{ id: string; positionMm: Vec3Mm }>) => {
      const node = findNode(state, action.payload.id);
      if (node) node.positionMm = action.payload.positionMm;
    },

    setBoxTransient: (state, action: PayloadAction<{ id: string; box: Box }>) => {
      const node = findNode(state, action.payload.id);
      if (!node) return;
      node.positionMm = action.payload.box.min;
      node.sizeMm = localSizeFromEffective(action.payload.box.size, node.rotation);
    },

    // --- Project & history ---

    newProject: (state) => {
      pushHistory(state);
      state.nodes = [];
    },

    loadDemo: (state) => {
      pushHistory(state);
      state.nodes = createDemoNodes();
    },

    renameProject: (state, action: PayloadAction<string>) => {
      state.projectName = action.payload;
    },

    undo: (state) => {
      const base = original(state);
      const previous = base?.past[base.past.length - 1];
      if (!base || !previous) return;
      state.past.pop();
      state.future.push(base.nodes);
      state.nodes = previous;
    },

    redo: (state) => {
      const base = original(state);
      const next = base?.future[base.future.length - 1];
      if (!base || !next) return;
      state.future.pop();
      state.past.push(base.nodes);
      state.nodes = next;
    },
  },
});

export const {
  addPiece,
  duplicatePiece,
  removePiece,
  renamePiece,
  setMaterial,
  setTextureMode,
  rotatePiece,
  setAxisLength,
  setElevation,
  checkpoint,
  discardCheckpointIfUnchanged,
  movePieceTransient,
  setBoxTransient,
  newProject,
  loadDemo,
  renameProject,
  undo,
  redo,
} = sceneSlice.actions;

export default sceneSlice.reducer;
