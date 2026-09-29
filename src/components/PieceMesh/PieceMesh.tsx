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
import { usePhotoTextures } from './usePhotoTextures';
import { mmToScene, sceneToMm } from '../../lib/units';
import {
  checkpoint,
  discardCheckpointIfUnchanged,
  moveNodesTransient,
} from '../../features/scene/sceneSlice';
import { selectPiece, setDragging, togglePicked } from '../../features/editor/editorSlice';
import { memberPieces, otherBoxes, selectionForTap, targetBox, topLevelId } from '../../lib/sceneTree';

const COLLISION_COLOR = new Color('#e24b4a');
const SELECTED_EDGE = '#1f6fd1';
const EDGE = '#6b665c';
const PICKED_EDGE = '#d98a1c';
const SNAP_THRESHOLD_MM = 40;

interface PieceMeshProps {
  node: SceneNode;
  selected: boolean;
  colliding: boolean;
  /** Chosen while picking pieces to group. */
  picked: boolean;
}

const PieceMesh: FC<PieceMeshProps> = ({ node, selected, colliding, picked }) => {
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
  const textures = usePhotoTextures(node.material, node.sizeMm);
  /** A photo is multiplied by this, so a collision tints it red instead of hiding it. */
  const photoTint = colliding ? '#ff8a8a' : '#ffffff';

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (event.button !== 0) return; // right/middle mouse → camera pan
    event.stopPropagation();
    const { scene: startScene, editor: startEditor } = store.getState();

    if (startEditor.pickMode) {
      dispatch(togglePicked(topLevelId(startScene.nodes, node.id)));
      return;
    }

    const targetId = selectionForTap(startScene.nodes, node.id, startEditor.selectedId);
    dispatch(selectPiece(targetId));

    const startBox = targetBox(startScene.nodes, targetId);
    if (!startBox) return;
    const starts = memberPieces(startScene.nodes, targetId).map((m) => ({ id: m.id, pos: m.positionMm }));
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
        const others = otherBoxes(scene.nodes, targetId);
        const min = snapMove(
          startBox,
          { x: sceneToMm(point.x - offsetX), z: sceneToMm(point.z - offsetZ) },
          others,
          { gridMm: editor.gridSnap ? 10 : null, thresholdMm: SNAP_THRESHOLD_MM },
        );
        const dx = min.x - startBox.min.x;
        const dy = min.y - startBox.min.y;
        const dz = min.z - startBox.min.z;
        dispatch(
          moveNodesTransient(
            starts.map(({ id, pos }) => ({ id, positionMm: { x: pos.x + dx, y: pos.y + dy, z: pos.z + dz } })),
          ),
        );
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
        {textures.map((texture, index) => (
          <meshStandardMaterial
            key={`${index}-${texture ? texture.uuid : 'plain'}`}
            attach={`material-${index}`}
            map={texture}
            color={texture ? photoTint : color}
            roughness={roughness}
            metalness={0}
          />
        ))}
        <Edges
          color={picked ? PICKED_EDGE : selected ? SELECTED_EDGE : EDGE}
          lineWidth={selected || picked ? 3 : 1}
          threshold={15}
        />
      </mesh>
    </group>
  );
};

export default PieceMesh;
