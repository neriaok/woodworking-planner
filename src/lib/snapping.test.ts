import { describe, expect, it } from 'vitest';
import { boxesOverlap, findCollisions } from './collisions';
import { resolveHeight, scaleProportional, snapMove, snapResize } from './snapping';
import type { Box } from '../types/scene';

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Box => ({
  min: { x, y, z },
  size: { x: sx, y: sy, z: sz },
});

const dresser = box(0, 0, 0, 1000, 850, 450);
const opts = { gridMm: 10, thresholdMm: 40 };

describe('collisions', () => {
  it('treats touching faces as no collision', () => {
    expect(boxesOverlap(dresser, box(1000, 0, 0, 500, 500, 500))).toBe(false);
    expect(boxesOverlap(dresser, box(0, 850, 0, 1000, 40, 450))).toBe(false);
  });

  it('detects a real overlap', () => {
    expect(boxesOverlap(dresser, box(990, 0, 0, 500, 500, 500))).toBe(true);
  });

  it('reports every colliding id', () => {
    const hits = findCollisions([
      { id: 'a', box: dresser },
      { id: 'b', box: box(500, 0, 0, 100, 100, 100) },
      { id: 'c', box: box(3000, 0, 0, 100, 100, 100) },
    ]);
    expect([...hits].sort()).toEqual(['a', 'b']);
  });
});

describe('snapMove', () => {
  const moving = box(2000, 0, 0, 400, 800, 400);

  it('snaps face-to-face when close to a neighbour', () => {
    expect(snapMove(moving, { x: 1025, z: 13 }, [dresser], opts)).toEqual({ x: 1000, y: 0, z: 0 });
  });

  it('falls back to the 1 cm grid when nothing is near', () => {
    expect(snapMove(moving, { x: 2234, z: 1506 }, [dresser], opts)).toEqual({ x: 2230, y: 0, z: 1510 });
  });

  it('keeps precise millimetres when the grid is off', () => {
    expect(snapMove(moving, { x: 2234, z: 1506 }, [], { gridMm: null, thresholdMm: 40 })).toEqual({
      x: 2234,
      y: 0,
      z: 1506,
    });
  });
});

describe('resolveHeight (stacking)', () => {
  it('pops a countertop dragged into a dresser up onto its top', () => {
    const top = box(-200, 0, -50, 1400, 40, 600);
    expect(resolveHeight(top, [dresser])).toBe(850);
  });

  it('lets a lower piece slide under a raised one without jumping', () => {
    const counter = box(-200, 850, -50, 1400, 40, 600);
    expect(resolveHeight(box(0, 0, 0, 1000, 850, 450), [counter])).toBe(0);
  });

  it('drops to the floor when moved off its support', () => {
    expect(resolveHeight(box(3000, 850, 0, 1400, 40, 600), [dresser])).toBe(0);
  });

  it('stacks through several levels', () => {
    const counter = box(-200, 850, -50, 1400, 40, 600);
    expect(resolveHeight(box(0, 0, 0, 300, 100, 300), [dresser, counter])).toBe(890);
  });
});

describe('snapResize', () => {
  it('moves only the dragged face and snaps to the grid', () => {
    expect(snapResize(dresser, '+x', 1203, [], opts)).toEqual(box(0, 0, 0, 1200, 850, 450));
    expect(snapResize(dresser, '-x', -118, [], opts)).toEqual(box(-120, 0, 0, 1120, 850, 450));
  });

  it('snaps to a neighbour face', () => {
    const wall = box(1500, 0, 0, 100, 2000, 2000);
    expect(snapResize(dresser, '+x', 1480, [wall], opts).size.x).toBe(1500);
  });

  it('never collapses below the minimum size', () => {
    expect(snapResize(dresser, '+x', -500, [], opts).size.x).toBe(5);
    expect(snapResize(dresser, '-x', 5000, [], opts)).toEqual(box(995, 0, 0, 5, 850, 450));
  });
});

describe('scaleProportional', () => {
  it('scales every axis and keeps the opposite face and the bottom fixed', () => {
    const result = scaleProportional(dresser, '+x', 2000);
    expect(result.size).toEqual({ x: 2000, y: 1700, z: 900 });
    expect(result.min).toEqual({ x: 0, y: 0, z: -225 });
  });
});
