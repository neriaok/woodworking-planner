import type { Axis, Box, Crop, Material, Rotation, SceneNode, SizeMm, Vec3Mm } from '../types/scene';
import { AXES, localAxisForWorld, localSizeFromEffective, nodeBox, rotateWorld, type SizeKey } from './geometry';
import { MIN_SIZE_MM } from './snapping';

const FULL_CROP: Crop = { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
const CROP_AXIS: Record<SizeKey, 'x' | 'y' | 'z'> = { w: 'x', h: 'y', d: 'z' };

/** A new piece description (without id), produced by a split. */
export type PieceDraft = Omit<SceneNode, 'id' | 'parentId'>;

/**
 * Carve a sub-box (world space, inside the piece) out of a piece. The result keeps the
 * piece's rotation and material; a photo material gets a crop so the right part of the
 * photo stays on the right part of the wood.
 */
export const subPiece = (piece: SceneNode, sub: Box, name: string): PieceDraft => {
  const box = nodeBox(piece);
  let material: Material = piece.material;

  if (material.type === 'photo') {
    const parentCrop = material.crop ?? FULL_CROP;
    const crop: Crop = { ...parentCrop };
    for (const axis of AXES) {
      const { key, sign } = localAxisForWorld(piece.rotation, axis);
      let f0 = (sub.min[axis] - box.min[axis]) / box.size[axis];
      let f1 = f0 + sub.size[axis] / box.size[axis];
      if (sign < 0) [f0, f1] = [1 - f1, 1 - f0];
      const c = CROP_AXIS[key];
      const lo = parentCrop[`${c}0`];
      const span = parentCrop[`${c}1`] - lo;
      crop[`${c}0`] = lo + span * f0;
      crop[`${c}1`] = lo + span * f1;
    }
    material = { ...material, crop };
  }

  return {
    name,
    type: 'piece',
    positionMm: { ...sub.min },
    rotation: { ...piece.rotation },
    sizeMm: localSizeFromEffective(sub.size, piece.rotation),
    material,
  };
};

/** Cut a piece in two, perpendicular to a world axis, `offsetMm` from its low side. */
export const cutPiece = (piece: SceneNode, axis: Axis, offsetMm: number): [PieceDraft, PieceDraft] | null => {
  const box = nodeBox(piece);
  const at = Math.round(offsetMm);
  if (at < MIN_SIZE_MM || at > box.size[axis] - MIN_SIZE_MM) return null;
  const lowSize = { ...box.size, [axis]: at };
  const highMin = { ...box.min, [axis]: box.min[axis] + at };
  const highSize = { ...box.size, [axis]: box.size[axis] - at };
  return [
    subPiece(piece, { min: { ...box.min }, size: lowSize }, `${piece.name} א׳`),
    subPiece(piece, { min: highMin, size: highSize }, `${piece.name} ב׳`),
  ];
};

/**
 * Convert a box given in the piece's own frame (mm from its local min corner along w/h/d,
 * where +d is the piece's front) into a world-space box.
 */
export const localBoxToWorld = (piece: SceneNode, localMin: SizeMm, localSize: SizeMm): Box => {
  const box = nodeBox(piece);
  const min = { x: 0, y: 0, z: 0 };
  const size = { x: 0, y: 0, z: 0 };
  for (const axis of AXES) {
    const { key, sign } = localAxisForWorld(piece.rotation, axis);
    size[axis] = localSize[key];
    min[axis] =
      sign > 0
        ? box.min[axis] + localMin[key]
        : box.min[axis] + box.size[axis] - localMin[key] - localSize[key];
  }
  return { min, size };
};

export interface PanelOptions {
  thicknessMm: number;
  top: boolean;
  bottom: boolean;
  sides: boolean;
  back: boolean;
  front: boolean;
}

/**
 * Turn a solid box into the boards of a cabinet carcass. Top and bottom span the full
 * width and depth; sides fit between them; back and front fit between the sides.
 */
export const panelize = (piece: SceneNode, options: PanelOptions): PieceDraft[] => {
  const { w, h, d } = piece.sizeMm;
  const t = Math.max(MIN_SIZE_MM, Math.round(options.thicknessMm));
  const out: PieceDraft[] = [];
  const add = (name: string, min: SizeMm, size: SizeMm): void => {
    if (size.w < MIN_SIZE_MM || size.h < MIN_SIZE_MM || size.d < MIN_SIZE_MM) return;
    out.push(subPiece(piece, localBoxToWorld(piece, min, size), name));
  };

  const yLow = options.bottom ? t : 0;
  const yHigh = options.top ? h - t : h;
  const innerH = yHigh - yLow;
  const xLow = options.sides ? t : 0;
  const xHigh = options.sides ? w - t : w;
  const innerW = xHigh - xLow;

  if (options.top) add('עליון', { w: 0, h: h - t, d: 0 }, { w, h: t, d });
  if (options.bottom) add('תחתון', { w: 0, h: 0, d: 0 }, { w, h: t, d });
  if (options.sides) {
    add('דופן שמאל', { w: 0, h: yLow, d: 0 }, { w: t, h: innerH, d });
    add('דופן ימין', { w: w - t, h: yLow, d: 0 }, { w: t, h: innerH, d });
  }
  if (options.back) add('גב', { w: xLow, h: yLow, d: 0 }, { w: innerW, h: innerH, d: t });
  if (options.front) add('חזית', { w: xLow, h: yLow, d: d - t }, { w: innerW, h: innerH, d: t });
  return out;
};

/**
 * Split a piece into a grid of full-depth blocks along lines drawn on its front:
 * `xs` are fractions across the front (0 = left), `ys` fractions down it (0 = top).
 */
export const splitByFrontLines = (piece: SceneNode, xs: readonly number[], ys: readonly number[]): PieceDraft[] => {
  const { w, h, d } = piece.sizeMm;
  const clean = (values: readonly number[]): number[] =>
    [...new Set(values.map((v) => Math.min(1, Math.max(0, v))))].sort((a, b) => a - b).filter((v) => v > 0 && v < 1);
  const xCuts = [0, ...clean(xs), 1].map((f) => Math.round(f * w));
  const yCuts = [0, ...clean(ys), 1].map((f) => Math.round(f * h));
  const out: PieceDraft[] = [];
  const rows = yCuts.length - 1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < xCuts.length - 1; c += 1) {
      const top = yCuts[r];
      const bottom = yCuts[r + 1];
      const size: SizeMm = { w: xCuts[c + 1] - xCuts[c], h: bottom - top, d };
      if (size.w < MIN_SIZE_MM || size.h < MIN_SIZE_MM) continue;
      const min: SizeMm = { w: xCuts[c], h: h - bottom, d: 0 };
      const label = rows > 1 && xCuts.length === 2 ? `${piece.name} ${r + 1}` : `${piece.name} ${out.length + 1}`;
      out.push(subPiece(piece, localBoxToWorld(piece, min, size), label));
    }
  }
  return out;
};

/** Position of every member after turning a group a quarter turn about its vertical centre line. */
export const rotateGroupMembers = (
  members: readonly SceneNode[],
  groupBox: Box,
): { id: string; positionMm: Vec3Mm; rotation: Rotation }[] => {
  const cx = groupBox.min.x + groupBox.size.x / 2;
  const cz = groupBox.min.z + groupBox.size.z / 2;
  return members.map((m) => {
    const b = nodeBox(m);
    const rx = b.min.x + b.size.x / 2 - cx;
    const rz = b.min.z + b.size.z / 2 - cz;
    // +90° about Y (three.js): (x, z) → (z, −x); the footprint swaps x and z extents.
    const ncx = cx + rz;
    const ncz = cz - rx;
    return {
      id: m.id,
      positionMm: {
        x: Math.round(ncx - b.size.z / 2),
        y: b.min.y,
        z: Math.round(ncz - b.size.x / 2),
      },
      rotation: rotateWorld(m.rotation, 'y'),
    };
  });
};
