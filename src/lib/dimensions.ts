import type { SizeMm } from '../types/scene';
import { roundToHalfCm } from './units';

export type PhotoFace = 'front' | 'back' | 'left' | 'right' | 'top';
export type DimKey = keyof SizeMm;

/** What a photo of each face tells us: which two dimensions its width and height are. */
export const FACE_AXES: Record<PhotoFace, { across: DimKey; up: DimKey }> = {
  front: { across: 'w', up: 'h' },
  back: { across: 'w', up: 'h' },
  left: { across: 'd', up: 'h' },
  right: { across: 'd', up: 'h' },
  top: { across: 'w', up: 'd' },
};

export const FACE_LABELS: Record<PhotoFace, string> = {
  front: 'חזית',
  back: 'גב',
  left: 'צד שמאל',
  right: 'צד ימין',
  top: 'למעלה',
};

export const DIM_LABELS: Record<DimKey, string> = { w: 'רוחב', h: 'גובה', d: 'עומק' };

export interface FaceMeasurement {
  face: PhotoFace;
  /** Perspective-corrected width/height of the face in the photo. */
  aspect: number;
  /** Absolute size from a reference sheet on the face, when one was marked. */
  measuredMm?: { widthMm: number; heightMm: number };
}

export type DimSource = 'manual' | 'reference' | 'photo';

export interface DimensionSolution {
  size: Partial<SizeMm>;
  source: Partial<Record<DimKey, DimSource>>;
  /** Faces whose photographed proportions disagree with the result by more than the tolerance. */
  conflicts: { face: PhotoFace; expected: number; actual: number }[];
}

/** Relative disagreement allowed between photos before we warn (hand-marked corners are rough). */
export const CONFLICT_TOLERANCE = 0.1;

/**
 * Combine manual values, reference measurements and photographed proportions into one size.
 * Priority: what the user typed › what an A4 reference measured › ratios propagated from photos.
 */
export const solveDimensions = (
  faces: readonly FaceMeasurement[],
  manual: Partial<SizeMm>,
): DimensionSolution => {
  const size: Partial<SizeMm> = {};
  const source: Partial<Record<DimKey, DimSource>> = {};

  for (const key of ['w', 'h', 'd'] as const) {
    const value = manual[key];
    if (value !== undefined && value > 0) {
      size[key] = value;
      source[key] = 'manual';
    }
  }

  for (const f of faces) {
    if (!f.measuredMm) continue;
    const { across, up } = FACE_AXES[f.face];
    if (size[across] === undefined) {
      size[across] = roundToHalfCm(f.measuredMm.widthMm);
      source[across] = 'reference';
    }
    if (size[up] === undefined) {
      size[up] = roundToHalfCm(f.measuredMm.heightMm);
      source[up] = 'reference';
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const f of faces) {
      const { across, up } = FACE_AXES[f.face];
      const a = size[across];
      const u = size[up];
      if (a !== undefined && u === undefined) {
        size[up] = roundToHalfCm(a / f.aspect);
        source[up] = 'photo';
        changed = true;
      } else if (u !== undefined && a === undefined) {
        size[across] = roundToHalfCm(u * f.aspect);
        source[across] = 'photo';
        changed = true;
      }
    }
  }

  const conflicts: DimensionSolution['conflicts'] = [];
  for (const f of faces) {
    const { across, up } = FACE_AXES[f.face];
    const a = size[across];
    const u = size[up];
    if (a === undefined || u === undefined) continue;
    const actual = a / u;
    if (Math.abs(actual - f.aspect) / f.aspect > CONFLICT_TOLERANCE) {
      conflicts.push({ face: f.face, expected: f.aspect, actual });
    }
  }

  return { size, source, conflicts };
};
