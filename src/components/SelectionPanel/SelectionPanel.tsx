import { useEffect, useState, type FC } from 'react';
import clsx from 'clsx';
import {
  IconArrowAutofitDown,
  IconArrowAutofitLeft,
  IconCopy,
  IconLock,
  IconLockOpen,
  IconRotateClockwise2,
  IconStack2,
  IconDots,
  IconArchive,
  IconEyeOff,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import type { Axis, SceneNode } from '../../types/scene';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  duplicatePiece,
  removePiece,
  renamePiece,
  rotatePiece,
  setAxisLength,
  setElevation,
  setMaterial,
  setTextureMode,
  setHidden,
  ungroup,
} from '../../features/scene/sceneSlice';
import { addLibraryItem } from '../../features/library/librarySlice';
import { nanoid } from '@reduxjs/toolkit';
import { cloneNodes } from '../../lib/projectFile';
import { selectNodes } from '../../features/scene/sceneSelectors';
import { childrenOf, memberPieces, targetBox } from '../../lib/sceneTree';
import { formatCm } from '../../lib/units';
import SplitPanel from '../SplitPanel';
import MotionPanel from '../MotionPanel';
import { selectPiece, startPicking, toggleLockProportions } from '../../features/editor/editorSlice';
import { effectiveSize } from '../../lib/geometry';
import { isMaterialPresetId, MATERIAL_PRESETS } from '../../lib/materials';
import NumberField from '../NumberField';
import styles from './SelectionPanel.module.css';

const CUSTOM_COLOR = 'custom';
const PHOTO_STRETCH = 'photo-stretch';
const PHOTO_TILE = 'photo-tile';

const AXIS_FIELDS: readonly { axis: Axis; label: string }[] = [
  { axis: 'x', label: 'רוחב' },
  { axis: 'y', label: 'גובה' },
  { axis: 'z', label: 'עומק' },
];

interface SelectionPanelProps {
  node: SceneNode;
}

