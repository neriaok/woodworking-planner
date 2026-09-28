import { useMemo, type FC } from 'react';
import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, Plane, Vector3 } from 'three';
import { useStore } from 'react-redux';
import type { SceneNode } from '../../types/scene';
import type { RootState } from '../../store/store';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { intersect, useCanvasDrag } from '../../hooks/useCanvasDrag';
import { nodeBox, boxCenter } from '../../lib/geometry';
import { resolveMaterial } from '../../lib/materials';
import { snapMove } from '../../lib/snapping';
import { mmToScene, sceneToMm } from '../../lib/units';
import {
  checkpoint,
  discardCheckpointIfUnchanged,
  movePieceTransient,
} from '../../features/scene/sceneSlice';
import { selectPiece, setDragging } from '../../features/editor/editorSlice';

const COLLISION_COLOR = new Color('#e24b4a');
const SELECTED_EDGE = '#1f6fd1';
const EDGE = '#6b665c';
const SNAP_THRESHOLD_MM = 40;

interface PieceMeshProps {
  node: SceneNode;
  selected: boolean;
  colliding: boolean;
}

const PieceMesh: FC<PieceMeshProps> = ({ node, selected, colliding }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const { begin } = useCanvasDrag();

  const { w, h, d } = node.sizeMm;
  const box = nodeBox(node);
  const center = boxCenter(box);
  const half = Math.PI / 2;

  const color = useMemo(() => {
    const base = new Color(resolveMaterial(node.material).color);
    return colliding ? base.lerp(COLLISION_COLOR, 0.6) : base;
  }, [node.material, colliding]);
  const { roughness } = resolveMaterial(node.material);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (event.button !== 0) return; // right/middle mouse → camera pan
    event.stopPropagation();
    dispatch(selectPiece(node.id));

    const startBox = nodeBox(node);
    const plane = new Plane(new Vector3(0, 1, 0), -mmToScene(startBox.min.y));
    const hit = intersect(event.ray, plane);
    if (!hit) return;
    const offsetX = hit.x - mmToScene(startBox.min.x);
    const offsetZ = hit.z - mmToScene(startBox.min.z);

    begin(event.nativeEvent, {
      onStart: () => {
        dispatch(checkpoint());
        dispatch(setDragging(true));
      },
      onMove: (ray) => {
        const point = intersect(ray, plane);
        if (!point) return;
        const { scene, editor } = store.getState();
        const others = scene.nodes.filter((n) => n.id !== node.id && !n.hidden).map(nodeBox);
        const positionMm = snapMove(
          startBox,
          { x: sceneToMm(point.x - offsetX), z: sceneToMm(point.z - offsetZ) },
          others,
          { gridMm: editor.gridSnap ? 10 : null, thresholdMm: SNAP_THRESHOLD_MM },
        );
        dispatch(movePieceTransient({ id: node.id, positionMm }));
      },
      onEnd: (moved) => {
        if (!moved) return;
        dispatch(discardCheckpointIfUnchanged());
        dispatch(setDragging(false));
      },
    });
  };

  return (
    <group
      position={[mmToScene(center.x), mmToScene(center.y), mmToScene(center.z)]}
      rotation={[node.rotation.x * half, node.rotation.y * half, node.rotation.z * half]}
    >
      <mesh onPointerDown={handlePointerDown}>
        <boxGeometry args={[mmToScene(w), mmToScene(h), mmToScene(d)]} />
        <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
        <Edges
          color={selected ? SELECTED_EDGE : EDGE}
          lineWidth={selected ? 3 : 1}
          threshold={15}
        />
      </mesh>
    </group>
  );
};

export default PieceMesh;
