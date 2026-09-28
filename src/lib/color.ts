import type { PixelBuffer } from './homography';

/** Average colour of the opaque pixels, as a #rrggbb string (used for faces without a photo). */
export const averageColor = (buffer: PixelBuffer, step = 4): string => {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const { data, width, height } = buffer;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 128) continue;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      n += 1;
    }
  }
  if (n === 0) return '#c8b08a';
  const hex = (v: number): string => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
};
