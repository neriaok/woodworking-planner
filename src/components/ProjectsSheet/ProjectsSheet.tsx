import { useEffect, useState, type ChangeEvent, type FC } from 'react';
import clsx from 'clsx';
import { IconDownload, IconFolderOpen, IconPlus, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { loadProject, newProject } from '../../features/scene/sceneSlice';
import { setLibrary } from '../../features/library/librarySlice';
import * as storage from '../../features/storage/storage';
import { parseBackup, type ProjectSummary } from '../../lib/projectFile';
import styles from './ProjectsSheet.module.css';

const formatDate = (ms: number): string =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms);

interface ProjectsSheetProps {
  onClose: () => void;
}

/** Saved projects on this device, plus backup export/import. */
const ProjectsSheet: FC<ProjectsSheetProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const currentId = useAppSelector((s) => s.scene.projectId);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const refresh = (): void => {
    storage
      .listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  };

  useEffect(refresh, []);

  const handleOpen = async (id: string): Promise<void> => {
    const project = await storage.loadProject(id);
    if (project) {
      dispatch(loadProject(project));
      onClose();
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    await storage.deleteProject(id);
    setConfirmDelete(null);
    if (id === currentId) dispatch(newProject());
    refresh();
  };

  const handleExport = async (): Promise<void> => {
    try {
      const backup = await storage.buildBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `woodworking-planner-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage({ text: 'קובץ הגיבוי ירד למכשיר' });
    } catch {
      setMessage({ text: 'יצירת הגיבוי נכשלה', error: true });
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const backup = parseBackup(await file.text());
    if (!backup) {
      setMessage({ text: 'זה לא קובץ גיבוי של מתכנן עבודות עץ', error: true });
      return;
    }
    try {
      const count = await storage.restoreBackup(backup);
      dispatch(setLibrary(await storage.loadLibrary()));
      setMessage({ text: `שוחזרו ${count} פרויקטים ו־${backup.library.length} חלקים למלאי` });
      refresh();
    } catch {
      setMessage({ text: 'השחזור נכשל', error: true });
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <section className={styles.sheet} onClick={(e) => e.stopPropagation()} aria-label="הפרויקטים שלי">
        <header className={styles.header}>
          <h2 className={styles.title}>הפרויקטים שלי</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="סגור">
            <IconX size={22} />
          </button>
        </header>

        <button
          type="button"
          className={styles.newButton}
          onClick={() => {
            dispatch(newProject());
            onClose();
          }}
        >
          <IconPlus size={20} />
          פרויקט חדש
        </button>

        {projects === null && <p className={styles.muted}>טוען…</p>}
        {projects?.length === 0 && <p className={styles.muted}>עוד אין פרויקטים שמורים. כל שינוי נשמר אוטומטית במכשיר.</p>}

        <ul className={styles.list}>
          {projects?.map((p) => (
            <li key={p.id} className={clsx(styles.item, p.id === currentId && styles.current)}>
              <button type="button" className={styles.itemMain} onClick={() => void handleOpen(p.id)}>
                <IconFolderOpen size={20} />
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{p.name}</span>
                  <span className={styles.itemMeta}>
                    {p.pieceCount} חלקים · {formatDate(p.updatedAt)}
                    {p.id === currentId ? ' · פתוח' : ''}
                  </span>
                </span>
              </button>
              {confirmDelete === p.id ? (
                <span className={styles.confirm}>
                  <button type="button" className={styles.danger} onClick={() => void handleDelete(p.id)}>
                    מחק
                  </button>
                  <button type="button" className={styles.plain} onClick={() => setConfirmDelete(null)}>
                    ביטול
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setConfirmDelete(p.id)}
                  aria-label={`מחק את ${p.name}`}
                >
                  <IconTrash size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className={styles.backup}>
          <span className={styles.muted}>גיבוי של כל הפרויקטים, המלאי והתמונות בקובץ אחד:</span>
          <div className={styles.backupRow}>
            <button type="button" className={styles.secondary} onClick={() => void handleExport()}>
              <IconDownload size={18} />
              ייצוא גיבוי
            </button>
            <label className={styles.secondary}>
              <IconUpload size={18} />
              ייבוא גיבוי
              <input type="file" accept="application/json,.json" className={styles.fileInput} onChange={(e) => void handleImport(e)} />
            </label>
          </div>
          {message && <p className={clsx(styles.message, message.error && styles.error)}>{message.text}</p>}
        </div>
      </section>
    </div>
  );
};

export default ProjectsSheet;
