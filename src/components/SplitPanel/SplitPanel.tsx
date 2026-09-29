import { useEffect, useState, type FC } from 'react';
import clsx from 'clsx';
import { IconCut, IconLayoutRows, IconBox } from '@tabler/icons-react';
import type { Axis, SceneNode } from '../../types/scene';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { replaceWithPieces } from '../../features/scene/sceneSlice';
import { setCutPreview } from '../../features/editor/editorSlice';
import { nodeBox } from '../../lib/geometry';
import { cutPiece, panelize, type PanelOptions } from '../../lib/splitting';
import { formatCm, parseCmToMm } from '../../lib/units';
import FrontLinesEditor from '../FrontLinesEditor';
import styles from './SplitPanel.module.css';

type Mode = 'cut' | 'panels' | 'lines';

const AXES: readonly { axis: Axis; label: string }[] = [
  { axis: 'x', label: 'לרוחב' },
  { axis: 'y', label: 'לגובה' },
  { axis: 'z', label: 'לעומק' },
];

const PANEL_PARTS: readonly { key: keyof Omit<PanelOptions, 'thicknessMm'>; label: string }[] = [
  { key: 'top', label: 'עליון' },
  { key: 'bottom', label: 'תחתון' },
  { key: 'sides', label: 'צדדים' },
  { key: 'back', label: 'גב' },
  { key: 'front', label: 'חזית' },
];

interface SplitPanelProps {
  node: SceneNode;
}

/** Split tool: cut a piece in two, break it into carcass boards, or divide it by lines. */
const SplitPanel: FC<SplitPanelProps> = ({ node }) => {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<Mode>('cut');
  const [axis, setAxis] = useState<Axis>('x');
  const box = nodeBox(node);
  const length = box.size[axis];
  const [offsetMm, setOffsetMm] = useState(Math.round(length / 2 / 5) * 5);
  const [thicknessText, setThicknessText] = useState('1.8');
  const [parts, setParts] = useState<Omit<PanelOptions, 'thicknessMm'>>({
    top: true,
    bottom: true,
    sides: true,
    back: true,
    front: false,
  });
  const [isLinesOpen, setIsLinesOpen] = useState(false);

  // Start in the middle again whenever the axis, the piece or its length changes.
  useEffect(() => {
    setOffsetMm(Math.round(length / 2 / 5) * 5);
  }, [axis, node.id, length]);

  useEffect(() => {
    dispatch(mode === 'cut' ? setCutPreview({ id: node.id, axis, offsetMm }) : setCutPreview(null));
  }, [dispatch, mode, node.id, axis, offsetMm]);

  useEffect(() => () => void dispatch(setCutPreview(null)), [dispatch]);

  const thicknessMm = parseCmToMm(thicknessText);
  const panelError =
    thicknessMm === null || thicknessMm < 5
      ? 'הזן עובי של 0.5 ס״מ לפחות'
      : thicknessMm * 2 >= Math.min(node.sizeMm.w, node.sizeMm.h)
        ? 'העובי גדול מדי ביחס לחלק'
        : null;

  const handleCut = (): void => {
    const drafts = cutPiece(node, axis, offsetMm);
    if (drafts) dispatch(replaceWithPieces(node.id, drafts));
  };

  const handlePanels = (): void => {
    if (panelError || thicknessMm === null) return;
    const drafts = panelize(node, { thicknessMm, ...parts });
    if (drafts.length > 0) dispatch(replaceWithPieces(node.id, drafts));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.modes} role="tablist">
        {(
          [
            ['cut', 'חיתוך', <IconCut key="i" size={18} />],
            ['panels', 'לדפנות', <IconBox key="i" size={18} />],
            ['lines', 'לפי קווים', <IconLayoutRows key="i" size={18} />],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={clsx(styles.mode, mode === value && styles.modeOn)}
            onClick={() => setMode(value)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {mode === 'cut' && (
        <div className={styles.body}>
          <div className={styles.row}>
            {AXES.map(({ axis: a, label }) => (
              <button
                key={a}
                type="button"
                className={clsx(styles.chip, axis === a && styles.chipOn)}
                onClick={() => setAxis(a)}
                aria-pressed={axis === a}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.row}>
            <input
              type="range"
              className={styles.slider}
              min={5}
              max={Math.max(5, length - 5)}
              step={5}
              value={offsetMm}
              onChange={(e) => setOffsetMm(Number(e.target.value))}
              aria-label="מיקום החיתוך"
              dir="ltr"
            />
            <span className={styles.readout}>
              {formatCm(offsetMm)} | {formatCm(length - offsetMm)}
            </span>
          </div>
          <button type="button" className={styles.primary} onClick={handleCut}>
            חתוך כאן
          </button>
        </div>
      )}

      {mode === 'panels' && (
        <div className={styles.body}>
          <div className={styles.row}>
            <label className={styles.thickness}>
              עובי (ס״מ)
              <input
                className={styles.input}
                inputMode="decimal"
                value={thicknessText}
                onChange={(e) => setThicknessText(e.target.value)}
              />
            </label>
            {PANEL_PARTS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={clsx(styles.chip, parts[key] && styles.chipOn)}
                onClick={() => setParts((p) => ({ ...p, [key]: !p[key] }))}
                aria-pressed={parts[key]}
              >
                {label}
              </button>
            ))}
          </div>
          {panelError && <p className={styles.error}>{panelError}</p>}
          <button type="button" className={styles.primary} onClick={handlePanels} disabled={!!panelError}>
            פרק לדפנות
          </button>
        </div>
      )}

      {mode === 'lines' && (
        <div className={styles.body}>
          <p className={styles.hint}>מסמנים קווים על החזית (למשל בין מגירות), וכל תא הופך לחלק נפרד.</p>
          <button type="button" className={styles.primary} onClick={() => setIsLinesOpen(true)}>
            סמן קווים על החזית
          </button>
        </div>
      )}

      {isLinesOpen && <FrontLinesEditor node={node} onClose={() => setIsLinesOpen(false)} />}
    </div>
  );
};

export default SplitPanel;
