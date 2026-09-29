import { useEffect, useMemo, useState } from 'react';
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { Crop, Material, PhotoFace, SizeMm } from '../../types/scene';
import { getImageUrl } from '../../features/images/imageRegistry';

const loader = new TextureLoader();
/** One loaded base texture per image id, shared by every piece that uses it. */
const baseTextures = new Map<string, Texture>();

const loadBase = (id: string): Promise<Texture | null> => {
  const cached = baseTextures.get(id);
  if (cached) return Promise.resolve(cached);
  const url = getImageUrl(id);
  if (!url) return Promise.resolve(null);
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    baseTextures.set(id, texture);
    return texture;
  });
};

/**
 * Which photo goes on each BoxGeometry face, in three.js order:
 * +x (right), -x (left), +y (top), -y (bottom), +z (front), -z (back).
 * A single side photo is reused for both sides, since sides of furniture usually match.
 */
const FACE_SOURCES: readonly (readonly PhotoFace[])[] = [
  ['right', 'left'],
  ['left', 'right'],
  ['top'],
  [],
  ['front'],
  ['back'],
];

/** Local dimensions spanned by each face (across, up), in the same order. */
const FACE_DIMS: readonly (readonly [keyof SizeMm, keyof SizeMm])[] = [
  ['d', 'h'],
  ['d', 'h'],
  ['w', 'd'],
  ['w', 'd'],
  ['w', 'h'],
  ['w', 'h'],
];

/** Texture window (u0, u1, v0, v1) of each face for a cropped piece, in the same face order. */
const faceWindow = (crop: Crop, index: number): [number, number, number, number] => {
  const { x0, x1, y0, y1, z0, z1 } = crop;
  switch (index) {
    case 0:
      return [1 - z1, 1 - z0, y0, y1];
    case 1:
      return [z0, z1, y0, y1];
    case 2:
      return [x0, x1, 1 - z1, 1 - z0];
    case 5:
      return [1 - x1, 1 - x0, y0, y1];
    default:
      return [x0, x1, y0, y1];
  }
};

/** Per-face textures for a photo material (null where the face has no photo). */
export const usePhotoTextures = (material: Material, sizeMm: SizeMm): (Texture | null)[] => {
  const [loadedCount, setLoadedCount] = useState(0);
  const faces = material.type === 'photo' ? material.faces : null;
  const ids = useMemo(() => (faces ? Object.values(faces).filter(Boolean) : []), [faces]);

  useEffect(() => {
    let active = true;
    const missing = ids.filter((id) => !baseTextures.has(id));
    if (missing.length === 0) return undefined;
    Promise.all(missing.map(loadBase)).then(() => {
      if (active) setLoadedCount((n) => n + 1);
    });
    return () => {
      active = false;
    };
  }, [ids]);

  const textures = useMemo(() => {
    if (material.type !== 'photo') return FACE_SOURCES.map(() => null);
    return FACE_SOURCES.map((sources, index) => {
      const id = sources.map((face) => material.faces[face]).find(Boolean);
      const base = id ? baseTextures.get(id) : undefined;
      if (!base) return null;
      const texture = base.clone();
      texture.needsUpdate = true;
      if (material.textureMode === 'tile') {
        const [across, up] = FACE_DIMS[index];
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(
          sizeMm[across] / material.photoSizeMm[across],
          sizeMm[up] / material.photoSizeMm[up],
        );
      } else if (material.crop) {
        const [u0, u1, v0, v1] = faceWindow(material.crop, index);
        texture.offset.set(u0, v0);
        texture.repeat.set(u1 - u0, v1 - v0);
      }
      return texture;
    });
    // loadedCount re-runs this once the base textures arrive.
  }, [material, sizeMm, loadedCount]);

  useEffect(() => () => textures.forEach((t) => t?.dispose()), [textures]);

  return textures;
};
