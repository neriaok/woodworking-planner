/**
 * Planar perspective math for turning a photographed face into a flat, square-on image.
 * Pure functions only — no DOM — so everything here is unit-tested.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left (as the user sees the part). */
export type Quad = [Point, Point, Point, Point];

/** 3×3 matrix, row-major, h[8] normalised to 1. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Solve A·x = b with Gaussian elimination and partial pivoting. Returns null if singular. */
export const solveLinear = (a: number[][], b: number[]): number[] | null => {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
};

/** Homography that maps each `from[i]` onto `to[i]`. */
export const computeHomography = (from: Quad, to: Quad): Homography | null => {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
};

export const applyHomography = (h: Homography, p: Point): Point => {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
};

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Naive width/height from the average lengths of opposite sides (no perspective correction). */
export const naiveAspectRatio = (q: Quad): number => {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  return h > 0 ? w / h : 1;
};

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * True width/height of a photographed rectangle, correcting for perspective.
 * Uses the single-view method of Zhang & He ("Whiteboard scanning and image enhancement"):
 * it recovers the camera focal length from the quad itself, assuming the principal point
 * is the image centre. Falls back to the naive ratio when the view is (nearly) square-on.
 */
export const estimateAspectRatio = (q: Quad, imageWidth: number, imageHeight: number): number => {
  const u0 = imageWidth / 2;
  const v0 = imageHeight / 2;
  // Paper notation: m1 top-left, m2 top-right, m3 bottom-left, m4 bottom-right.
  const m1: V3 = [q[0].x, q[0].y, 1];
  const m2: V3 = [q[1].x, q[1].y, 1];
  const m3: V3 = [q[3].x, q[3].y, 1];
  const m4: V3 = [q[2].x, q[2].y, 1];

  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
  const n2: V3 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3: V3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];

  const naive = naiveAspectRatio(q);
  const denom = n2[2] * n3[2];
  if (!Number.isFinite(k2) || !Number.isFinite(k3) || Math.abs(denom) < 1e-9) {
    return Math.sqrt((n2[0] ** 2 + n2[1] ** 2) / (n3[0] ** 2 + n3[1] ** 2)) || naive;
  }

  const f2 =
    -(
      n2[0] * n3[0] -
      (n2[0] * n3[2] + n2[2] * n3[0]) * u0 +
      n2[2] * n3[2] * u0 * u0 +
      (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)
    ) / denom;

  if (!(f2 > 0)) return naive;

  // nᵀ·(A⁻ᵀA⁻¹)·n with A = [[f,0,u0],[0,f,v0],[0,0,1]]
  const quad = (n: V3): number => {
    const x = (n[0] - u0 * n[2]) ** 2 / f2;
    const y = (n[1] - v0 * n[2]) ** 2 / f2;
    return x + y + n[2] ** 2;
  };
  const ratio = Math.sqrt(quad(n2) / quad(n3));
  if (!Number.isFinite(ratio) || ratio <= 0) return naive;
  // Guard against unstable estimates on near-degenerate input.
  return ratio / naive > 4 || naive / ratio > 4 ? naive : ratio;
};

/** Output size for a rectified image with the given aspect ratio and longest side. */
export const rectifiedSize = (aspect: number, longSide: number): { width: number; height: number } =>
  aspect >= 1
    ? { width: longSide, height: Math.max(1, Math.round(longSide / aspect)) }
    : { width: Math.max(1, Math.round(longSide * aspect)), height: longSide };

export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
}

/**
 * Warp the quad from `src` into a width×height rectangle (inverse mapping + bilinear sampling).
 */
export const rectify = (src: PixelBuffer, quad: Quad, width: number, height: number): PixelBuffer => {
  const out = new Uint8ClampedArray(width * height * 4);
  const target: Quad = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const h = computeHomography(target, quad);
  if (!h) return { width, height, data: out };

  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w = h[6] * px + h[7] * py + h[8];
      const sx = (h[0] * px + h[1] * py + h[2]) / w - 0.5;
      const sy = (h[3] * px + h[4] * py + h[5]) / w - 0.5;
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(sh - 1, Math.floor(sy)));
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const a = s[(y0 * sw + x0) * 4 + c];
        const b = s[(y0 * sw + x1) * 4 + c];
        const cc = s[(y1 * sw + x0) * 4 + c];
        const d = s[(y1 * sw + x1) * 4 + c];
        out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
      }
    }
  }
  return { width, height, data: out };
};

export const A4_MM = { short: 210, long: 297 } as const;

/**
 * Measure a quad in real millimetres using a reference rectangle of known size lying
 * on the same flat surface (e.g. an A4 sheet on the part's face).
 * The reference orientation (portrait/landscape) is picked from its perspective-corrected shape.
 */
export const measureWithReference = (
  part: Quad,
  reference: Quad,
  imageWidth: number,
  imageHeight: number,
  refSizeMm: { short: number; long: number } = A4_MM,
): { widthMm: number; heightMm: number } | null => {
  const refAspect = estimateAspectRatio(reference, imageWidth, imageHeight);
  const refW = refAspect >= 1 ? refSizeMm.long : refSizeMm.short;
  const refH = refAspect >= 1 ? refSizeMm.short : refSizeMm.long;
  const toPlane = computeHomography(reference, [
    { x: 0, y: 0 },
    { x: refW, y: 0 },
    { x: refW, y: refH },
    { x: 0, y: refH },
  ]);
  if (!toPlane) return null;
  const p = part.map((pt) => applyHomography(toPlane, pt)) as Quad;
  const widthMm = (dist(p[0], p[1]) + dist(p[3], p[2])) / 2;
  const heightMm = (dist(p[0], p[3]) + dist(p[1], p[2])) / 2;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  return { widthMm: Math.round(widthMm), heightMm: Math.round(heightMm) };
};

/** A quad is usable when it is convex and not collapsed. */
export const isValidQuad = (q: Quad): boolean => {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    const s = Math.sign(z);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
};

/** Default corners: a centred rectangle inset from the image edges. */
export const defaultQuad = (width: number, height: number, inset = 0.18): Quad => [
  { x: width * inset, y: height * inset },
  { x: width * (1 - inset), y: height * inset },
  { x: width * (1 - inset), y: height * (1 - inset) },
  { x: width * inset, y: height * (1 - inset) },
];
