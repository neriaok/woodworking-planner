import { useState, type FC } from 'react';
import clsx from 'clsx';
import type { SizeMm } from '../../types/scene';
import {
  DIM_LABELS,
  FACE_LABELS,
  type DimKey,
  type DimSource,
  type DimensionSolution,
} from '../../lib/dimensions';
import { formatCm, parseCmToMm } from '../../lib/units';
import styles from './PhotoDimensions.module.css';

const SOURCE_LABELS: Record<DimSource, string> = {
  manual: 'הוזן',
  reference: 'לפי A4',
  photo: 'מהתמונה',
};

const KEYS: readonly DimKey[] = ['w', 'h', 'd'];

interface PhotoDimensionsProps {
  solution: DimensionSolution;
  manual: Partial<SizeMm>;
  onManualChange: (key: DimKey, valueMm: number | null) => void;
}

/**
 * Width / height / depth fields. Empty fields are filled from the photos; typing a value
 * pins it and the others are recalculated from the photographed proportions.
 */
const PhotoDimensions: FC<PhotoDimensionsProps> = ({ solution, manual, onManualChange }) => {
  const [editing, setEditing] = useState<{ key: DimKey; text: string } | null>(null);

  const commit = (key: DimKey, text: string): void => {
    setEditing(null);
    const trimmed = text.trim();
    if (trimmed === '') {
      onManualChange(key, null);
      return;
    }
    const mm = parseCmToMm(trimmed);
    if (mm !== null && mm >= 5) onManualChange(key, mm);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.fields}>
        {KEYS.map((key) => {
          const value = solution.size[key];
          const source = solution.source[key];
          const isEditing = editing?.key === key;
          return (
            <label key={key} className={styles.field}>
              <span className={styles.label}>{DIM_LABELS[key]} (ס״מ)</span>
              <input
                className={clsx(styles.input, manual[key] !== undefined && styles.pinned, value === undefined && styles.missing)}
                inputMode="decimal"
                placeholder="?"
                value={isEditing ? editing.text : value !== undefined ? formatCm(value) : ''}
                onFocus={(e) => {
                  setEditing({ key, text: value !== undefined ? formatCm(value) : '' });
                  requestAnimationFrame(() => e.target.select());
                }}
                onChange={(e) => setEditing({ key, text: e.target.value })}
                onBlur={(e) => commit(key, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <span className={clsx(styles.source, source === 'manual' && styles.sourceManual)}>
                {source ? SOURCE_LABELS[source] : 'חסר'}
              </span>
            </label>
          );
        })}
      </div>
      {solution.conflicts.length > 0 && (
        <p className={styles.warning} role="alert">
          הפרופורציות של {solution.conflicts.map((c) => FACE_LABELS[c.face]).join(', ')} לא מתאימות למידות.
          בדוק את הפינות שסימנת או את המידות שהזנת.
        </p>
      )}
    </div>
  );
};

export default PhotoDimensions;
