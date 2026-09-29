import { describe, expect, it } from 'vitest';
import type { Box } from '../types/scene';
import { defaultMotion, frontDirection, isOpeningBlocked, motionTransform, rotateAbout, transformedBox } from './motion';

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Box => ({
  min: { x, y, z },
  size: { x: sx, y: sy, z: sz },
});
const noRot = { x: 0, y: 0, z: 0 } as const;

describe('rotateAbout', () => {
  it('matches three.js handedness about Y', () => {
    const p = rotateAbout({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 'y', Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(-1);
  });
});

describe('frontDirection', () => {
  it('is +z unrotated and +x after a quarter turn about Y', () => {
    expect(frontDirection(noRot)).toEqual({ axis: 'z', sign: 1 });
    expect(frontDirection({ x: 0, y: 1, z: 0 })).toEqual({ axis: 'x', sign: 1 });
  });
});

describe('drawer (slide)', () => {
  it('pulls out along the front', () => {
    const drawer = box(0, 300, 0, 900, 200, 450);
    const m = motionTransform(drawer, noRot, { type: 'slide', distanceMm: 400 }, 0.5);
    expect(m.offset).toEqual({ x: 0, y: 0, z: 200 });
    expect(transformedBox(drawer, m).min.z).toBe(200);
  });
});

describe('door (hinge)', () => {
  const door = box(0, 0, 430, 500, 800, 20);

  it('swings out towards the front around its left edge', () => {
    const m = motionTransform(door, noRot, { type: 'hinge', side: 'left', maxAngleDeg: 90 }, 1);
    expect(m.axis).toBe('y');
    expect(m.pivot).toMatchObject({ x: 0, z: 450 });
    const open = transformedBox(door, m);
    // Fully open: it now sticks straight out in front, along the left edge.
    expect(open.min.z).toBeCloseTo(450, 0);
    expect(open.size.z).toBeCloseTo(500, 0);
    expect(open.size.x).toBeCloseTo(20, 0);
  });

  it('a right-hinged door swings the other way', () => {
    const m = motionTransform(door, noRot, { type: 'hinge', side: 'right', maxAngleDeg: 90 }, 1);
    expect(m.pivot.x).toBe(500);
    const open = transformedBox(door, m);
    expect(open.min.x).toBeCloseTo(480, 0);
  });

  it('a top-hinged flap lifts up about a horizontal axis', () => {
    const m = motionTransform(door, noRot, { type: 'hinge', side: 'top', maxAngleDeg: 90 }, 1);
    expect(m.axis).toBe('x');
    const open = transformedBox(door, m);
    // Pivot is the front-top edge, so the flap ends up just below it and sticks out forward.
    expect(open.min.y).toBeCloseTo(780, 0);
    expect(open.size.z).toBeCloseTo(800, 0);
  });
});

describe('isOpeningBlocked', () => {
  const drawer = box(0, 300, 0, 900, 200, 450);
  const cabinetSide = box(900, 0, 0, 18, 850, 450);

  it('ignores the cabinet the drawer sits in', () => {
    expect(isOpeningBlocked([drawer], noRot, { type: 'slide', distanceMm: 400 }, [cabinetSide])).toBe(false);
  });

  it('detects something standing in front of the drawer', () => {
    const stool = box(100, 0, 600, 300, 450, 300);
    expect(isOpeningBlocked([drawer], noRot, { type: 'slide', distanceMm: 400 }, [stool])).toBe(true);
  });

  it('detects a door hitting a wall beside it', () => {
    const door = box(0, 0, 430, 500, 800, 20);
    const wall = box(-300, 0, 460, 280, 900, 600);
    expect(isOpeningBlocked([door], noRot, { type: 'hinge', side: 'left', maxAngleDeg: 110 }, [wall])).toBe(true);
  });
});

describe('defaultMotion', () => {
  it('drawers slide out three quarters of their depth', () => {
    expect(defaultMotion('drawer', box(0, 0, 0, 900, 200, 400), noRot)).toEqual({ type: 'slide', distanceMm: 300 });
  });
});
