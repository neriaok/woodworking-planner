import type { FC } from 'react';
import clsx from 'clsx';
import { IconDoor, IconDoorExit, IconEye } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setAllOpen } from '../../features/scene/sceneSlice';
import { toggleXray } from '../../features/editor/editorSlice';
import { selectMotionTargets } from '../../features/scene/sceneSelectors';
import styles from './StageControls.module.css';

/** Floating buttons: open/close every door and drawer, and see-through mode. */
const StageControls: FC = () => {
  const dispatch = useAppDispatch();
  const xray = useAppSelector((s) => s.editor.xray);
  const targets = useAppSelector(selectMotionTargets);
  const anyOpen = targets.some((t) => (t.owner.openAmount ?? 0) > 0.5);

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={clsx(styles.button, xray && styles.on)}
        onClick={() => dispatch(toggleXray())}
        aria-pressed={xray}
      >
        <IconEye size={18} />
        שקוף
      </button>
      {targets.length > 0 && (
        <button type="button" className={styles.button} onClick={() => dispatch(setAllOpen(anyOpen ? 0 : 1))}>
          {anyOpen ? <IconDoor size={18} /> : <IconDoorExit size={18} />}
          {anyOpen ? 'סגור הכול' : 'פתח הכול'}
        </button>
      )}
    </div>
  );
};

export default StageControls;
