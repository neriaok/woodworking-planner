import { useEffect, useId, useState, type FC, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { formatCm, parseCmToMm } from '../../lib/units';
import styles from './NumberField.module.css';

interface NumberFieldProps {
  label: string;
  valueMm: number;
  /** Called with the new value in mm when the user confirms (blur / Enter). */
  onCommit: (valueMm: number) => void;
  minMm?: number;
}

/** A centimetre input backed by millimetres; edits are committed on blur or Enter. */
const NumberField: FC<NumberFieldProps> = ({ label, valueMm, onCommit, minMm = 5 }) => {
  const id = useId();
  const [text, setText] = useState(formatCm(valueMm));
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    setText(formatCm(valueMm));
    setIsInvalid(false);
  }, [valueMm]);

  const commit = (): void => {
    const parsed = parseCmToMm(text);
    if (parsed === null || parsed < minMm) {
      setIsInvalid(true);
      return;
    }
    setIsInvalid(false);
    if (parsed !== valueMm) onCommit(parsed);
    else setText(formatCm(valueMm));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setText(formatCm(valueMm));
      setIsInvalid(false);
      event.currentTarget.blur();
    }
  };

  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <input
        id={id}
        className={clsx(styles.input, isInvalid && styles.invalid)}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setIsInvalid(false);
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-invalid={isInvalid}
      />
    </label>
  );
};

export default NumberField;
