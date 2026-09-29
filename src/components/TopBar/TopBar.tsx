import { useState, type FC } from 'react';
import clsx from 'clsx';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCheck,
  IconDotsVertical,
} from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { selectCanRedo, selectCanUndo, selectHiddenCount } from '../../features/scene/sceneSelectors';
import { loadDemo, redo, renameProject, showAllHidden, undo } from '../../features/scene/sceneSlice';
import ProjectsSheet from '../ProjectsSheet';
import {
  toggleDimensions,
  toggleGridSnap,
  toggleHuman,
} from '../../features/editor/editorSlice';
import styles from './TopBar.module.css';

const SAVE_LABELS = { idle: '', saving: 'שומר…', saved: 'נשמר', error: 'השמירה נכשלה' } as const;

interface MenuToggleProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

const MenuToggle: FC<MenuToggleProps> = ({ label, checked, onToggle }) => (
  <button type="button" className={styles.menuItem} onClick={onToggle} role="menuitemcheckbox" aria-checked={checked}>
    <span className={clsx(styles.check, checked && styles.checkOn)}>
      {checked && <IconCheck size={14} stroke={3} />}
    </span>
    {label}
  </button>
);

const TopBar: FC = () => {
  const dispatch = useAppDispatch();
  const projectName = useAppSelector((s) => s.scene.projectName);
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const { gridSnap, showHuman, showDimensions } = useAppSelector((s) => s.editor);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hiddenCount = useAppSelector(selectHiddenCount);
  const saveStatus = useAppSelector((s) => s.editor.saveStatus);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);

  const runAndClose = (action: () => void): void => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <header className={styles.bar}>
      <input
        className={styles.name}
        value={projectName}
        onChange={(e) => dispatch(renameProject(e.target.value))}
        aria-label="שם הפרויקט"
      />
      <span className={clsx(styles.status, saveStatus === 'error' && styles.statusError)} aria-live="polite">
        {SAVE_LABELS[saveStatus]}
      </span>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => dispatch(undo())}
          disabled={!canUndo}
          aria-label="בטל"
        >
          <IconArrowForwardUp size={22} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => dispatch(redo())}
          disabled={!canRedo}
          aria-label="בצע שוב"
        >
          <IconArrowBackUp size={22} />
        </button>
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label="תפריט"
            aria-expanded={isMenuOpen}
          >
            <IconDotsVertical size={22} />
          </button>
          {isMenuOpen && (
            <>
              <div className={styles.backdrop} onClick={() => setIsMenuOpen(false)} />
              <div className={styles.menu} role="menu">
                <MenuToggle label="הצמדה לרשת (1 ס״מ)" checked={gridSnap} onToggle={() => dispatch(toggleGridSnap())} />
                <MenuToggle label="הצג מידות" checked={showDimensions} onToggle={() => dispatch(toggleDimensions())} />
                <MenuToggle label="דמות אדם (175 ס״מ)" checked={showHuman} onToggle={() => dispatch(toggleHuman())} />
                {hiddenCount > 0 && (
                  <button type="button" className={styles.menuItem} onClick={() => runAndClose(() => dispatch(showAllHidden()))}>
                    הצג חלקים מוסתרים ({hiddenCount})
                  </button>
                )}
                <div className={styles.divider} />
                <button type="button" className={styles.menuItem} onClick={() => runAndClose(() => setIsProjectsOpen(true))}>
                  הפרויקטים שלי · גיבוי
                </button>
                <button type="button" className={styles.menuItem} onClick={() => runAndClose(() => dispatch(loadDemo()))}>
                  טען דוגמה: אי מטבח
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {isProjectsOpen && <ProjectsSheet onClose={() => setIsProjectsOpen(false)} />}
    </header>
  );
};

export default TopBar;
