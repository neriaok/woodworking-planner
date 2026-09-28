import { useEffect, type FC } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { selectSceneBounds } from '../../features/scene/sceneSelectors';
import { boxCenter } from '../../lib/geometry';
import { mmToScene } from '../../lib/units';
import type { ViewMode } from '../../features/editor/editorSlice';

interface OrbitHandle {
  target: Vector3;
  update: () => void;
}

const isOrbitHandle = (value: unknown): value is OrbitHandle =>
  typeof value === 'object' && value !== null && 'target' in value && 'update' in value;

const DIRECTIONS: Record<ViewMode, Vector3> = {
  free: new Vector3(0.55, 0.5, 0.8).normalize(),
  front: new Vector3(0, 0.08, 1).normalize(),
  side: new Vector3(1, 0.08, 0).normalize(),
  top: new Vector3(0, 1, 0.001).normalize(),
};

/** Orbit camera plus the preset views (free / front / side / top) framed on the scene. */
const CameraRig: FC = () => {
  const { camera, controls } = useThree();
  const view = useAppSelector((s) => s.editor.view);
  const viewRequest = useAppSelector((s) => s.editor.viewRequest);
  const isDragging = useAppSelector((s) => s.editor.isDragging);
  const bounds = useAppSelector(selectSceneBounds);

  useEffect(() => {
    if (!isOrbitHandle(controls)) return;
    const center = bounds ? boxCenter(bounds) : { x: 0, y: 500, z: 0 };
    const target = new Vector3(mmToScene(center.x), mmToScene(center.y), mmToScene(center.z));
    const extent = bounds ? mmToScene(Math.max(bounds.size.x, bounds.size.y, bounds.size.z)) : 150;
    const distance = Math.max(180, extent * 1.9);
    camera.position.copy(target).addScaledVector(DIRECTIONS[view], distance);
    controls.target.copy(target);
    controls.update();
    // Only re-frame on an explicit request (or first mount), not on every scene edit.
  }, [viewRequest, controls]);

  return (
    <OrbitControls
      makeDefault
      enabled={!isDragging}
      enableDamping
      dampingFactor={0.12}
      minDistance={30}
      maxDistance={3000}
      maxPolarAngle={view === 'top' ? Math.PI / 2 : Math.PI / 2 - 0.03}
    />
  );
};

export default CameraRig;
