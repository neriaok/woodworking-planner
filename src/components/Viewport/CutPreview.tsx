import type { FC } from 'react';
import { DoubleSide } from 'three';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { nodeBox } from '../../lib/geometry';
import { mmToScene } from '../../lib/units';

/** Translucent plane showing where the pending cut will go. */
const CutPreview: FC = () => {
  const preview = useAppSelector((s) => s.editor.cutPreview);
  const node = useAppSelector((s) => s.scene.nodes.find((n) => n.id === preview?.id));
  if (!preview || !node || node.type !== 'piece') return null;

  const box = nodeBox(node);
  const pad = 30; // mm beyond the piece so the plane reads clearly
  const center = {
    x: box.min.x + box.size.x / 2,
    y: box.min.y + box.size.y / 2,
    z: box.min.z + box.size.z / 2,
  };
  center[preview.axis] = box.min[preview.axis] + preview.offsetMm;

  const [width, height, rotation]: [number, number, [number, number, number]] =
    preview.axis === 'x'
      ? [box.size.z + pad, box.size.y + pad, [0, Math.PI / 2, 0]]
      : preview.axis === 'y'
        ? [box.size.x + pad, box.size.z + pad, [-Math.PI / 2, 0, 0]]
        : [box.size.x + pad, box.size.y + pad, [0, 0, 0]];

  return (
    <mesh
      position={[mmToScene(center.x), mmToScene(center.y), mmToScene(center.z)]}
      rotation={rotation}
      raycast={() => null}
      renderOrder={20}
    >
      <planeGeometry args={[mmToScene(width), mmToScene(height)]} />
      <meshBasicMaterial color="#e24b4a" transparent opacity={0.35} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
};

export default CutPreview;
