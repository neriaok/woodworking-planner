import type { FC } from 'react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { requestView, type ViewMode } from '../../features/editor/editorSlice';
import styles from './ViewSwitcher.module.css';

const VIEWS: readonly { mode: ViewMode; label: string }[] = [
  { mode: 'free', label: '3D' },
  { mode: 'front', label: 'חזית' },
  { mode: 'side', label: 'צד' },
  { mode: 'top', label: 'למעלה' },
];

const ViewSwitcher: FC = () => {
  const dispatch = useAppDispatch();
  const view = useAppSelector((s) => s.editor.view);

  return (
    <div className={styles.group} role="group" aria-label="מבט">
      {VIEWS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={clsx(styles.button, view === mode && styles.active)}
          onClick={() => dispatch(requestView(mode))}
          aria-pressed={view === mode}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
