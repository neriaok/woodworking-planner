import { describe, expect, it } from 'vitest';
import {
  effectiveSize,
  localSizeFromEffective,
  positionAfterRotation,
  rotateQuarter,
  unionBox,
} from './geometry';
import { formatCm, parseCmToMm } from './units';
import type { Rotation } from '../types/scene';

const size = { w: 1000, h: 850, d: 450 };
const r = (x: 0 | 1 | 2 | 3, y: 0 | 1 | 2 | 3, z: 0 | 1 | 2 | 3): Rotation => ({ x, y, z });

describe('effectiveSize', () => {
  it('is the local size when unrotated or turned 180°', () => {
    expect(effectiveSize(size, r(0, 0, 0))).toEqual({ x: 1000, y: 850, z: 450 });
    expect(effectiveSize(size, r(0, 2, 0))).toEqual({ x: 1000, y: 850, z: 450 });
  });

  it('swaps width and depth for a quarter turn around Y', () => {
    expect(effectiveSize(size, r(0, 1, 0))).toEqual({ x: 450, y: 850, z: 1000 });
  });

  it('lays a piece down around X (height ↔ depth) and Z (width ↔ height)', () => {
    expect(effectiveSize(size, r(1, 0, 0))).toEqual({ x: 1000, y: 450, z: 850 });
    expect(effectiveSize(size, r(0, 0, 1))).toEqual({ x: 850, y: 1000, z: 450 });
  });

  it('round-trips through localSizeFromEffective for every rotation', () => {
    for (let x = 0; x < 4; x += 1)
      for (let y = 0; y < 4; y += 1)
        for (let z = 0; z < 4; z += 1) {
          const rot = r(x as 0, y as 0, z as 0);
          expect(localSizeFromEffective(effectiveSize(size, rot), rot)).toEqual(size);
        }
  });
});

describe('rotation helpers', () => {
  it('wraps quarter turns', () => {
    expect(rotateQuarter(r(0, 3, 0), 'y')).toEqual(r(0, 0, 0));
  });

  it('keeps the footprint centre and bottom when turning', () => {
    const before = { min: { x: 0, y: 100, z: 0 }, size: { x: 1000, y: 850, z: 450 } };
    const pos = positionAfterRotation(before, { x: 450, y: 850, z: 1000 });
    expect(pos).toEqual({ x: 275, y: 100, z: -275 });
  });
});

describe('unionBox', () => {
  it('returns null for no boxes and the overall bounds otherwise', () => {
    expect(unionBox([])).toBeNull();
    const u = unionBox([
      { min: { x: 0, y: 0, z: 0 }, size: { x: 1000, y: 850, z: 450 } },
      { min: { x: -200, y: 850, z: -50 }, size: { x: 1400, y: 40, z: 600 } },
    ]);
    expect(u).toEqual({ min: { x: -200, y: 0, z: -50 }, size: { x: 1400, y: 890, z: 600 } });
  });
});

describe('units', () => {
  it('formats to 0.5 cm and parses both comma and dot', () => {
    expect(formatCm(1255)).toBe('125.5');
    expect(formatCm(1400)).toBe('140');
    expect(formatCm(1257)).toBe('125.5');
    expect(parseCmToMm('12,5')).toBe(125);
    expect(parseCmToMm(' 80 ')).toBe(800);
    expect(parseCmToMm('abc')).toBeNull();
    expect(parseCmToMm('')).toBeNull();
  });
});
