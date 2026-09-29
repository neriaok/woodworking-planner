import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';
import { nodeBox, unionBox } from '../../lib/geometry';
import { findCollisions } from '../../lib/collisions';

export const selectNodes = (state: RootState) => state.scene.nodes;
export const selectCanUndo = (state: RootState) => state.scene.past.length > 0;
export const selectCanRedo = (state: RootState) => state.scene.future.length > 0;

export const selectSelectedNode = (state: RootState) =>
  state.scene.nodes.find((n) => n.id === state.editor.selectedId);

/** Visible pieces (groups have no geometry of their own). */
export const selectVisibleNodes = createSelector([selectNodes], (nodes) =>
  nodes.filter((n) => n.type === 'piece' && !n.hidden),
);

export const selectCollidingIds = createSelector([selectVisibleNodes], (nodes) =>
  findCollisions(nodes.map((n) => ({ id: n.id, box: nodeBox(n) }))),
);

export const selectSceneBounds = createSelector([selectVisibleNodes], (nodes) =>
  unionBox(nodes.map(nodeBox)),
);
