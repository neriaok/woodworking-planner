import { describe, expect, it } from 'vitest';
import { solveDimensions } from './dimensions';
import { averageColor } from './color';

describe('solveDimensions', () => {
  it('derives height from width and the front photo', () => {
    const r = solveDimensions([{ face: 'front', aspect: 1000 / 850 }], { w: 1000 });
    expect(r.size).toEqual({ w: 1000, h: 850 });
    expect(r.source).toEqual({ w: 'manual', h: 'photo' });
    expect(r.conflicts).toEqual([]);
  });

  it('chains through several faces: width → height (front) → depth (side)', () => {
    const r = solveDimensions(
      [
        { face: 'front', aspect: 1000 / 850 },
        { face: 'right', aspect: 450 / 850 },
      ],
      { w: 1000 },
    );
    expect(r.size).toEqual({ w: 1000, h: 850, d: 450 });
  });

  it('uses an A4 measurement when nothing was typed, but typed values win', () => {
    const faces = [{ face: 'front' as const, aspect: 1.18, measuredMm: { widthMm: 1003, heightMm: 848 } }];
    expect(solveDimensions(faces, {}).size).toEqual({ w: 1005, h: 850 });
    expect(solveDimensions(faces, {}).source).toEqual({ w: 'reference', h: 'reference' });
    expect(solveDimensions(faces, { w: 1200 }).size.w).toBe(1200);
  });

  it('flags photos that disagree with each other', () => {
    const r = solveDimensions(
      [
        { face: 'front', aspect: 2 },
        { face: 'right', aspect: 0.5 },
        { face: 'top', aspect: 1 }, // implies w = d, but front+side imply w = 4·d
      ],
      { h: 500 },
    );
    expect(r.size).toEqual({ w: 1000, h: 500, d: 250 });
    expect(r.conflicts.map((c) => c.face)).toEqual(['top']);
  });

  it('leaves unknowns empty when there is nothing to anchor them', () => {
    expect(solveDimensions([{ face: 'front', aspect: 2 }], {}).size).toEqual({});
  });
});

describe('averageColor', () => {
  it('averages opaque pixels', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0]);
    expect(averageColor({ width: 3, height: 1, data }, 1)).toBe('#800080');
  });
});
