import { useEffect, useMemo, useState, type ChangeEvent, type FC } from 'react';
import clsx from 'clsx';
import { IconArrowRight, IconCamera, IconFileDescription, IconPhoto, IconX } from '@tabler/icons-react';
import type { PhotoFace, PhotoMaterial, SizeMm, TextureMode } from '../../types/scene';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { addPiece } from '../../features/scene/sceneSlice';
import {
  loadPhoto,
  processFace,
  type LoadedPhoto,
  type ProcessedFace,
} from '../../features/images/photoProcessing';
import {
  defaultQuad,
  estimateAspectRatio,
  isValidQuad,
  measureWithReference,
  type Quad,
} from '../../lib/homography';
import { DIM_LABELS, FACE_AXES, FACE_LABELS, solveDimensions, type DimKey } from '../../lib/dimensions';
import { formatCm } from '../../lib/units';
import CornerEditor, { type QuadTarget } from '../CornerEditor';
import PhotoDimensions from '../PhotoDimensions';
import styles from './PhotoPartFlow.module.css';

const FACE_ORDER: readonly PhotoFace[] = ['front', 'right', 'left', 'top', 'back'];

const CORNER_HINTS: Record<PhotoFace, string> = {
  front: 'גרור את 4 הנקודות לפינות החזית',
  back: 'גרור את 4 הנקודות לפינות הגב',
  left: 'גרור את 4 הנקודות לפינות הצד השמאלי',
  right: 'גרור את 4 הנקודות לפינות הצד הימני',
  top: 'גרור את 4 הנקודות לפינות המשטח העליון (צלם מלפנים, מלמעלה)',
};

interface FacePhoto {
  face: PhotoFace;
  photo: LoadedPhoto;
  quad: Quad;
  referenceQuad: Quad | null;
  processed: ProcessedFace | null;
}

type Step = { kind: 'loading' } | { kind: 'corners'; face: PhotoFace } | { kind: 'details' };

interface PhotoPartFlowProps {
  initialFile: File;
  onClose: () => void;
}

