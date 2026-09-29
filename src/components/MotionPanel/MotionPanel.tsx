import type { FC } from 'react';
import clsx from 'clsx';
import { IconAlertTriangle, IconEyeOff } from '@tabler/icons-react';
import type { Motion, SceneNode } from '../../types/scene';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setHidden, setMotion, setOpenAmount } from '../../features/scene/sceneSlice';
import { selectMotionTargets, selectNodes } from '../../features/scene/sceneSelectors';
import { defaultMotion, frontDirection, type HingeSide } from '../../lib/motion';
import { orientationOf, targetBox } from '../../lib/sceneTree';
import { formatCm } from '../../lib/units';
import styles from './MotionPanel.module.css';

type Kind = 'fixed' | 'door' | 'drawer';

const KINDS: readonly { kind: Kind; label: string }[] = [
  { kind: 'fixed', label: 'קבוע' },
  { kind: 'door', label: 'דלת' },
  { kind: 'drawer', label: 'מגירה' },
];

const SIDES: readonly { side: HingeSide; label: string }[] = [
  { side: 'right', label: 'ציר ימין' },
  { side: 'left', label: 'ציר שמאל' },
  { side: 'top', label: 'ציר למעלה' },
  { side: 'bottom', label: 'ציר למטה' },
];

interface MotionPanelProps {
  node: SceneNode;
}

/** Make the selected piece or group a door or drawer, and open or close it. */
const MotionPanel: FC<MotionPanelProps> = ({ node }) => {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector(selectNodes);
  const blocked = useAppSelector((s) => selectMotionTargets(s).find((t) => t.owner.id === node.id)?.blocked ?? false);
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : undefined;

  const motion = node.motion;
  const kind: Kind = !motion ? 'fixed' : motion.type === 'hinge' ? 'door' : 'drawer';
  const open = node.openAmount ?? 0;

  const handleKind = (next: Kind): void => {
    if (next === kind) return;
    const box = targetBox(nodes, node.id);
    if (next === 'fixed' || !box) {
      dispatch(setMotion({ id: node.id, motion: null }));
      return;
    }
    dispatch(setMotion({ id: node.id, motion: defaultMotion(next, box, orientationOf(nodes, node)) }));
    dispatch(setOpenAmount({ id: node.id, amount: 1 }));
  };

  const update = (next: Motion): void => {
    dispatch(setMotion({ id: node.id, motion: next }));
  };

  const box = targetBox(nodes, node.id);
  const depth = box ? box.size[frontDirection(orientationOf(nodes, node)).axis] : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        {KINDS.map(({ kind: k, label }) => (
          <button
            key={k}
            type="button"
            className={clsx(styles.chip, kind === k && styles.chipOn)}
            onClick={() => handleKind(k)}
            aria-pressed={kind === k}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={clsx(styles.chip, styles.hide)}
          onClick={() => dispatch(setHidden({ id: node.id, hidden: true }))}
          title="הסתר זמנית"
        >
          <IconEyeOff size={16} />
          הסתר
        </button>
      </div>

      {motion?.type === 'hinge' && (
        <div className={styles.row}>
          {SIDES.map(({ side, label }) => (
            <button
              key={side}
              type="button"
              className={clsx(styles.chip, styles.small, motion.side === side && styles.chipOn)}
              onClick={() => update({ ...motion, side })}
              aria-pressed={motion.side === side}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {motion && (
        <div className={styles.sliders}>
          {motion.type === 'hinge' ? (
            <label className={styles.slider}>
              <span>זווית מקסימלית</span>
              <input
                type="range"
                min={30}
                max={180}
                step={5}
                value={motion.maxAngleDeg}
                onChange={(e) => update({ ...motion, maxAngleDeg: Number(e.target.value) })}
                dir="ltr"
              />
              <span className={styles.value}>{motion.maxAngleDeg}°</span>
            </label>
          ) : (
            <label className={styles.slider}>
              <span>שליפה</span>
              <input
                type="range"
                min={50}
                max={Math.max(50, depth)}
                step={10}
                value={motion.distanceMm}
                onChange={(e) => update({ ...motion, distanceMm: Number(e.target.value) })}
                dir="ltr"
              />
              <span className={styles.value}>{formatCm(motion.distanceMm)} ס״מ</span>
            </label>
          )}
          <label className={styles.slider}>
            <span>פתוח</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(open * 100)}
              onChange={(e) => dispatch(setOpenAmount({ id: node.id, amount: Number(e.target.value) / 100 }))}
              dir="ltr"
            />
            <span className={styles.value}>{Math.round(open * 100)}%</span>
          </label>
        </div>
      )}

      {blocked && (
        <p className={styles.warning} role="alert">
          <IconAlertTriangle size={16} />
          משהו חוסם את הפתיחה. החלקים שבדרך מסומנים באדום.
        </p>
      )}
      {!motion && parent && !parent.motion && (
        <p className={styles.hint}>
          המגירה או הדלת מורכבת מכמה חלקים? בחר את הקבוצה &quot;{parent.name}&quot; והגדר אותה.
        </p>
      )}
    </div>
  );
};

export default MotionPanel;
