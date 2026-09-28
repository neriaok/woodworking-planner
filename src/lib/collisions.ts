import type { Box } from '../types/scene';
import { AXES, boxMax } from './geometry';

/** Touching faces are allowed; only a real overlap deeper than this counts. */
export const COLLISION_EPSILON_MM = 0.5;

export const boxesOverlap = (a: Box, b: Box, eps = COLLISION_EPSILON_MM): boolean =>
  AXES.every(
    (axis) => a.min[axis] < boxMax(b, axis) - eps && b.min[axis] < boxMax(a, axis) - eps,
  );

/** True when the footprints (x/z projection) overlap. */
export const footprintsOverlap = (a: Box, b: Box, eps = COLLISION_EPSILON_MM): boolean =>
  (['x', 'z'] as const).every(
    (axis) => a.min[axis] < boxMax(b, axis) - eps && b.min[axis] < boxMax(a, axis) - eps,
  );

/** Ids of every box that overlaps at least one other box. */
export const findCollisions = (items: readonly { id: string; box: Box }[]): Set<string> => {
  const hits = new Set<string>();
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (boxesOverlap(items[i].box, items[j].box)) {
        hits.add(items[i].id);
        hits.add(items[j].id);
      }
    }
  }
  return hits;
};
