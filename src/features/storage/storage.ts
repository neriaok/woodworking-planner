import { createStore, del, get, set, entries } from 'idb-keyval';
import type { BackupFile, LibraryItem, ProjectData, ProjectSummary } from '../../lib/projectFile';
import { collectImageIds, summarize } from '../../lib/projectFile';
import { getImage, isPersisted, markPersisted, restoreImage } from '../images/imageRegistry';

/**
 * Local persistence in IndexedDB (photos are too large for localStorage).
 * Separate object stores keep listing projects cheap.
 */
const projects = createStore('woodworking-planner', 'projects');
const images = createStore('woodworking-planner-images', 'images');
const meta = createStore('woodworking-planner-meta', 'meta');

interface StoredImage {
  blob: Blob;
  width: number;
  height: number;
}

const LAST_PROJECT = 'lastProjectId';
const LIBRARY = 'library';

/** Write any photos the nodes use that are not in IndexedDB yet. */
const persistImages = async (ids: readonly string[]): Promise<void> => {
  await Promise.all(
    ids
      .filter((id) => !isPersisted(id))
      .map(async (id) => {
        const img = getImage(id);
        if (!img) return;
        await set(id, { blob: img.blob, width: img.width, height: img.height } satisfies StoredImage, images);
        markPersisted(id);
      }),
  );
};

/** Make sure every photo the nodes use is loaded into the in-memory registry. */
export const loadImages = async (ids: readonly string[]): Promise<void> => {
  await Promise.all(
    ids
      .filter((id) => !getImage(id))
      .map(async (id) => {
        const stored = await get<StoredImage>(id, images);
        if (stored) restoreImage(id, stored.blob, stored.width, stored.height);
      }),
  );
};

export const saveProject = async (project: ProjectData): Promise<void> => {
  await persistImages(collectImageIds(project.nodes));
  await set(project.id, project, projects);
  await set(LAST_PROJECT, project.id, meta);
};

export const loadProject = async (id: string): Promise<ProjectData | null> => {
  const project = await get<ProjectData>(id, projects);
  if (!project) return null;
  await loadImages(collectImageIds(project.nodes));
  return project;
};

export const listProjects = async (): Promise<ProjectSummary[]> => {
  const all = await entries<string, ProjectData>(projects);
  return all.map(([, p]) => summarize(p)).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteProject = async (id: string): Promise<void> => {
  await del(id, projects);
};

export const getLastProjectId = (): Promise<string | undefined> => get<string>(LAST_PROJECT, meta);

export const loadLibrary = async (): Promise<LibraryItem[]> => {
  const items = (await get<LibraryItem[]>(LIBRARY, meta)) ?? [];
  await loadImages(items.flatMap((i) => collectImageIds(i.nodes)));
  return items;
};

export const saveLibrary = async (items: readonly LibraryItem[]): Promise<void> => {
  await persistImages(items.flatMap((i) => collectImageIds(i.nodes)));
  await set(LIBRARY, items, meta);
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Everything (all projects, the inventory and their photos) as one portable file. */
export const buildBackup = async (): Promise<BackupFile> => {
  const all = (await entries<string, ProjectData>(projects)).map(([, p]) => p);
  const library = await loadLibrary();
  const ids = [...all.flatMap((p) => collectImageIds(p.nodes)), ...library.flatMap((i) => collectImageIds(i.nodes))];
  await loadImages(ids);
  const imageData: Record<string, string> = {};
  for (const id of new Set(ids)) {
    const img = getImage(id);
    if (img) imageData[id] = await blobToDataUrl(img.blob);
  }
  return { app: 'woodworking-planner', version: 1, exportedAt: Date.now(), projects: all, library, images: imageData };
};

const dataUrlToImage = async (dataUrl: string): Promise<StoredImage> => {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { blob, ...size };
};

/** Merge a backup into local storage (same ids are overwritten). Returns how many projects arrived. */
export const restoreBackup = async (backup: BackupFile): Promise<number> => {
  for (const [id, url] of Object.entries(backup.images)) {
    const img = await dataUrlToImage(url);
    await set(id, img, images);
    restoreImage(id, img.blob, img.width, img.height);
  }
  for (const project of backup.projects) await set(project.id, project, projects);
  const current = (await get<LibraryItem[]>(LIBRARY, meta)) ?? [];
  const merged = [...current.filter((c) => !backup.library.some((b) => b.id === c.id)), ...backup.library];
  await set(LIBRARY, merged, meta);
  return backup.projects.length;
};
