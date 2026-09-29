import { useRef, type FC, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Vector3, type Group } from 'three';
import type { Box, Motion, Rotation } from '../../types/scene';
import { motionTransform } from '../../lib/motion';
import { mmToScene } from '../../lib/units';

const AXIS = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
/** How quickly doors and drawers ease towards their target (per second). */
const SPEED = 7;

interface MotionGroupProps {
  box: Box;
  rotation: Rotation;
  motion: Motion;
  /** Target opening, 0 closed … 1 open; the group eases towards it. */
  amount: number;
  children: ReactNode;
}

/** Wraps the pieces of one door or drawer and animates them open and closed. */
const MotionGroup: FC<MotionGroupProps> = ({ box, rotation, motion, amount, children }) => {
  const ref = useRef<Group>(null);
  const current = useRef(amount);
  const matrix = useRef(new Matrix4());
  const temp = useRef(new Matrix4());

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const diff = amount - current.current;
    current.current = Math.abs(diff) < 0.001 ? amount : current.current + diff * Math.min(1, delta * SPEED);
    const m = motionTransform(box, rotation, motion, current.current);
    const pivot = new Vector3(mmToScene(m.pivot.x), mmToScene(m.pivot.y), mmToScene(m.pivot.z));
    matrix.current
      .makeTranslation(mmToScene(m.offset.x), mmToScene(m.offset.y), mmToScene(m.offset.z))
      .multiply(temp.current.makeTranslation(pivot.x, pivot.y, pivot.z))
      .multiply(temp.current.makeRotationAxis(AXIS[m.axis], m.angle))
      .multiply(temp.current.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    group.matrix.copy(matrix.current);
    group.matrixWorldNeedsUpdate = true;
  });

  return (
    <group ref={ref} matrixAutoUpdate={false}>
      {children}
    </group>
  );
};

export default MotionGroup;
