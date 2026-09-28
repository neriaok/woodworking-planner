import type { Axis, Box, FaceDir, Rotation, SceneNode, SizeMm, Vec3Mm } from '../types/scene';

export type SizeKey = keyof SizeMm;

/**
 * Which local dimension ends up along world x / y / z after rotation.
 *
 * three.js 'XYZ' Euler builds R = Rx · Ry · Rz, so a vector is rotated by Z first,
 * then Y, then X. A 90° turn swaps the two dimensions perpendicular to its axis.
 */
export const worldAxisLabels = (rotation: Rotation): [SizeKey, SizeKey, SizeKey] => {
  const labels: [SizeKey, SizeKey, SizeKey] = ['w', 'h', 'd'];
  const swap = (a: 0 | 1 | 2, b: 0 | 1 | 2): void => {
    [labels[a], labels[b]] = [labels[b], labels[a]];
  };
  if (rotation.z % 2 === 1) swap(0, 1);
  if (rotation.y % 2 === 1) swap(0, 2);
  if (rotation.x % 2 === 1) swap(1, 2);
  return labels;
};

export const AXES: readonly Axis[] = ['x', 'y', 'z'];
const axisIndex = (axis: Axis): 0 | 1 | 2 => (axis === 'x' ? 0 : axis === 'y' ? 1 : 2);

/** The local size key that currently lies along the given world axis. */
export const localKeyForAxis = (rotation: Rotation, axis: Axis): SizeKey =>
  worldAxisLabels(rotation)[axisIndex(axis)];

/** World-space extent of a piece after rotation. */
export const effectiveSize = (size: SizeMm, rotation: Rotation): Vec3Mm => {
  const [lx, ly, lz] = worldAxisLabels(rotation);
  return { x: size[lx], y: size[ly], z: size[lz] };
};

/** Inverse of effectiveSize: turn a world-space extent back into the local w/h/d. */
export const localSizeFromEffective = (size: Vec3Mm, rotation: Rotation): SizeMm => {
  const [lx, ly, lz] = worldAxisLabels(rotation);
  const local: SizeMm = { w: 0, h: 0, d: 0 };
  local[lx] = size.x;
  local[ly] = size.y;
  local[lz] = size.z;
  return local;
};

export const nodeBox =(node: Pick<SceneNode, 'positionMm' | 'sizeMm' | 'rotation'>): Box => ({
  min: { ...node.positionMm },
  size: effectiveSize(node.sizeMm, node.rotation),
});

export const boxMax = (box: Box, axis: Axis): number => box.min[axis] + box.size[axis];

export const boxCenter = (box: Box): Vec3Mm => ({
  x: box.min.x + box.size.x / 2,
  y: box.min.y + box.size.y / 2,
  z: box.min.z + box.size.z / 2,
});

/** Bounding box of several boxes, or null when empty. */
export const unionBox = (boxes: readonly Box[]): Box | null => {
  if (boxes.length === 0) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const box of boxes) {
    for (const axis of AXES) {
      min[axis] = Math.min(min[axis], box.min[axis]);
      max[axis] = Math.max(max[axis], boxMax(box, axis));
    }
  }
  return { min, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
};

export const faceAxis = (face: FaceDir): Axis => face[1] as Axis;
export const faceSign = (face: FaceDir): 1 | -1 => (face[0] === '+' ? 1 : -1);

/** Advance one axis of a rotation by a quarter turn. */
export const rotateQuarter = (rotation: Rotation, axis: Axis): Rotation => ({
  ...rotation,
  [axis]: ((rotation[axis] + 1) % 4) as Rotation[Axis],
});

/**
 * New min corner after a rotation change so the piece keeps its footprint centre
 * and its bottom height (it turns in place instead of jumping).
 */
export const positionAfterRotation = (before: Box, afterSize: Vec3Mm): Vec3Mm => {
  const center = boxCenter(before);
  return {
    x: Math.round(center.x - afterSize.x / 2),
    y: before.min.y,
    z: Math.round(center.z - afterSize.z / 2),
  };
};
