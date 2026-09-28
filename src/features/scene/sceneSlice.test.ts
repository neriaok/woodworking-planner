import { describe, expect, it } from 'vitest';
import reducer, {
  addPiece,
  checkpoint,
  discardCheckpointIfUnchanged,
  movePieceTransient,
  redo,
  rotatePiece,
  setAxisLength,
  undo,
  type SceneState,
} from './sceneSlice';

const start = (): SceneState => reducer(undefined, { type: '@@init' });

describe('scene history', () => {
  it('undoes and redoes a committed action', () => {
    const s0 = start();
    const s1 = reducer(s0, addPiece({ name: 'קרש', sizeMm: { w: 500, h: 20, d: 100 }, material: { type: 'preset', value: 'pine' } }));
    expect(s1.nodes).toHaveLength(s0.nodes.length + 1);
    const s2 = reducer(s1, undo());
    expect(s2.nodes).toEqual(s0.nodes);
    const s3 = reducer(s2, redo());
    expect(s3.nodes).toEqual(s1.nodes);
  });

  it('records a whole drag as a single undo step', () => {
    let s = reducer(start(), checkpoint());
    s = reducer(s, movePieceTransient({ id: 'demo-board', positionMm: { x: 1000, y: 0, z: 0 } }));
    s = reducer(s, movePieceTransient({ id: 'demo-board', positionMm: { x: 1200, y: 0, z: 0 } }));
    s = reducer(s, discardCheckpointIfUnchanged());
    expect(s.past).toHaveLength(1);
    s = reducer(s, undo());
    expect(s.nodes.find((n) => n.id === 'demo-board')?.positionMm).toEqual({ x: 900, y: 0, z: -100 });
  });

  it('drops the checkpoint of a tap that moved nothing', () => {
    let s = reducer(start(), checkpoint());
    s = reducer(s, discardCheckpointIfUnchanged());
    expect(s.past).toHaveLength(0);
  });
});

describe('piece edits', () => {
  it('rotates in place, keeping the footprint centre', () => {
    const s = reducer(start(), rotatePiece({ id: 'demo-dresser', axis: 'y' }));
    const node = s.nodes.find((n) => n.id === 'demo-dresser');
    expect(node?.positionMm).toEqual({ x: -225, y: 0, z: -500 });
  });

  it('edits a world-axis length even after rotation', () => {
    let s = reducer(start(), rotatePiece({ id: 'demo-dresser', axis: 'y' }));
    s = reducer(s, setAxisLength({ id: 'demo-dresser', axis: 'x', lengthMm: 600, proportional: false }));
    const node = s.nodes.find((n) => n.id === 'demo-dresser');
    // After a quarter turn, world x is the local depth.
    expect(node?.sizeMm).toEqual({ w: 1000, h: 850, d: 600 });
  });
});
