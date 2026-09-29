import type { FC } from 'react';
import { Html, Line } from '@react-three/drei';
import type { Box } from '../../types/scene';
import { boxMax } from '../../lib/geometry';
import { formatCm, mmToScene } from '../../lib/units';
import styles from './DimensionLabels.module.css';

/** Distance (cm) the dimension lines sit away from the piece. */
const OFFSET = 6;
const LINE_COLOR = '#1f6fd1';

interface DimensionLineProps {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
}

const DimensionLine: FC<DimensionLineProps> = ({ from, to, label }) => {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  return (
    <group>
      <Line points={[from, to]} color={LINE_COLOR} lineWidth={1.5} depthTest={false} renderOrder={5} />
      <Html position={mid} center zIndexRange={[20, 0]} className={styles.anchor}>
        <span className={styles.label}>{label}</span>
      </Html>
    </group>
  );
};

interface DimensionLabelsProps {
  /** The box to measure: a piece, or the outline of a group. */
  box: Box;
}

const DimensionLabels: FC<DimensionLabelsProps> = ({ box }) => {
  const x0 = mmToScene(box.min.x);
  const x1 = mmToScene(boxMax(box, 'x'));
  const y0 = mmToScene(box.min.y);
  const y1 = mmToScene(boxMax(box, 'y'));
  const z0 = mmToScene(box.min.z);
  const z1 = mmToScene(boxMax(box, 'z'));

  return (
    <group>
      <DimensionLine
        from={[x0, y0, z1 + OFFSET]}
        to={[x1, y0, z1 + OFFSET]}
        label={`${formatCm(box.size.x)} ס״מ`}
      />
      <DimensionLine
        from={[x0 - OFFSET, y0, z1]}
        to={[x0 - OFFSET, y1, z1]}
        label={`${formatCm(box.size.y)}`}
      />
      <DimensionLine
        from={[x1 + OFFSET, y0, z0]}
        to={[x1 + OFFSET, y0, z1]}
        label={`${formatCm(box.size.z)}`}
      />
    </group>
  );
};

export default DimensionLabels;
