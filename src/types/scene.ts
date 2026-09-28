/** All lengths are integer millimetres. The 3D scene renders 1 unit = 1 cm. */
export type Mm = number;

export interface Vec3Mm {
  x: Mm;
  y: Mm;
  z: Mm;
}

/** Local (unrotated) size of a piece: width (x), height (y), depth (z). */
export interface SizeMm {
  w: Mm;
  h: Mm;
  d: Mm;
}

export type Axis = 'x' | 'y' | 'z';
export type QuarterTurns = 0 | 1 | 2 | 3;

/** Rotation in 90° steps around each axis (applied as a three.js 'XYZ' Euler). */
export interface Rotation {
  x: QuarterTurns;
  y: QuarterTurns;
  z: QuarterTurns;
}

export type MaterialPresetId = 'pine' | 'oak' | 'whiteMdf' | 'plywood';

export type Material =
  | { type: 'preset'; value: MaterialPresetId }
  | { type: 'color'; value: string };

export type Motion =
  | { type: 'hinge'; side: 'left' | 'right' | 'top' | 'bottom'; maxAngleDeg: number }
  | { type: 'slide'; distanceMm: Mm };

export interface SceneNode {
  id: string;
  name: string;
  type: 'piece' | 'group';
  parentId: string | null;
  /**
   * Minimum corner of the node's world-space bounding box.
   * Because rotations are always 90° steps, every piece is axis-aligned,
   * so this corner plus the effective size fully describes its volume.
   */
  positionMm: Vec3Mm;
  rotation: Rotation;
  sizeMm: SizeMm;
  material: Material;
  sourcePartId?: string;
  motion?: Motion;
  openAmount?: number;
  hidden?: boolean;
}

/** Axis-aligned box in world space (mm). */
export interface Box {
  min: Vec3Mm;
  /** Effective (rotated) extent along world x / y / z. */
  size: Vec3Mm;
}

/** A face handle direction used for resizing. */
export type FaceDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
