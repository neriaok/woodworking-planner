import { useRef, useState, type FC } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Plane, Vector3, type Group } from 'three';
import { useStore } from 'react-redux';
import type { FaceDir, SceneNode } from '../../types/scene';
import type { RootState } from '../../store/store';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { intersect, useCanvasDrag } from '../../hooks/useCanvasDrag';
import { boxCenter, boxMax, faceAxis, faceSign, nodeBox } from '../../lib/geometry';
import { scaleProportional, snapResize } from '../../lib/snapping';
import { otherBoxes } from '../../lib/sceneTree';
import { mmToScene, sceneToMm } from '../../lib/units';
import {
  checkpoint,
  discardCheckpointIfUnchanged,
  setBoxTransient,
} from '../../features/scene/sceneSlice';
import { setDragging } from '../../features/editor/editorSlice';

/** The bottom face is not offered: pieces stay on their support while resizing. */
const FACES: readonly FaceDir[] = ['+x', '-x', '+y', '+z', '-z'];
/** Visible handle radius as a fraction of camera distance (constant size on screen). */
const SCREEN_SCALE = 0.011;
/** The invisible touch target is larger than the dot, so it is easy to grab with a finger. */
const HIT_AREA_FACTOR = 2.2;
const noRaycast = (): null => null;
const AXIS_VECTORS = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

interface HandleProps {
  node: SceneNode;
  face: FaceDir;
}

const Handle: FC<HandleProps> = ({ node, face }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const { begin, camera } = useCanvasDrag();
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  const box = nodeBox(node);
  const axis = faceAxis(face);
  const sign = faceSign(face);
  const c = boxCenter(box);
  const pos = { ...c, [axis]: sign === 1 ? boxMax(box, axis) : box.min[axis] };
  const position = new Vector3(mmToScene(pos.x), mmToScene(pos.y), mmToScene(pos.z));

  useFrame(() => {
    if (!groupRef.current) return;
    const scale = camera.position.distanceTo(groupRef.current.position) * SCREEN_SCALE;
    groupRef.current.scale.setScalar(hovered ? scale * 1.2 : scale);
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (event.button !== 0) return;
    event.stopPropagation();

    const startBox = nodeBox(node);
    const axisVec = AXIS_VECTORS[axis];
    // A plane that contains the drag axis and faces the camera as much as possible.
    const toCamera = camera.position.clone().sub(position);
    const normal = axisVec.clone().cross(toCamera).cross(axisVec).normalize();
    if (normal.lengthSq() < 1e-6) normal.copy(toCamera).normalize();
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, position);
    const startHit = intersect(event.ray, plane);
    if (!startHit) return;
    const startCoord = sign === 1 ? boxMax(startBox, axis) : startBox.min[axis];

    begin(event.nativeEvent, {
      onStart: () => {
        dispatch(checkpoint());
        dispatch(setDragging(true));
      },
      onMove: (ray) => {
        const hit = intersect(ray, plane);
        if (!hit) return;
        const deltaMm = sceneToMm(hit.clone().sub(startHit).dot(axisVec));
        const proposed = startCoord + deltaMm;
        const { scene, editor } = store.getState();
        const grid = editor.gridSnap ? 10 : null;
        let next;
        if (editor.lockProportions) {
          const rawLength =
            sign === 1 ? proposed - startBox.min[axis] : boxMax(startBox, axis) - proposed;
          const length = grid ? Math.round(rawLength / grid) * grid : rawLength;
          next = scaleProportional(startBox, face, length);
        } else {
          const others = otherBoxes(scene.nodes, node.id);
          next = snapResize(startBox, face, proposed, others, { gridMm: grid, thresholdMm: 40 });
        }
        dispatch(setBoxTransient({ id: node.id, box: next }));
      },
      onEnd: (moved) => {
        if (!moved) return;
        dispatch(discardCheckpointIfUnchanged());
        dispatch(setDragging(false));
      },
    });
  };

  return (
    <group ref={groupRef} position={position}>
      <mesh renderOrder={11} raycast={noRaycast}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color={hovered ? '#0b4f9e' : '#1f6fd1'} depthTest={false} transparent />
      </mesh>
      <mesh renderOrder={10} scale={1.35} raycast={noRaycast}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} transparent />
      </mesh>
      <mesh
        scale={HIT_AREA_FACTOR}
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

interface ResizeHandlesProps {
  node: SceneNode;
}

const ResizeHandles: FC<ResizeHandlesProps> = ({ node }) => (
  <group>
    {FACES.map((face) => (
      <Handle key={face} node={node} face={face} />
    ))}
  </group>
);

export default ResizeHandles;
