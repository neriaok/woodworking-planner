import { useEffect, useRef, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import clsx from 'clsx';
import type { Point, Quad } from '../../lib/homography';
import type { LoadedPhoto } from '../../features/images/photoProcessing';
import styles from './CornerEditor.module.css';

export type QuadTarget = 'part' | 'reference';

const LOUPE_SIZE = 120;
const LOUPE_ZOOM = 3;

interface DragState {
  target: QuadTarget;
  index: number;
  point: Point;
}

interface CornerEditorProps {
  photo: LoadedPhoto;
  quad: Quad;
  referenceQuad: Quad | null;
  onChange: (target: QuadTarget, quad: Quad) => void;
}

/**
 * Photo with draggable corner handles. While a corner is dragged a magnifier shows
 * the area under the finger, so corners can be placed precisely on a phone.
 */
const CornerEditor: FC<CornerEditorProps> = ({ photo, quad, referenceQuad, onChange }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const toImage = (clientX: number, clientY: number): Point | null => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(photo.width, ((clientX - rect.left) / rect.width) * photo.width)),
      y: Math.max(0, Math.min(photo.height, ((clientY - rect.top) / rect.height) * photo.height)),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, target: QuadTarget, index: number): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const source = target === 'part' ? quad : referenceQuad;
    if (source) setDrag({ target, index, point: source[index] });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag) return;
    const point = toImage(event.clientX, event.clientY);
    if (!point) return;
    const source = drag.target === 'part' ? quad : referenceQuad;
    if (!source) return;
    const next = source.map((p, i) => (i === drag.index ? point : p)) as Quad;
    onChange(drag.target, next);
    setDrag({ ...drag, point });
  };

  const handlePointerUp = (): void => setDrag(null);

  useEffect(() => {
    const canvas = loupeRef.current;
    if (!drag || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = LOUPE_SIZE * ratio;
    canvas.height = LOUPE_SIZE * ratio;
    const rect = wrapRef.current?.getBoundingClientRect();
    const displayScale = rect ? rect.width / photo.width : 1;
    const srcSize = LOUPE_SIZE / (LOUPE_ZOOM * displayScale);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      photo.canvas,
      drag.point.x - srcSize / 2,
      drag.point.y - srcSize / 2,
      srcSize,
      srcSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [drag, photo]);

  const toPercent = (p: Point) => ({ left: `${(p.x / photo.width) * 100}%`, top: `${(p.y / photo.height) * 100}%` });
  const polygon = (q: Quad) => q.map((p) => `${p.x},${p.y}`).join(' ');

  /** Put the magnifier in the corner away from the finger. */
  const loupeOnLeft = drag ? drag.point.x > photo.width / 2 : true;

  const renderHandles = (q: Quad, target: QuadTarget) =>
    q.map((p, index) => (
      <div
        key={`${target}-${index}`}
        className={clsx(styles.handle, target === 'reference' && styles.reference)}
        style={toPercent(p)}
        onPointerDown={(e) => handlePointerDown(e, target, index)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label={`פינה ${index + 1}`}
        aria-valuenow={Math.round(p.x)}
      >
        <span className={styles.dot} />
      </div>
    ));

  return (
    <div className={styles.frame}>
      <div ref={wrapRef} className={styles.wrap}>
        <img src={photo.displayUrl} alt="" className={styles.image} draggable={false} />
        <svg className={styles.overlay} viewBox={`0 0 ${photo.width} ${photo.height}`} preserveAspectRatio="none">
          <polygon points={polygon(quad)} className={styles.partShape} vectorEffect="non-scaling-stroke" />
          {referenceQuad && (
            <polygon points={polygon(referenceQuad)} className={styles.referenceShape} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {renderHandles(quad, 'part')}
        {referenceQuad && renderHandles(referenceQuad, 'reference')}
        {drag && (
          <div className={clsx(styles.loupe, loupeOnLeft ? styles.loupeLeft : styles.loupeRight)}>
            <canvas ref={loupeRef} className={styles.loupeCanvas} />
            <span className={styles.crosshair} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CornerEditor;
