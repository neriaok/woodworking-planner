import { nanoid } from '@reduxjs/toolkit';

/**
 * Photos are large binary blobs, so they stay out of Redux (which must stay serialisable).
 * Redux only stores image ids; this registry maps an id to its blob and an object URL.
 * Stage 6 will persist the same blobs to IndexedDB under the same ids.
 */
interface StoredImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

const images = new Map<string, StoredImage>();

export const registerImage = (blob: Blob, width: number, height: number): string => {
  const id = nanoid();
  images.set(id, { blob, url: URL.createObjectURL(blob), width, height });
  return id;
};

export const getImage = (id: string): StoredImage | undefined => images.get(id);

export const getImageUrl = (id: string): string | undefined => images.get(id)?.url;

/** Put an image loaded from storage back under its original id. */
export const restoreImage = (id: string, blob: Blob, width: number, height: number): void => {
  if (images.has(id)) return;
  images.set(id, { blob, url: URL.createObjectURL(blob), width, height });
  persisted.add(id);
};

/** Ids already written to IndexedDB, so autosave does not rewrite large blobs. */
const persisted = new Set<string>();

export const isPersisted = (id: string): boolean => persisted.has(id);

export const markPersisted = (id: string): void => {
  persisted.add(id);
};
