import type { FC } from 'react';

/** Reference person, 175 cm tall, so the sketch reads at real-world scale. */
const HEIGHT_CM = 175;
const COLOR = '#9da3a8';
const noRaycast = (): null => null;

interface HumanFigureProps {
  /** Position of the figure's feet (scene units, cm). */
  position: [number, number, number];
}

const HumanFigure: FC<HumanFigureProps> = ({ position }) => {
  const legH = 82;
  const torsoH = 62;
  const headR = 11;
  return (
    <group position={position}>
      {[-9, 9].map((x) => (
        <mesh key={x} position={[x, legH / 2, 0]} raycast={noRaycast}>
          <capsuleGeometry args={[6, legH - 12, 4, 12]} />
          <meshStandardMaterial color={COLOR} transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh position={[0, legH + torsoH / 2, 0]} raycast={noRaycast}>
        <capsuleGeometry args={[18, torsoH - 36, 4, 16]} />
        <meshStandardMaterial color={COLOR} transparent opacity={0.55} />
      </mesh>
      {[-24, 24].map((x) => (
        <mesh key={x} position={[x, legH + torsoH - 30, 0]} raycast={noRaycast}>
          <capsuleGeometry args={[4.5, 52, 4, 10]} />
          <meshStandardMaterial color={COLOR} transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT_CM - headR, 0]} raycast={noRaycast}>
        <sphereGeometry args={[headR, 20, 16]} />
        <meshStandardMaterial color={COLOR} transparent opacity={0.55} />
      </mesh>
    </group>
  );
};

export default HumanFigure;
