import { useEffect } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '../store/store';
import { useAppDispatch } from './useAppDispatch';
import { duplicatePiece, redo, removePiece, rotatePiece, undo } from '../features/scene/sceneSlice';
import { selectPiece, setTool } from '../features/editor/editorSlice';

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable);

/** Desktop keyboard shortcuts. Everything here is also reachable by touch. */
export const useKeyboardShortcuts = (): void => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const selectedId = store.getState().editor.selectedId;

      if (mod && key === 'z') {
        event.preventDefault();
        dispatch(event.shiftKey ? redo() : undo());
      } else if (mod && key === 'y') {
        event.preventDefault();
        dispatch(redo());
      } else if (mod && key === 'd' && selectedId) {
        event.preventDefault();
        dispatch(duplicatePiece(selectedId));
      } else if ((key === 'delete' || key === 'backspace') && selectedId) {
        dispatch(removePiece(selectedId));
      } else if (key === 'r' && !mod && selectedId) {
        dispatch(rotatePiece({ id: selectedId, axis: 'y' }));
      } else if (key === 'escape') {
        dispatch(selectPiece(null));
      } else if (!mod && (key === 'm' || key === 'g')) {
        dispatch(setTool('move'));
      } else if (!mod && key === 's') {
        dispatch(setTool('resize'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, store]);
};
