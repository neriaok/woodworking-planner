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

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Fallback for browsers without createImageBitmap options (older iOS): an <img> also applies EXIF rotation. */
const decodeWithImage = (file: File): Promise<Decoded> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unsupported image'));
    };
    img.src = url;
  });

const decode = async (file: File): Promise<Decoded> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // fall through to <img> decoding
    }
  }
  return decodeWithImage(file);
};

/** Decode a camera/gallery file (respecting EXIF rotation) into a working canvas. */
export const loadPhoto = async (file: File): Promise<LoadedPhoto> => {
  const bitmap = await decode(file);
  const scale = Math.min(1, WORKING_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap.source, 0, 0, width, height);
  bitmap.release();
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
