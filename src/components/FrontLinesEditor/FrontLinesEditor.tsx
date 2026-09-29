import { useEffect, useRef, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import clsx from 'clsx';
import { IconMinus, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { SceneNode } from '../../types/scene';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { replaceWithPieces } from '../../features/scene/sceneSlice';
import { getImageUrl } from '../../features/images/imageRegistry';
import { resolveMaterial } from '../../lib/materials';
import { splitByFrontLines } from '../../lib/splitting';
import { formatCm } from '../../lib/units';
import styles from './FrontLinesEditor.module.css';

interface Line {
  id: number;
  dir: 'h' | 'v';
  /** 0–1: from the top for horizontal lines, from the left for vertical ones. */
  pos: number;
}

const evenly = (count: number, dir: Line['dir'], startId: number): Line[] =>
  Array.from({ length: count - 1 }, (_, i) => ({ id: startId + i, dir, pos: (i + 1) / count }));

interface FrontLinesEditorProps {
  node: SceneNode;
  onClose: () => void;
}

/**
 * Draw split lines on the front of a piece (e.g. between drawers) and turn each cell
 * into its own full-depth piece.
 */
const FrontLinesEditor: FC<FrontLinesEditorProps> = ({ node, onClose }) => {
  const dispatch = useAppDispatch();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<Line[]>(() => evenly(3, 'h', 1));
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const nextId = useRef(100);

  const { w, h } = node.sizeMm;
  const aspect = w / h;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = aspect >= 1 ? 800 : Math.round(800 * aspect);
    canvas.height = aspect >= 1 ? Math.round(800 / aspect) : 800;
    ctx.fillStyle = resolveMaterial(node.material).color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const frontId = node.material.type === 'photo' ? node.material.faces.front : undefined;
    const url = frontId ? getImageUrl(frontId) : undefined;
    if (!url || node.material.type !== 'photo') return;
    const crop = node.material.crop ?? { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
    const img = new Image();
    img.onload = () => {
      const sx = crop.x0 * img.width;
      const sw = (crop.x1 - crop.x0) * img.width;
      const sy = (1 - crop.y1) * img.height;
      const sh = (crop.y1 - crop.y0) * img.height;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    };
    img.src = url;
  }, [node, aspect]);

  const addLine = (dir: Line['dir']): void => {
    const id = nextId.current++;
    const existing = lines.filter((l) => l.dir === dir).map((l) => l.pos);
    // Put the new line in the middle of the widest gap.
    const edges = [0, ...existing.sort((a, b) => a - b), 1];
    let best = 0.5;
    let gap = 0;
    for (let i = 0; i < edges.length - 1; i += 1) {
      if (edges[i + 1] - edges[i] > gap) {
        gap = edges[i + 1] - edges[i];
        best = (edges[i] + edges[i + 1]) / 2;
      }
    }
    setLines((prev) => [...prev, { id, dir, pos: best }]);
    setSelectedLine(id);
  };

  const setEven = (dir: Line['dir'], delta: 1 | -1): void => {
    const count = Math.max(1, Math.min(12, lines.filter((l) => l.dir === dir).length + 1 + delta));
    const startId = nextId.current;
    nextId.current += count;
    setLines((prev) => [...prev.filter((l) => l.dir !== dir), ...evenly(count, dir, startId)]);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: number): void => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(id);
    setSelectedLine(id);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragging === null || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== dragging) return l;
        const raw = l.dir === 'h' ? (event.clientY - rect.top) / rect.height : (event.clientX - rect.left) / rect.width;
        return { ...l, pos: Math.min(0.98, Math.max(0.02, raw)) };
      }),
    );
  };

  const handleCreate = (): void => {
    const xs = lines.filter((l) => l.dir === 'v').map((l) => l.pos);
    const ys = lines.filter((l) => l.dir === 'h').map((l) => l.pos);
    const drafts = splitByFrontLines(node, xs, ys);
    if (drafts.length > 1) dispatch(replaceWithPieces(node.id, drafts));
    onClose();
  };

  const rows = lines.filter((l) => l.dir === 'h').length + 1;
  const cols = lines.filter((l) => l.dir === 'v').length + 1;
  const selected = lines.find((l) => l.id === selectedLine);
  const selectedLabel = selected
    ? selected.dir === 'h'
      ? `${formatCm(selected.pos * h)} ס״מ מלמעלה`
      : `${formatCm(selected.pos * w)} ס״מ משמאל`
    : null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="חלוקה לפי קווים">
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 className={styles.title}>חלוקת {node.name}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="סגור">
            <IconX size={22} />
          </button>
        </header>
        <p className={styles.hint}>גרור את הקווים לגבולות בין המגירות או הדלתות. כל תא יהפוך לחלק נפרד.</p>

        <div className={styles.stage}>
          <div
            ref={frameRef}
            className={styles.frame}
            style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(46dvh * ${aspect}))` }}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
          >
            <canvas ref={canvasRef} className={styles.canvas} />
            {lines.map((line) => (
              <div
                key={line.id}
                className={clsx(styles.line, line.dir === 'h' ? styles.lineH : styles.lineV, line.id === selectedLine && styles.lineOn)}
                style={line.dir === 'h' ? { top: `${line.pos * 100}%` } : { left: `${line.pos * 100}%` }}
                onPointerDown={(e) => handlePointerDown(e, line.id)}
              >
                <span className={styles.lineBar} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.stepper}>
            <span className={styles.stepLabel}>שורות</span>
            <button type="button" className={styles.stepButton} onClick={() => setEven('h', -1)} aria-label="פחות שורות">
              <IconMinus size={18} />
            </button>
            <span className={styles.stepValue}>{rows}</span>
            <button type="button" className={styles.stepButton} onClick={() => setEven('h', 1)} aria-label="עוד שורה">
              <IconPlus size={18} />
            </button>
          </div>
          <div className={styles.stepper}>
            <span className={styles.stepLabel}>עמודות</span>
            <button type="button" className={styles.stepButton} onClick={() => setEven('v', -1)} aria-label="פחות עמודות">
              <IconMinus size={18} />
            </button>
            <span className={styles.stepValue}>{cols}</span>
            <button type="button" className={styles.stepButton} onClick={() => setEven('v', 1)} aria-label="עוד עמודה">
              <IconPlus size={18} />
            </button>
          </div>
        </div>

        <div className={styles.lineRow}>
          <button type="button" className={styles.chip} onClick={() => addLine('h')}>
            + קו אופקי
          </button>
          <button type="button" className={styles.chip} onClick={() => addLine('v')}>
            + קו אנכי
          </button>
          {selected && (
            <>
              <span className={styles.lineInfo}>{selectedLabel}</span>
              <button
                type="button"
                className={clsx(styles.chip, styles.danger)}
                onClick={() => {
                  setLines((prev) => prev.filter((l) => l.id !== selected.id));
                  setSelectedLine(null);
                }}
                aria-label="מחק קו"
              >
                <IconTrash size={16} />
              </button>
            </>
          )}
        </div>

        <button type="button" className={styles.primary} onClick={handleCreate} disabled={rows * cols < 2}>
          צור {rows * cols} חלקים
        </button>
      </div>
    </div>
  );
};

export default FrontLinesEditor;
