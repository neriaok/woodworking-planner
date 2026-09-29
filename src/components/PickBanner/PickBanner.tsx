import type { FC } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { groupNodes } from '../../features/scene/sceneSlice';
import { cancelPicking } from '../../features/editor/editorSlice';
import styles from './PickBanner.module.css';

/** Shown while choosing pieces to group: tapping pieces toggles them. */
const PickBanner: FC = () => {
  const dispatch = useAppDispatch();
  const pickMode = useAppSelector((s) => s.editor.pickMode);
  const anchorName = useAppSelector((s) => s.scene.nodes.find((n) => n.id === s.editor.pickMode?.anchorId)?.name);
  if (!pickMode) return null;
  const count = pickMode.picked.length;

  return (
    <section className={styles.banner} aria-live="polite">
      <p className={styles.text}>
        הקש על החלקים שיצטרפו ל{anchorName ? `"${anchorName}"` : 'קבוצה'} · נבחרו {count}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => dispatch(cancelPicking())}>
          ביטול
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={count < 2}
          onClick={() => dispatch(groupNodes(pickMode.picked, 'קבוצה'))}
        >
          קבץ {count} חלקים
        </button>
      </div>
    </section>
  );
};

export default PickBanner;
