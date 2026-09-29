import { describe, expect, it } from 'vitest';
import type { PhotoMaterial, Rotation, SceneNode } from '../types/scene';
import { effectiveSize, localAxisForWorld, nodeBox, rotateWorld, worldAxisLabels } from './geometry';
import { cutPiece, panelize, rotateGroupMembers, splitByFrontLines, subPiece } from './splitting';
import { selectionForTap } from './sceneTree';

const photo: PhotoMaterial = {
  type: 'photo',
  faces: { front: 'img' },
  baseColor: '#ccc',
  textureMode: 'stretch',
  photoSizeMm: { w: 1000, h: 850, d: 450 },
};

const dresser = (rotation: Rotation = { x: 0, y: 0, z: 0 }): SceneNode => {
  const sizeMm = { w: 1000, h: 850, d: 450 };
  const eff = effectiveSize(sizeMm, rotation);
  return {
    id: 'd',
    name: 'שידה',
    type: 'piece',
    parentId: null,
    positionMm: { x: 0, y: 0, z: 0 },
    rotation,
    sizeMm,
    material: photo,
    ...(eff ? {} : {}),
  };
};

describe('localAxisForWorld', () => {
  it('agrees with worldAxisLabels for every rotation', () => {
    for (let x = 0; x < 4; x += 1)
      for (let y = 0; y < 4; y += 1)
        for (let z = 0; z < 4; z += 1) {
          const r = { x, y, z } as Rotation;
          const labels = worldAxisLabels(r);
          expect([localAxisForWorld(r, 'x').key, localAxisForWorld(r, 'y').key, localAxisForWorld(r, 'z').key]).toEqual(labels);
        }
  });

  it('knows a quarter turn about Y puts the front (+d) facing +x', () => {
    expect(localAxisForWorld({ x: 0, y: 1, z: 0 }, 'x')).toEqual({ key: 'd', sign: 1 });
  });
});

describe('rotateWorld', () => {
  it('turns about world Y even when the piece is laid down', () => {
    const laid: Rotation = { x: 1, y: 0, z: 0 };
    const turned = rotateWorld(laid, 'y');
    // Laid down: height (h) is along world z. After a world-Y turn it must be along world x.
    expect(localAxisForWorld(turned, 'x').key).toBe('h');
    expect(localAxisForWorld(turned, 'y').key).toBe('d');
  });
});

describe('cutPiece', () => {
  it('cuts across the width and crops the photo to each half', () => {
    const [a, b] = cutPiece(dresser(), 'x', 400)!;
    expect(a.positionMm).toEqual({ x: 0, y: 0, z: 0 });
    expect(a.sizeMm).toEqual({ w: 400, h: 850, d: 450 });
    expect(b.positionMm).toEqual({ x: 400, y: 0, z: 0 });
    expect(b.sizeMm).toEqual({ w: 600, h: 850, d: 450 });
    expect(a.material.type === 'photo' && a.material.crop).toMatchObject({ x0: 0, x1: 0.4 });
    expect(b.material.type === 'photo' && b.material.crop).toMatchObject({ x0: 0.4, x1: 1 });
  });

  it('maps crops correctly on a rotated piece', () => {
    // Turned 90° about Y: world x runs along local depth, front towards +x.
    const [low] = cutPiece(dresser({ x: 0, y: 1, z: 0 }), 'z', 250)!;
    // World z = −local x, so the low-z slice is the right-hand end of the width.
    expect(low.material.type === 'photo' && low.material.crop).toMatchObject({ x0: 0.75, x1: 1 });
  });

  it('refuses a cut at the very edge', () => {
    expect(cutPiece(dresser(), 'y', 2)).toBeNull();
  });

  it('composes crops when cutting twice', () => {
    const [, right] = cutPiece(dresser(), 'x', 500)!;
    const [rl] = cutPiece({ ...right, id: 'r', parentId: null }, 'x', 250)!;
    expect(rl.material.type === 'photo' && rl.material.crop).toMatchObject({ x0: 0.5, x1: 0.75 });
  });
});

describe('panelize', () => {
  it('makes a carcass whose boards fill the original outline', () => {
    const boards = panelize(dresser(), { thicknessMm: 18, top: true, bottom: true, sides: true, back: true, front: false });
    expect(boards.map((b) => b.name)).toEqual(['עליון', 'תחתון', 'דופן שמאל', 'דופן ימין', 'גב']);
    const top = boards[0];
    expect(top.positionMm).toEqual({ x: 0, y: 832, z: 0 });
    expect(top.sizeMm).toEqual({ w: 1000, h: 18, d: 450 });
    const back = boards[4];
    expect(back.positionMm).toEqual({ x: 18, y: 18, z: 0 });
    expect(back.sizeMm).toEqual({ w: 964, h: 814, d: 18 });
  });

  it('puts the back at the piece’s own back after a rotation', () => {
    const turned = dresser({ x: 0, y: 1, z: 0 });
    const [back] = panelize(turned, { thicknessMm: 18, top: false, bottom: false, sides: false, back: true, front: false });
    // Front faces +x, so the back is the low-x slab.
    const box = nodeBox(back);
    expect(box.min.x).toBe(0);
    expect(box.size.x).toBe(18);
  });
});

describe('splitByFrontLines', () => {
  it('splits a dresser into three drawer blocks from top to bottom', () => {
    const blocks = splitByFrontLines(dresser(), [], [1 / 3, 2 / 3]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].positionMm.y).toBe(567);
    expect(blocks[2].positionMm.y).toBe(0);
    expect(blocks[0].material.type === 'photo' && blocks[0].material.crop?.y1).toBeCloseTo(1);
  });
});

describe('subPiece', () => {
  it('leaves non-photo materials untouched', () => {
    const plain: SceneNode = { ...dresser(), material: { type: 'preset', value: 'oak' } };
    const part = subPiece(plain, { min: { x: 0, y: 0, z: 0 }, size: { x: 100, y: 100, z: 100 } }, 'x');
    expect(part.material).toEqual({ type: 'preset', value: 'oak' });
  });
});

describe('rotateGroupMembers', () => {
  it('turns a group about its centre, swapping footprints', () => {
    const a: SceneNode = { ...dresser(), id: 'a', material: { type: 'preset', value: 'oak' } };
    const moves = rotateGroupMembers([a], nodeBox(a));
    expect(moves[0].positionMm).toEqual({ x: 275, y: 0, z: -275 });
    expect(moves[0].rotation).toEqual({ x: 0, y: 1, z: 0 });
  });
});

describe('selectionForTap', () => {
  const nodes: SceneNode[] = [
    { ...dresser(), id: 'g', type: 'group' },
    { ...dresser(), id: 'p1', parentId: 'g' },
    { ...dresser(), id: 'p2', parentId: 'g' },
    { ...dresser(), id: 'solo' },
  ];
  it('selects the group first, then pieces inside it', () => {
    expect(selectionForTap(nodes, 'p1', null)).toBe('g');
    expect(selectionForTap(nodes, 'p1', 'g')).toBe('p1');
    expect(selectionForTap(nodes, 'p2', 'p1')).toBe('p2');
    expect(selectionForTap(nodes, 'solo', 'p1')).toBe('solo');
  });
});
