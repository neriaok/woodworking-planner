import type { Axis, Box, FaceDir, Vec3Mm } from '../types/scene';
import { boxesOverlap, footprintsOverlap } from './collisions';
import { boxMax, faceAxis, faceSign } from './geometry';

export interface SnapOptions {
  /** Grid step in mm, or null when grid snapping is off. */
  gridMm: number | null;
  /** How close (mm) a face/edge must be before it snaps to a neighbour. */
  thresholdMm: number;
}

export const DEFAULT_SNAP: SnapOptions = { gridMm: 10, thresholdMm: 40 };

/** Smallest allowed extent of a piece along any axis (mm). */
export const MIN_SIZE_MM = 5;

const roundTo = (value: number, step: number | null): number =>
  step ? Math.round(value / step) * step : Math.round(value);

const closestWithin = (value: number, candidates: number[], threshold: number): number | null => {
  let best: number | null = null;
  let bestDist = threshold;
  for (const candidate of candidates) {
    const dist = Math.abs(candidate - value);
    if (dist <= bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
};

/**
 * Snap a proposed min coordinate on one horizontal axis:
 * face-to-face (touching a neighbour) or edge alignment (flush sides), else the grid.
 */
export const snapAxisPosition = (
  proposedMin: number,
  size: number,
  axis: Axis,
  others: readonly Box[],
  options: SnapOptions,
): number => {
  const candidates: number[] = [];
  for (const other of others) {
    const oMin = other.min[axis];
    const oMax = boxMax(other, axis);
    candidates.push(oMax, oMin - size, oMin, oMax - size);
  }
  const snapped = closestWithin(proposedMin, candidates, options.thresholdMm);
  return snapped ?? roundTo(proposedMin, options.gridMm);
};

/**
 * Resolve the height for a piece at a new footprint position:
 * - if it would sink into something, it pops up onto the highest thing it hits;
 * - otherwise it rests on the highest surface below it (or the floor).
 */
export const resolveHeight = (moving: Box, others: readonly Box[]): number => {
  const below = others.filter((other) => footprintsOverlap(moving, other));
  let y = moving.min.y;

  for (let i = 0; i < below.length + 1; i += 1) {
    const candidate: Box = { min: { ...moving.min, y }, size: moving.size };
    const hits = below.filter((other) => boxesOverlap(candidate, other));
    if (hits.length === 0) break;
    y = Math.max(...hits.map((hit) => boxMax(hit, 'y')));
  }

  const supports = below
    .map((other) => boxMax(other, 'y'))
    .filter((top) => top <= y + 0.5);
  return Math.max(0, ...supports);
};

/** Full move snap: x/z against neighbours or grid, then height by stacking rules. */
export const snapMove = (
  moving: Box,
  proposed: { x: number; z: number },
  others: readonly Box[],
  options: SnapOptions = DEFAULT_SNAP,
): Vec3Mm => {
  const x = snapAxisPosition(proposed.x, moving.size.x, 'x', others, options);
  const z = snapAxisPosition(proposed.z, moving.size.z, 'z', others, options);
  const y = resolveHeight({ min: { x, y: moving.min.y, z }, size: moving.size }, others);
  return { x, y, z };
};

/**
 * Drag one face of a box to a proposed world coordinate. The opposite face stays put.
 * The moved face snaps to neighbour faces, otherwise to the grid.
 */
export const snapResize = (
  box: Box,
  face: FaceDir,
  proposedCoord: number,
  others: readonly Box[],
  options: SnapOptions = DEFAULT_SNAP,
): Box => {
  const axis = faceAxis(face);
  const sign = faceSign(face);
  const candidates = others.flatMap((other) => [other.min[axis], boxMax(other, axis)]);
  const coord =
    closestWithin(proposedCoord, candidates, options.thresholdMm) ??
    roundTo(proposedCoord, options.gridMm);

  const min = { ...box.min };
  const size = { ...box.size };
  if (sign === 1) {
    size[axis] = Math.max(MIN_SIZE_MM, coord - box.min[axis]);
  } else {
    const max = boxMax(box, axis);
    const newMin = Math.min(coord, max - MIN_SIZE_MM);
    min[axis] = newMin;
    size[axis] = max - newMin;
  }
  return { min, size };
};

/**
 * Scale a box uniformly so that `axis` becomes `newLength`.
 * Along `axis` the face opposite `face` stays fixed; the bottom stays on its support;
 * the remaining horizontal axis keeps its centre.
 */
export const scaleProportional = (box: Box, face: FaceDir, newLength: number): Box => {
  const axis = faceAxis(face);
  const factor = Math.max(MIN_SIZE_MM, newLength) / box.size[axis];
  const size = {
    x: Math.max(MIN_SIZE_MM, Math.round(box.size.x * factor)),
    y: Math.max(MIN_SIZE_MM, Math.round(box.size.y * factor)),
    z: Math.max(MIN_SIZE_MM, Math.round(box.size.z * factor)),
  };
  const min = { ...box.min };
  for (const a of ['x', 'z'] as const) {
    if (a === axis) {
      if (faceSign(face) === -1) min[a] = boxMax(box, a) - size[a];
    } else {
      min[a] = Math.round(box.min[a] + box.size[a] / 2 - size[a] / 2);
    }
  }
  return { min, size };
};
