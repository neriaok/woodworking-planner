import { describe, expect, it } from 'vitest';
import {
  applyHomography,
  computeHomography,
  estimateAspectRatio,
  isValidQuad,
  measureWithReference,
  naiveAspectRatio,
  rectify,
  type Point,
  type Quad,
} from './homography';

const IMG_W = 2000;
const IMG_H = 1500;

/** Project a point on a tilted plane through a pinhole camera (principal point = image centre). */
const makeCamera = (yawDeg: number, pitchDeg: number, focal = 1600, distance = 3000) => {
  const ya = (yawDeg * Math.PI) / 180;
  const pa = (pitchDeg * Math.PI) / 180;
  return (X: number, Y: number): Point => {
    // rotate around Y (yaw), then X (pitch)
    const x1 = X * Math.cos(ya);
    const z1 = -X * Math.sin(ya);
    const y2 = Y * Math.cos(pa) - z1 * Math.sin(pa);
    const z2 = Y * Math.sin(pa) + z1 * Math.cos(pa) + distance;
    return { x: (focal * x1) / z2 + IMG_W / 2, y: (focal * y2) / z2 + IMG_H / 2 };
  };
};

/** Quad (TL, TR, BR, BL) of a w×h rectangle whose top-left corner sits at (ox, oy) on the plane. */
const rectQuad = (project: (x: number, y: number) => Point, ox: number, oy: number, w: number, h: number): Quad => [
  project(ox, oy),
  project(ox + w, oy),
  project(ox + w, oy + h),
  project(ox, oy + h),
];

describe('computeHomography', () => {
  it('maps the four source corners exactly onto the targets', () => {
    const from: Quad = [
      { x: 10, y: 20 },
      { x: 300, y: 40 },
      { x: 280, y: 260 },
      { x: 30, y: 220 },
    ];
    const to: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const h = computeHomography(from, to);
    expect(h).not.toBeNull();
    from.forEach((p, i) => {
      const q = applyHomography(h!, p);
      expect(q.x).toBeCloseTo(to[i].x, 6);
      expect(q.y).toBeCloseTo(to[i].y, 6);
    });
  });
});

describe('estimateAspectRatio', () => {
  it('recovers the true ratio of a strongly tilted rectangle', () => {
    const project = makeCamera(40, 25);
    const quad = rectQuad(project, -700, -300, 1400, 600); // a 140×60 countertop, ratio 2.333
    const ratio = estimateAspectRatio(quad, IMG_W, IMG_H);
    expect(ratio).toBeCloseTo(1400 / 600, 1);
    // and is much better than the naive side-length average
    expect(Math.abs(ratio - 1400 / 600)).toBeLessThan(Math.abs(naiveAspectRatio(quad) - 1400 / 600));
  });

  it('works for a tall piece and for a square-on photo', () => {
    const tall = rectQuad(makeCamera(-30, 15), -225, -425, 450, 850);
    expect(estimateAspectRatio(tall, IMG_W, IMG_H)).toBeCloseTo(450 / 850, 1);
    const flat = rectQuad(makeCamera(0, 0), -500, -425, 1000, 850);
    expect(estimateAspectRatio(flat, IMG_W, IMG_H)).toBeCloseTo(1000 / 850, 2);
  });
});

describe('measureWithReference', () => {
  it('measures a face in millimetres from an A4 sheet lying on it', () => {
    const project = makeCamera(35, 20);
    const part = rectQuad(project, -500, -425, 1000, 850); // dresser front 100×85 cm
    const a4 = rectQuad(project, -300, -200, 297, 210); // landscape A4 on the front
    const m = measureWithReference(part, a4, IMG_W, IMG_H);
    expect(m).not.toBeNull();
    expect(Math.abs(m!.widthMm - 1000)).toBeLessThan(15);
    expect(Math.abs(m!.heightMm - 850)).toBeLessThan(15);
  });

  it('handles a portrait A4 sheet', () => {
    const project = makeCamera(-25, 10);
    const part = rectQuad(project, -700, -300, 1400, 600);
    const a4 = rectQuad(project, -100, -250, 210, 297);
    const m = measureWithReference(part, a4, IMG_W, IMG_H);
    expect(Math.abs(m!.widthMm - 1400)).toBeLessThan(20);
    expect(Math.abs(m!.heightMm - 600)).toBeLessThan(15);
  });
});

describe('rectify', () => {
  it('straightens a skewed quad back into a clean rectangle', () => {
    // 40×40 source: left half red, right half blue.
    const size = 40;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1) {
        const o = (y * size + x) * 4;
        data[o] = x < size / 2 ? 255 : 0;
        data[o + 2] = x < size / 2 ? 0 : 255;
        data[o + 3] = 255;
      }
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const out = rectify({ width: size, height: size, data }, quad, 20, 10);
    expect(out.width).toBe(20);
    const px = (x: number, y: number) => Array.from(out.data.slice((y * 20 + x) * 4, (y * 20 + x) * 4 + 3));
    expect(px(2, 5)).toEqual([255, 0, 0]);
    expect(px(17, 5)).toEqual([0, 0, 255]);
  });
});

describe('isValidQuad', () => {
  it('accepts convex quads and rejects crossed ones', () => {
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBe(true);
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
  });
});
