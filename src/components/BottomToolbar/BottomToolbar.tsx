import { useEffect, useState, type FC, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconArrowsMove, IconCut, IconDimensions, IconRotateClockwise2 } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { setTool, type Tool } from '../../features/editor/editorSlice';
import styles from './BottomToolbar.module.css';

const TOOLS: readonly { tool: Tool; label: string; icon: ReactNode; comingIn?: string }[] = [
  { tool: 'move', label: 'הזז', icon: <IconArrowsMove size={22} /> },
  { tool: 'rotate', label: 'סובב', icon: <IconRotateClockwise2 size={22} /> },
  { tool: 'resize', label: 'גודל', icon: <IconDimensions size={22} /> },
  { tool: 'split', label: 'פרק', icon: <IconCut size={22} /> },
];

const HINTS: Record<Tool, string> = {
  move: 'גרור חלק כדי להזיז אותו · הקשה נוספת על קבוצה בוחרת חלק בתוכה',
  rotate: 'בחר חלק ולחץ על כפתורי הסיבוב',
  resize: 'גרור את הנקודות הכחולות כדי להאריך או לקצר',
  split: 'חתוך חלק, פרק אותו לדפנות או חלק אותו לפי קווים',
};

const BottomToolbar: FC = () => {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((s) => s.editor.tool);
  const hasSelection = useAppSelector((s) => s.editor.selectedId !== null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const hint = toast ?? (hasSelection || activeTool === 'move' ? HINTS[activeTool] : 'בחר חלק');

  return (
    <div className={styles.wrap}>
      <p className={clsx(styles.hint, toast && styles.toast)} aria-live="polite">
        {hint}
      </p>
      <nav className={styles.toolbar} aria-label="כלים">
        {TOOLS.map(({ tool, label, icon, comingIn }) => (
          <button
            key={tool}
            type="button"
            className={clsx(styles.tool, activeTool === tool && styles.active, comingIn && styles.soon)}
            onClick={() => (comingIn ? setToast(comingIn) : dispatch(setTool(tool)))}
            aria-pressed={activeTool === tool}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default BottomToolbar;
