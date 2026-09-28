import type { Material, MaterialPresetId } from '../types/scene';

export interface MaterialPreset {
  id: MaterialPresetId;
  label: string;
  color: string;
  roughness: number;
}

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  { id: 'pine', label: 'אורן', color: '#e2c08d', roughness: 0.8 },
  { id: 'oak', label: 'אלון', color: '#b88a58', roughness: 0.75 },
  { id: 'whiteMdf', label: 'MDF לבן', color: '#f1eee7', roughness: 0.6 },
  { id: 'plywood', label: 'סנדוויץ׳', color: '#d6b588', roughness: 0.85 },
];

export const isMaterialPresetId = (value: string): value is MaterialPresetId =>
  MATERIAL_PRESETS.some((preset) => preset.id === value);

export const resolveMaterial = (material: Material): { color: string; roughness: number } => {
  if (material.type === 'color') return { color: material.value, roughness: 0.7 };
  if (material.type === 'photo') return { color: material.baseColor, roughness: 0.75 };
  const preset = MATERIAL_PRESETS.find((p) => p.id === material.value) ?? MATERIAL_PRESETS[0];
  return { color: preset.color, roughness: preset.roughness };
};

export const materialLabel = (material: Material): string => {
  if (material.type === 'color') return 'צבע מותאם';
  if (material.type === 'photo') return 'תמונה';
  return MATERIAL_PRESETS.find((p) => p.id === material.value)?.label ?? '';
};