/** Photo → part: mark corners on one or more face photos, confirm sizes, add to the scene. */
const PhotoPartFlow: FC<PhotoPartFlowProps> = ({ initialFile, onClose }) => {
  const dispatch = useAppDispatch();
  const [faces, setFaces] = useState<FacePhoto[]>([]);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [manual, setManual] = useState<Partial<SizeMm>>({});
  const [name, setName] = useState('חלק מצילום');
  const [textureMode, setTextureMode] = useState<TextureMode>('stretch');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const addFacePhoto = async (face: PhotoFace, file: File): Promise<void> => {
    setError(null);
    setIsBusy(true);
    try {
      const photo = await loadPhoto(file);
      setFaces((prev) => [
        ...prev.filter((f) => f.face !== face),
        { face, photo, quad: defaultQuad(photo.width, photo.height), referenceQuad: null, processed: null },
      ]);
      setStep({ kind: 'corners', face });
    } catch {
      setError('לא הצלחנו לפתוח את התמונה. נסה קובץ JPG או PNG.');
      setStep((s) => (s.kind === 'loading' ? { kind: 'details' } : s));
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    // Load the first photo once, when the flow opens.
    void addFacePhoto('front', initialFile);
  }, [initialFile]);

  const current = step.kind === 'corners' ? faces.find((f) => f.face === step.face) : undefined;

  const updateQuad = (face: PhotoFace, target: QuadTarget, quad: Quad): void => {
    setFaces((prev) =>
      prev.map((f) => (f.face !== face ? f : target === 'part' ? { ...f, quad } : { ...f, referenceQuad: quad })),
    );
  };

  const toggleReference = (face: PhotoFace): void => {
    setFaces((prev) =>
      prev.map((f) => {
        if (f.face !== face) return f;
        if (f.referenceQuad) return { ...f, referenceQuad: null };
        const { width: w, height: h } = f.photo;
        const s = Math.min(w, h) * 0.14;
        const cx = w / 2;
        const cy = h / 2;
        return {
          ...f,
          referenceQuad: [
            { x: cx - s * 0.707, y: cy - s / 2 },
            { x: cx + s * 0.707, y: cy - s / 2 },
            { x: cx + s * 0.707, y: cy + s / 2 },
            { x: cx - s * 0.707, y: cy + s / 2 },
          ],
        };
      }),
    );
  };

  const confirmCorners = async (): Promise<void> => {
    if (!current) return;
    if (!isValidQuad(current.quad) || (current.referenceQuad && !isValidQuad(current.referenceQuad))) {
      setError('הקווים בין הנקודות מצטלבים. הזז כל נקודה לפינה המתאימה של החלק.');
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const processed = await processFace(current.photo, current.quad, current.referenceQuad);
      setFaces((prev) => prev.map((f) => (f.face === current.face ? { ...f, processed } : f)));
      setStep({ kind: 'details' });
    } catch {
      setError('עיבוד התמונה נכשל. נסה שוב.');
    } finally {
      setIsBusy(false);
    }
  };

  const cancelCorners = (): void => {
    if (!current) return;
    if (!current.processed) {
      const remaining = faces.filter((f) => f.face !== current.face);
      setFaces(remaining);
      if (remaining.length === 0) {
        onClose();
        return;
      }
    }
    setStep({ kind: 'details' });
  };

  const ready = useMemo(
    () => faces.filter((f): f is FacePhoto & { processed: ProcessedFace } => f.processed !== null),
    [faces],
  );
  const solution = useMemo(
    () =>
      solveDimensions(
        ready.map((f) => ({ face: f.face, aspect: f.processed.aspect, measuredMm: f.processed.measuredMm })),
        manual,
      ),
    [ready, manual],
  );

  const missing = (['w', 'h', 'd'] as const).filter((k) => solution.size[k] === undefined);

  const handleManualChange = (key: DimKey, valueMm: number | null): void => {
    setManual((prev) => {
      const next = { ...prev };
      if (valueMm === null) delete next[key];
      else next[key] = valueMm;
      return next;
    });
  };

  const handleCreate = (): void => {
    const { w, h, d } = solution.size;
    if (w === undefined || h === undefined || d === undefined) return;
    const size: SizeMm = { w, h, d };
    const material: PhotoMaterial = {
      type: 'photo',
      faces: Object.fromEntries(ready.map((f) => [f.face, f.processed.imageId])),
      baseColor: (ready.find((f) => f.face === 'front') ?? ready[0]).processed.color,
      textureMode,
      photoSizeMm: size,
    };
    dispatch(addPiece({ name: name.trim() || 'חלק מצילום', sizeMm: size, material }));
    onClose();
  };

  const handleExtraFile = (face: PhotoFace) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void addFacePhoto(face, file);
  };

  const liveInfo = (() => {
    if (!current) return null;
    const aspect = estimateAspectRatio(current.quad, current.photo.width, current.photo.height);
    const measured = current.referenceQuad
      ? measureWithReference(current.quad, current.referenceQuad, current.photo.width, current.photo.height)
      : null;
    const { across, up } = FACE_AXES[current.face];
    if (measured) {
      return `${DIM_LABELS[across]} ≈ ${formatCm(measured.widthMm)} · ${DIM_LABELS[up]} ≈ ${formatCm(measured.heightMm)} ס״מ`;
    }
    return `יחס ${DIM_LABELS[across]} ל${DIM_LABELS[up]}: ${aspect.toFixed(2)}`;
  })();

  const unusedFaces = FACE_ORDER.filter((face) => !faces.some((f) => f.face === face));

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="חלק מצילום">
      <div className={styles.sheet}>
        <header className={styles.header}>
          {step.kind === 'corners' ? (
            <button type="button" className={styles.iconButton} onClick={cancelCorners} aria-label="חזור">
              <IconArrowRight size={22} />
            </button>
          ) : (
            <span className={styles.iconSpacer} />
          )}
          <h2 className={styles.title}>
            {step.kind === 'corners' && current ? FACE_LABELS[current.face] : 'חלק מצילום'}
          </h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="סגור">
            <IconX size={22} />
          </button>
        </header>

        {step.kind === 'loading' && <p className={styles.status}>טוען תמונה…</p>}

        {step.kind === 'corners' && current && (
          <div className={styles.body}>
            <p className={styles.hint}>{CORNER_HINTS[current.face]}</p>
            <CornerEditor
              photo={current.photo}
              quad={current.quad}
              referenceQuad={current.referenceQuad}
              onChange={(target, quad) => updateQuad(current.face, target, quad)}
            />
            <div className={styles.infoRow}>
              <span className={styles.info}>{liveInfo}</span>
              <button
                type="button"
                className={clsx(styles.referenceToggle, current.referenceQuad && styles.referenceOn)}
                onClick={() => toggleReference(current.face)}
                aria-pressed={current.referenceQuad !== null}
              >
                <IconFileDescription size={18} />
                {current.referenceQuad ? 'הסר דף A4' : 'יש דף A4 על החלק'}
              </button>
            </div>
            {current.referenceQuad && (
              <p className={styles.subtle}>
                סמן גם את 4 פינות הדף (הנקודות הכתומות). הדף צריך להיות מונח על אותה פאה.
              </p>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <button type="button" className={styles.primary} onClick={confirmCorners} disabled={isBusy}>
              {isBusy ? 'מיישר…' : 'יישר והמשך'}
            </button>
          </div>
        )}

        {step.kind === 'details' && (
          <div className={styles.body}>
            <div className={styles.faces}>
              {ready.map((f) => (
                <button
                  key={f.face}
                  type="button"
                  className={styles.faceCard}
                  onClick={() => setStep({ kind: 'corners', face: f.face })}
                  title="ערוך פינות"
                >
                  <img src={f.processed.url} alt={FACE_LABELS[f.face]} className={styles.faceImage} />
                  <span className={styles.faceLabel}>{FACE_LABELS[f.face]}</span>
                </button>
              ))}
            </div>

            {unusedFaces.length > 0 && (
              <div className={styles.addFaces}>
                <span className={styles.subtle}>צלם צד נוסף לדיוק:</span>
                <div className={styles.addFaceRow}>
                  {unusedFaces.map((face) => (
                    <label key={face} className={styles.addFace}>
                      <IconCamera size={16} />
                      {FACE_LABELS[face]}
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.fileInput}
                        onChange={handleExtraFile(face)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className={styles.field}>
              <span className={styles.label}>שם</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <PhotoDimensions solution={solution} manual={manual} onManualChange={handleManualChange} />

            <div className={styles.field}>
              <span className={styles.label}>כשמאריכים או מקצרים את החלק, התמונה…</span>
              <div className={styles.segmented}>
                {(
                  [
                    ['stretch', 'נמתחת'],
                    ['tile', 'חוזרת על עצמה'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={clsx(styles.segment, textureMode === mode && styles.segmentOn)}
                    onClick={() => setTextureMode(mode)}
                    aria-pressed={textureMode === mode}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {missing.length > 0 && ready.length > 0 && (
              <p className={styles.subtle}>
                חסר: {missing.map((k) => DIM_LABELS[k]).join(', ')}. הזן מידה אחת אמיתית או צלם צד נוסף.
              </p>
            )}

            <button
              type="button"
              className={styles.primary}
              onClick={handleCreate}
              disabled={missing.length > 0 || ready.length === 0}
            >
              <IconPhoto size={20} />
              צור חלק
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoPartFlow;
