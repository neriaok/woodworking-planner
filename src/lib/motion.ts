import type { Axis, Box, Motion, Rotation, Vec3Mm } from '../types/scene';
import { AXES, boxMax, localAxisForWorld } from './geometry';
import { boxesOverlap } from './collisions';

/**
 * Doors (hinges) and drawers (slides). Pieces are stored closed; opening is a
 * rigid transform applied on top, computed here from the piece's own front direction.
 */

export type HingeSide = 'left' | 'right' | 'top' | 'bottom';

export interface MotionTransform {
  /** Rotation about a world-aligned axis through `pivot` (hinges). */
  pivot: Vec3Mm;
  axis: Axis;
  angle: number;
  /** Translation applied after the rotation (slides), mm. */
  offset: Vec3Mm;
}

const ZERO: Vec3Mm = { x: 0, y: 0, z: 0 };

/** World axis and direction that a local axis (w/h/d) points along. */
const worldOf = (rotation: Rotation, key: 'w' | 'h' | 'd'): { axis: Axis; sign: 1 | -1 } => {
  for (const axis of AXES) {
    const local = localAxisForWorld(rotation, axis);
    if (local.key === key) return { axis, sign: local.sign };
  }
  return { axis: 'z', sign: 1 };
};

/** The world direction the piece's front (+d) faces. */
export const frontDirection = (rotation: Rotation): { axis: Axis; sign: 1 | -1 } => worldOf(rotation, 'd');

/** Rotate point p about a world-aligned axis through pivot (right-handed, like three.js). */
export const rotateAbout = (p: Vec3Mm, pivot: Vec3Mm, axis: Axis, angle: number): Vec3Mm => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = p.x - pivot.x;
  const y = p.y - pivot.y;
  const z = p.z - pivot.z;
  if (axis === 'x') return { x: p.x, y: pivot.y + y * c - z * s, z: pivot.z + y * s + z * c };
  if (axis === 'y') return { x: pivot.x + x * c + z * s, y: p.y, z: pivot.z - x * s + z * c };
  return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c, z: p.z };
};

const center = (box: Box): Vec3Mm => ({
  x: box.min.x + box.size.x / 2,
  y: box.min.y + box.size.y / 2,
  z: box.min.z + box.size.z / 2,
});

/**
 * The transform that opens `box` by `amount` (0 closed … 1 fully open).
 * `rotation` is the orientation of the moving piece(s), which defines front/left/top.
 */
export const motionTransform = (box: Box, rotation: Rotation, motion: Motion, amount: number): MotionTransform => {
  const t = Math.min(1, Math.max(0, amount));
  const front = frontDirection(rotation);
  const frontCoord = front.sign > 0 ? boxMax(box, front.axis) : box.min[front.axis];

  if (motion.type === 'slide') {
    const offset = { ...ZERO, [front.axis]: front.sign * motion.distanceMm * t };
    return { pivot: center(box), axis: 'y', angle: 0, offset };
  }

  const across = worldOf(rotation, 'w');
  const up = worldOf(rotation, 'h');
  // left = local −w, right = +w, bottom = −h, top = +h
  const edge = motion.side === 'left' || motion.side === 'right' ? across : up;
  const positive = motion.side === 'right' || motion.side === 'top';
  const onMax = positive === edge.sign > 0;
  const edgeCoord = onMax ? boxMax(box, edge.axis) : box.min[edge.axis];
  const hingeAxis = motion.side === 'left' || motion.side === 'right' ? up.axis : across.axis;

  const pivot = { ...center(box), [front.axis]: frontCoord, [edge.axis]: edgeCoord };
  const maxAngle = (motion.maxAngleDeg * Math.PI) / 180;

  // Swing outwards: pick the direction that moves the door's centre towards its front.
  const probe = rotateAbout(center(box), pivot, hingeAxis, 0.1);
  const outwards = (probe[front.axis] - center(box)[front.axis]) * front.sign > 0 ? 1 : -1;
  return { pivot, axis: hingeAxis, angle: outwards * maxAngle * t, offset: ZERO };
};

/** Axis-aligned bounds of a box after applying a motion transform. */
export const transformedBox = (box: Box, m: MotionTransform): Box => {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < 8; i += 1) {
    const corner = {
      x: box.min.x + (i & 1 ? box.size.x : 0),
      y: box.min.y + (i & 2 ? box.size.y : 0),
      z: box.min.z + (i & 4 ? box.size.z : 0),
    };
    const r = rotateAbout(corner, m.pivot, m.axis, m.angle);
    for (const a of AXES) {
      const v = r[a] + m.offset[a];
      min[a] = Math.min(min[a], v);
      max[a] = Math.max(max[a], v);
    }
  }
  return { min, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
};

/**
 * Does anything block the opening? Samples the path from closed to fully open and
 * checks the moving boxes against every other box (ignoring ones already touching
 * it when closed, like the cabinet around a drawer).
 */
export const isOpeningBlocked = (
  moving: readonly Box[],
  rotation: Rotation,
  motion: Motion,
  others: readonly Box[],
  steps = 6,
): boolean => {
  const bounds = moving.reduce<Box | null>((acc, b) => {
    if (!acc) return b;
    const min = { x: Math.min(acc.min.x, b.min.x), y: Math.min(acc.min.y, b.min.y), z: Math.min(acc.min.z, b.min.z) };
    const max = {
      x: Math.max(boxMax(acc, 'x'), boxMax(b, 'x')),
      y: Math.max(boxMax(acc, 'y'), boxMax(b, 'y')),
      z: Math.max(boxMax(acc, 'z'), boxMax(b, 'z')),
    };
    return { min, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
  }, null);
  if (!bounds) return false;
  const candidates = others.filter((o) => !moving.some((m) => boxesOverlap(m, o, -0.5)));
  for (let i = 1; i <= steps; i += 1) {
    const m = motionTransform(bounds, rotation, motion, i / steps);
    for (const piece of moving) {
      const moved = transformedBox(piece, m);
      if (candidates.some((o) => boxesOverlap(moved, o, 2))) return true;
    }
  }
  return false;
};

export const defaultMotion = (kind: 'door' | 'drawer', box: Box, rotation: Rotation): Motion => {
  if (kind === 'drawer') {
    const depth = box.size[frontDirection(rotation).axis];
    return { type: 'slide', distanceMm: Math.round(depth * 0.75) };
  }
  return { type: 'hinge', side: 'left', maxAngleDeg: 100 };
};
