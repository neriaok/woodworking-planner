import { describe, expect, it } from 'vitest';
import type { SceneNode } from '../types/scene';
import { cloneNodes, collectImageIds, parseBackup, summarize } from './projectFile';

const piece = (id: string, parentId: string | null, photo?: string): SceneNode => ({
  id,
  name: id,
  type: 'piece',
  parentId,
  positionMm: { x: 100, y: 0, z: 50 },
  rotation: { x: 0, y: 0, z: 0 },
  sizeMm: { w: 10, h: 10, d: 10 },
  material: photo
    ? { type: 'photo', faces: { front: photo, top: 'shared' }, baseColor: '#fff', textureMode: 'stretch', photoSizeMm: { w: 10, h: 10, d: 10 } }
    : { type: 'preset', value: 'oak' },
});

describe('projectFile', () => {
  it('collects every photo id once', () => {
    expect(collectImageIds([piece('a', null, 'img1'), piece('b', null, 'img2'), piece('c', null)]).sort()).toEqual([
      'img1',
      'img2',
      'shared',
    ]);
  });

  it('summarizes a project by counting pieces only', () => {
    const group: SceneNode = { ...piece('g', null), type: 'group' };
    expect(summarize({ id: 'p', name: 'x', updatedAt: 1, nodes: [group, piece('a', 'g'), piece('b', 'g')] }).pieceCount).toBe(2);
  });

  it('clones with fresh ids, keeps group links and shifts positions', () => {
    let n = 0;
    const group: SceneNode = { ...piece('g', null), type: 'group' };
    const out = cloneNodes([group, { ...piece('a', 'g'), openAmount: 1 }], () => `new${(n += 1)}`, { x: -100, y: 0, z: 0 });
    expect(out.map((o) => o.id)).toEqual(['new1', 'new2']);
    expect(out[1].parentId).toBe('new1');
    expect(out[1].positionMm.x).toBe(0);
    expect(out[1].openAmount).toBeUndefined();
  });

  it('accepts a valid backup and rejects anything else', () => {
    const backup = {
      app: 'woodworking-planner',
      version: 1,
      exportedAt: 1,
      projects: [{ id: 'p', name: 'x', updatedAt: 1, nodes: [piece('a', null)] }],
      library: [],
      images: { img: 'data:image/jpeg;base64,AAAA' },
    };
    expect(parseBackup(JSON.stringify(backup))).not.toBeNull();
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup(JSON.stringify({ ...backup, app: 'other' }))).toBeNull();
    expect(parseBackup(JSON.stringify({ ...backup, images: { img: 'javascript:alert(1)' } }))).toBeNull();
  });
});
