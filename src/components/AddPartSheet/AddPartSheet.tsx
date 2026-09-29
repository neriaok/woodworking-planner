import { useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import clsx from 'clsx';
import { IconCamera, IconPhoto, IconTrash, IconX } from '@tabler/icons-react';
import type { MaterialPresetId, SizeMm } from '../../types/scene';
import { nanoid } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { removeLibraryItem } from '../../features/library/librarySlice';
import { cloneNodes, type LibraryItem } from '../../lib/projectFile';
import { nodeBox, unionBox } from '../../lib/geometry';
import { piecesOf } from '../../lib/sceneTree';
import { addPiece, insertNodes } from '../../features/scene/sceneSlice';
import { MATERIAL_PRESETS } from '../../lib/materials';
import { formatCm, parseCmToMm } from '../../lib/units';
import styles from './AddPartSheet.module.css';

interface Template {
  name: string;
  size: SizeMm;
  material: MaterialPresetId;
}

const TEMPLATES: readonly Template[] = [
  { name: 'קרש', size: { w: 1800, h: 20, d: 200 }, material: 'pine' },
  { name: 'משטח', size: { w: 1400, h: 40, d: 600 }, material: 'oak' },
  { name: 'שידה', size: { w: 1000, h: 850, d: 450 }, material: 'whiteMdf' },
  { name: 'מדף', size: { w: 800, h: 18, d: 300 }, material: 'plywood' },
];

type DimKey = keyof SizeMm;
const DIM_FIELDS: readonly { key: DimKey; label: string }[] = [
  { key: 'w', label: 'רוחב' },
  { key: 'h', label: 'גובה' },
  { key: 'd', label: 'עומק' },
];

const toText = (size: SizeMm): Record<DimKey, string> => ({
  w: formatCm(size.w),
  h: formatCm(size.h),
  d: formatCm(size.d),
});

interface AddPartSheetProps {
  onClose: () => void;
  /** A photo was picked: the photo flow takes over. */
  onPhoto: (file: File) => void;
}

const AddPartSheet: FC<AddPartSheetProps> = ({ onClose, onPhoto }) => {
  const dispatch = useAppDispatch();
  const library = useAppSelector((s) => s.library.items);
  const [name, setName] = useState(TEMPLATES[0].name);
  const [dims, setDims] = useState(toText(TEMPLATES[0].size));
  const [material, setMaterial] = useState<MaterialPresetId>(TEMPLATES[0].material);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPhoto(file);
  };

  const handleAddFromLibrary = (item: LibraryItem): void => {
    dispatch(insertNodes(cloneNodes(item.nodes, nanoid, { x: 0, y: 0, z: 0 })));
    onClose();
  };

  const applyTemplate = (template: Template): void => {
    setName(template.name);
    setDims(toText(template.size));
    setMaterial(template.material);
    setError(null);
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const w = parseCmToMm(dims.w);
    const h = parseCmToMm(dims.h);
    const d = parseCmToMm(dims.d);
    if (w === null || h === null || d === null || w < 5 || h < 5 || d < 5) {
      setError('הזן מידות של 0.5 ס״מ לפחות בכל שדה');
      return;
    }
    if (!name.trim()) {
      setError('תן לחלק שם');
      return;
    }
    dispatch(addPiece({ name: name.trim(), sizeMm: { w, h, d }, material: { type: 'preset', value: material } }));
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        aria-label="הוספת חלק"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>חלק חדש</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="סגור">
            <IconX size={22} />
          </button>
        </div>

        <div className={styles.photoRow}>
          <label className={styles.photo}>
            <IconCamera size={20} />
            צלם חלק
            <input type="file" accept="image/*" capture="environment" className={styles.fileInput} onChange={handleFile} />
          </label>
          <label className={styles.photo}>
            <IconPhoto size={20} />
            מהגלריה
            <input type="file" accept="image/*" className={styles.fileInput} onChange={handleFile} />
          </label>
        </div>
        {library.length > 0 && (
          <div className={styles.library}>
            <span className={styles.label}>מהמלאי שלך</span>
            <ul className={styles.libraryList}>
              {library.map((item) => {
                const box = unionBox(piecesOf(item.nodes).map(nodeBox));
                return (
                  <li key={item.id} className={styles.libraryItem}>
                    <button type="button" className={styles.libraryAdd} onClick={() => handleAddFromLibrary(item)}>
                      <span className={styles.libraryName}>{item.name}</span>
                      {box && (
                        <span className={styles.libraryMeta}>
                          {formatCm(box.size.x)} × {formatCm(box.size.y)} × {formatCm(box.size.z)} ס״מ
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.libraryRemove}
                      onClick={() => dispatch(removeLibraryItem(item.id))}
                      aria-label={`הסר את ${item.name} מהמלאי`}
                    >
                      <IconTrash size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className={styles.or}>או הזן מידות ידנית</p>

        <div className={styles.templates}>
          {TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              className={clsx(styles.chip, template.name === name && styles.chipOn)}
              onClick={() => applyTemplate(template)}
            >
              {template.name}
            </button>
          ))}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>שם</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className={styles.dims}>
          {DIM_FIELDS.map(({ key, label }) => (
            <label key={key} className={styles.field}>
              <span className={styles.label}>{label} (ס״מ)</span>
              <input
                className={clsx(styles.input, styles.number)}
                inputMode="decimal"
                value={dims[key]}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  setDims((prev) => ({ ...prev, [key]: e.target.value }));
                  setError(null);
                }}
              />
            </label>
          ))}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>חומר</span>
          <div className={styles.materials}>
            {MATERIAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={clsx(styles.swatch, material === preset.id && styles.swatchOn)}
                onClick={() => setMaterial(preset.id)}
                aria-pressed={material === preset.id}
              >
                <span className={styles.swatchColor} style={{ background: preset.color }} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit}>
          הוסף לסצנה
        </button>
      </form>
    </div>
  );
};

export default AddPartSheet;
