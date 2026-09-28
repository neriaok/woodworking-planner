import { useEffect, useState, type FC } from 'react';
import clsx from 'clsx';
import {
  IconArrowAutofitDown,
  IconArrowAutofitLeft,
  IconCopy,
  IconLock,
  IconLockOpen,
  IconRotateClockwise2,
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
} from '../../features/scene/sceneSlice';
import { selectPiece, toggleLockProportions } from '../../features/editor/editorSlice';
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

  const commitName = (): void => {
    const trimmed = name.trim();
    if (trimmed) dispatch(renamePiece({ id: node.id, name: trimmed }));
    else setName(node.name);
  };

  return (
    <section className={styles.panel} aria-label="חלק נבחר">
      <div className={styles.header}>
        <input
          className={styles.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="שם החלק"
        />
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
        {node.material.type === 'color' && (
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

      {tool === 'rotate' ? (
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