const SelectionPanel: FC<SelectionPanelProps> = ({ node }) => {
  const dispatch = useAppDispatch();
  const tool = useAppSelector((s) => s.editor.tool);
  const lockProportions = useAppSelector((s) => s.editor.lockProportions);
  const [name, setName] = useState(node.name);
  const size = effectiveSize(node.sizeMm, node.rotation);
  const isGroup = node.type === 'group';
  const nodes = useAppSelector(selectNodes);
  const groupBox = isGroup ? targetBox(nodes, node.id) : null;
  const memberCount = isGroup ? memberPieces(nodes, node.id).length : 0;

  useEffect(() => setName(node.name), [node.name, node.id]);

  const materialValue =
    node.material.type === 'preset'
      ? node.material.value
      : node.material.type === 'photo'
        ? node.material.textureMode === 'tile'
          ? PHOTO_TILE
          : PHOTO_STRETCH
        : CUSTOM_COLOR;

  const handleMaterialChange = (value: string): void => {
    if (value === PHOTO_STRETCH || value === PHOTO_TILE) {
      dispatch(setTextureMode({ id: node.id, mode: value === PHOTO_TILE ? 'tile' : 'stretch' }));
      return;
    }
    if (isMaterialPresetId(value)) {
      dispatch(setMaterial({ id: node.id, material: { type: 'preset', value } }));
    } else {
      dispatch(setMaterial({ id: node.id, material: { type: 'color', value: '#8a9aa8' } }));
    }
  };

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const runMore = (action: () => void): void => {
    action();
    setIsMoreOpen(false);
  };

  const handleSaveToLibrary = (): void => {
    const members = node.type === 'group' ? [node, ...childrenOf(nodes, node.id)] : [{ ...node, parentId: null }];
    const box = targetBox(nodes, node.id);
    if (!box) return;
    dispatch(
      addLibraryItem({
        id: nanoid(),
        name: node.name,
        createdAt: Date.now(),
        nodes: cloneNodes(members, nanoid, { x: -box.min.x, y: -box.min.y, z: -box.min.z }),
      }),
    );
    setSavedNote(true);
    window.setTimeout(() => setSavedNote(false), 2000);
  };

  const commitName = (): void => {
    const trimmed = name.trim();
    if (trimmed) dispatch(renamePiece({ id: node.id, name: trimmed }));
    else setName(node.name);
  };

  return (
    <section className={styles.panel} aria-label={isGroup ? "קבוצה נבחרת" : "חלק נבחר"}>
      <div className={styles.header}>
        <input
          className={styles.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="שם החלק"
        />
        {!isGroup && (
        <select
          className={styles.material}
          value={materialValue}
          onChange={(e) => handleMaterialChange(e.target.value)}
          aria-label="חומר"
        >
          {MATERIAL_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value={CUSTOM_COLOR}>צבע…</option>
          {node.material.type === 'photo' && (
            <optgroup label="תמונה">
              <option value={PHOTO_STRETCH}>תמונה · נמתחת</option>
              <option value={PHOTO_TILE}>תמונה · חוזרת</option>
            </optgroup>
          )}
        </select>
        )}
        {!isGroup && node.material.type === 'color' && (
          <input
            type="color"
            className={styles.color}
            value={node.material.value}
            onChange={(e) =>
              dispatch(setMaterial({ id: node.id, material: { type: 'color', value: e.target.value } }))
            }
            aria-label="בחר צבע"
          />
        )}
        <div className={styles.moreWrap}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsMoreOpen((v) => !v)}
            aria-label="עוד פעולות"
            aria-expanded={isMoreOpen}
          >
            <IconDots size={20} />
          </button>
          {isMoreOpen && (
            <>
              <div className={styles.moreBackdrop} onClick={() => setIsMoreOpen(false)} />
              <div className={styles.moreMenu} role="menu">
                <button type="button" className={styles.moreItem} onClick={() => runMore(() => dispatch(startPicking(node.parentId ?? node.id)))}>
                  <IconStack2 size={18} />
                  קבץ עם חלקים אחרים
                </button>
                <button type="button" className={styles.moreItem} onClick={() => runMore(handleSaveToLibrary)}>
                  <IconArchive size={18} />
                  שמור למלאי החלקים
                </button>
                <button type="button" className={styles.moreItem} onClick={() => runMore(() => dispatch(setHidden({ id: node.id, hidden: true })))}>
                  <IconEyeOff size={18} />
                  הסתר זמנית
                </button>
              </div>
            </>
          )}
        </div>
        <button type="button" className={styles.iconButton} onClick={() => dispatch(duplicatePiece(node.id))} aria-label="שכפל">
          <IconCopy size={20} />
        </button>
        <button
          type="button"
          className={clsx(styles.iconButton, styles.danger)}
          onClick={() => dispatch(removePiece(node.id))}
          aria-label="מחק"
        >
          <IconTrash size={20} />
        </button>
        <button type="button" className={styles.iconButton} onClick={() => dispatch(selectPiece(null))} aria-label="סגור">
          <IconX size={20} />
        </button>
      </div>

      {savedNote && <p className={styles.note}>נשמר במלאי. אפשר להוסיף אותו לכל פרויקט דרך “+”.</p>}
      {tool === 'motion' ? (
        <MotionPanel node={node} />
      ) : isGroup ? (
        <div className={styles.groupRow}>
          <span className={styles.groupInfo}>
            {memberCount} חלקים · ר {groupBox ? formatCm(groupBox.size.x) : '–'} · ג{' '}
            {groupBox ? formatCm(groupBox.size.y) : '–'} · ע {groupBox ? formatCm(groupBox.size.z) : '–'}
          </span>
          {tool === 'rotate' ? (
            <button type="button" className={styles.rotateButton} onClick={() => dispatch(rotatePiece({ id: node.id, axis: 'y' }))}>
              <IconRotateClockwise2 size={20} />
              סובב 90°
            </button>
          ) : (
            <button type="button" className={styles.rotateButton} onClick={() => dispatch(ungroup(node.id))}>
              <IconStack2 size={20} />
              פרק קבוצה
            </button>
          )}
        </div>
      ) : tool === 'split' ? (
        <SplitPanel node={node} />
      ) : tool === 'rotate' ? (
        <div className={styles.rotateRow}>
          <button type="button" className={styles.rotateButton} onClick={() => dispatch(rotatePiece({ id: node.id, axis: 'y' }))}>
            <IconRotateClockwise2 size={20} />
            סובב 90°
          </button>
          <button type="button" className={styles.rotateButton} onClick={() => dispatch(rotatePiece({ id: node.id, axis: 'x' }))}>
            <IconArrowAutofitDown size={20} />
            השכב קדימה
          </button>
          <button type="button" className={styles.rotateButton} onClick={() => dispatch(rotatePiece({ id: node.id, axis: 'z' }))}>
            <IconArrowAutofitLeft size={20} />
            השכב הצידה
          </button>
        </div>
      ) : (
        <div className={styles.dims}>
          {AXIS_FIELDS.map(({ axis, label }) => (
            <NumberField
              key={axis}
              label={label}
              valueMm={size[axis]}
              onCommit={(lengthMm) =>
                dispatch(setAxisLength({ id: node.id, axis, lengthMm, proportional: lockProportions }))
              }
            />
          ))}
          <NumberField
            label="מהרצפה"
            valueMm={node.positionMm.y}
            minMm={0}
            onCommit={(yMm) => dispatch(setElevation({ id: node.id, yMm }))}
          />
          <button
            type="button"
            className={clsx(styles.lock, lockProportions && styles.lockOn)}
            onClick={() => dispatch(toggleLockProportions())}
            aria-pressed={lockProportions}
            aria-label={lockProportions ? 'בטל נעילת פרופורציות' : 'נעל פרופורציות'}
            title="נעילת פרופורציות"
          >
            {lockProportions ? <IconLock size={20} /> : <IconLockOpen size={20} />}
          </button>
        </div>
      )}
    </section>
  );
};

export default SelectionPanel;
