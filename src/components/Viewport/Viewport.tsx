import type { FC } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  selectCollidingIds,
  selectSceneBounds,
  selectSelectedNode,
  selectVisibleNodes,
} from '../../features/scene/sceneSelectors';
import { selectPiece } from '../../features/editor/editorSlice';
import { boxCenter } from '../../lib/geometry';
import { mmToScene } from '../../lib/units';
import PieceMesh from '../PieceMesh';
import ResizeHandles from '../ResizeHandles';
import DimensionLabels from '../DimensionLabels';
import HumanFigure from '../HumanFigure';
import CameraRig from './CameraRig';
import styles from './Viewport.module.css';

/** Gap (cm) between the reference person and the left edge of the build. */
const HUMAN_GAP_CM = 45;

const Viewport: FC = () => {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector(selectVisibleNodes);
  const colliding = useAppSelector(selectCollidingIds);
  const selected = useAppSelector(selectSelectedNode);
  const bounds = useAppSelector(selectSceneBounds);
  const { tool, showHuman, showDimensions } = useAppSelector((s) => s.editor);

  const humanPosition: [number, number, number] = bounds
    ? [mmToScene(bounds.min.x) - HUMAN_GAP_CM, 0, mmToScene(boxCenter(bounds).z)]
    : [-80, 0, 0];

  return (
    <div className={styles.container}>
      <Canvas
        className={styles.canvas}
        dpr={[1, 2]}
        camera={{ fov: 45, near: 1, far: 20000, position: [250, 220, 320] }}
        onPointerMissed={() => dispatch(selectPiece(null))}
      >
        <color attach="background" args={['#f3f1ec']} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#ffffff', '#b9b2a5', 0.55]} />
        <directionalLight position={[300, 500, 400]} intensity={1.15} />
        <directionalLight position={[-400, 250, -300]} intensity={0.35} />

        <Grid
          infiniteGrid
          cellSize={10}
          sectionSize={100}
          cellThickness={0.6}
          sectionThickness={1.1}
          cellColor="#d9d3c6"
          sectionColor="#b4ab98"
          fadeDistance={2500}
          fadeStrength={1.5}
          position={[0, -0.02, 0]}
        />

        {nodes.map((node) => (
          <PieceMesh
            key={node.id}
            node={node}
            selected={node.id === selected?.id}
            colliding={colliding.has(node.id)}
          />
        ))}

        {selected && tool === 'resize' && <ResizeHandles node={selected} />}
        {selected && showDimensions && <DimensionLabels node={selected} />}
        {showHuman && <HumanFigure position={humanPosition} />}

        <CameraRig />
      </Canvas>
    </div>
  );
};

export default Viewport;
