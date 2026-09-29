import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';
import { nodeBox, unionBox } from '../../lib/geometry';
import { findCollisions } from '../../lib/collisions';
import { isOpeningBlocked } from '../../lib/motion';
import { memberPieces, orientationOf, otherBoxes } from '../../lib/sceneTree';
import type { Box, Rotation, SceneNode } from '../../types/scene';

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

export interface MotionTarget {
  owner: SceneNode;
  memberIds: string[];
  box: Box;
  rotation: Rotation;
  blocked: boolean;
}

/** Every door/drawer with its pieces, closed bounds, and whether something blocks it. */
export const selectMotionTargets = createSelector([selectNodes], (nodes): MotionTarget[] =>
  nodes
    .filter((n) => n.motion)
    .flatMap((owner) => {
      const members = memberPieces(nodes, owner.id).filter((m) => !m.hidden);
      const box = unionBox(members.map(nodeBox));
      if (!box || !owner.motion) return [];
      const rotation = orientationOf(nodes, owner);
      const blocked = isOpeningBlocked(members.map(nodeBox), rotation, owner.motion, otherBoxes(nodes, owner.id));
      return [{ owner, memberIds: members.map((m) => m.id), box, rotation, blocked }];
    }),
);

export const selectHiddenCount = (state: RootState) =>
  state.scene.nodes.filter((n) => n.type === 'piece' && n.hidden).length;
