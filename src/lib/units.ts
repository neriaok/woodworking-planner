import type { Mm } from '../types/scene';

/** Scene units are centimetres: 1 three.js unit = 1 cm = 10 mm. */
export const MM_PER_SCENE_UNIT = 10;

export const mmToScene = (mm: Mm): number => mm / MM_PER_SCENE_UNIT;
export const sceneToMm = (units: number): Mm => Math.round(units * MM_PER_SCENE_UNIT);

/** Round millimetres to the display resolution of 0.5 cm (5 mm). */
export const roundToHalfCm = (mm: Mm): Mm => Math.round(mm / 5) * 5;

/** Format millimetres as a centimetre string with 0.5 cm resolution: 1255 → "125.5". */
export const formatCm = (mm: Mm): string => {
  const cm = roundToHalfCm(mm) / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
};

/** Parse user-entered centimetres ("12,5" or "12.5") into millimetres, or null if invalid. */
export const parseCmToMm = (input: string): Mm | null => {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const cm = Number(normalized);
  if (!Number.isFinite(cm)) return null;
  return roundToHalfCm(Math.round(cm * 10));
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
