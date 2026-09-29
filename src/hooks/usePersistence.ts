import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './useAppDispatch';
import { loadProject } from '../features/scene/sceneSlice';
import { setSaveStatus } from '../features/editor/editorSlice';
import { setLibrary } from '../features/library/librarySlice';
import * as storage from '../features/storage/storage';

const SAVE_DELAY_MS = 700;

/**
 * Loads the last project and the inventory on start, then autosaves both
 * shortly after every change. Nothing is saved before the first load finishes,
 * so a slow start can never overwrite stored work with the demo scene.
 */
export const usePersistence = (): void => {
  const dispatch = useAppDispatch();
  const { projectId, projectName, nodes } = useAppSelector((s) => s.scene);
  const library = useAppSelector((s) => s.library);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lastId, items] = await Promise.all([storage.getLastProjectId(), storage.loadLibrary()]);
        if (cancelled) return;
        dispatch(setLibrary(items));
        if (lastId) {
          const project = await storage.loadProject(lastId);
          if (project && !cancelled) dispatch(loadProject(project));
        }
      } catch {
        dispatch(setSaveStatus('error'));
        dispatch(setLibrary([]));
      } finally {
        hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated.current) return undefined;
    dispatch(setSaveStatus('saving'));
    const timer = window.setTimeout(() => {
      storage
        .saveProject({ id: projectId, name: projectName, nodes, updatedAt: Date.now() })
        .then(() => dispatch(setSaveStatus('saved')))
        .catch(() => dispatch(setSaveStatus('error')));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dispatch, projectId, projectName, nodes]);

  useEffect(() => {
    if (!hydrated.current || !library.loaded) return;
    storage.saveLibrary(library.items).catch(() => dispatch(setSaveStatus('error')));
  }, [dispatch, library]);
};
