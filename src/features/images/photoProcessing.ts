import { averageColor } from '../../lib/color';
import {
  estimateAspectRatio,
  measureWithReference,
  rectifiedSize,
  rectify,
  type Quad,
} from '../../lib/homography';
import { registerImage } from './imageRegistry';

/** Photos are downscaled to this longest side before marking — plenty for a sketch texture. */
const WORKING_LONG_SIDE = 1600;
/** Longest side of the flattened face texture. */
const TEXTURE_LONG_SIDE = 1024;

export interface LoadedPhoto {
  /** Downscaled, correctly oriented pixels. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Object URL of the same pixels, for display in <img>. */
  displayUrl: string;
}

const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
  });

/** Decode a camera/gallery file (respecting EXIF rotation) into a working canvas. */
export const loadPhoto = async (file: File): Promise<LoadedPhoto> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, WORKING_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const displayUrl = URL.createObjectURL(await canvasToBlob(canvas));
  return { canvas, width, height, displayUrl };
};

export interface ProcessedFace {
  imageId: string;
  url: string;
  aspect: number;
  measuredMm?: { widthMm: number; heightMm: number };
  color: string;
}

/** Flatten the marked face into a texture and measure it. */
export const processFace = async (
  photo: LoadedPhoto,
  quad: Quad,
  referenceQuad: Quad | null,
): Promise<ProcessedFace> => {
  const aspect = estimateAspectRatio(quad, photo.width, photo.height);
  const { width, height } = rectifiedSize(aspect, TEXTURE_LONG_SIDE);
  const ctx = photo.canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const src = ctx.getImageData(0, 0, photo.width, photo.height);
  const flat = rectify(src, quad, width, height);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Canvas is not available');
  outCtx.putImageData(new ImageData(flat.data, width, height), 0, 0);
  const blob = await canvasToBlob(out);
  const imageId = registerImage(blob, width, height);

  const measuredMm = referenceQuad
    ? (measureWithReference(quad, referenceQuad, photo.width, photo.height) ?? undefined)
    : undefined;

  return {
    imageId,
    url: URL.createObjectURL(blob),
    aspect,
    measuredMm,
    color: averageColor(flat),
  };
};
