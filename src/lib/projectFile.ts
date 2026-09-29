import type { SceneNode } from '../types/scene';

/** Everything a saved project needs, minus the image bytes. */
export interface ProjectData {
  id: string;
  name: string;
  nodes: SceneNode[];
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  pieceCount: number;
}

/** A part (or a group of parts) kept in the inventory, positioned with its corner at the origin. */
export interface LibraryItem {
  id: string;
  name: string;
  nodes: SceneNode[];
  createdAt: number;
}

/** Portable backup file: projects and inventory with their photos inlined as data URLs. */
export interface BackupFile {
  app: 'woodworking-planner';
  version: 1;
  exportedAt: number;
  projects: ProjectData[];
  library: LibraryItem[];
  images: Record<string, string>;
}

/** Image ids referenced by photo materials in a list of nodes. */
export const collectImageIds = (nodes: readonly SceneNode[]): string[] => {
  const ids = new Set<string>();
  nodes.forEach((n) => {
    if (n.material.type === 'photo') Object.values(n.material.faces).forEach((id) => id && ids.add(id));
  });
  return [...ids];
};

export const summarize = (project: ProjectData): ProjectSummary => ({
  id: project.id,
  name: project.name,
  updatedAt: project.updatedAt,
  pieceCount: project.nodes.filter((n) => n.type === 'piece').length,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNodeList = (value: unknown): value is SceneNode[] =>
  Array.isArray(value) &&
  value.every(
    (n) =>
      isRecord(n) &&
      typeof n.id === 'string' &&
      (n.type === 'piece' || n.type === 'group') &&
      isRecord(n.positionMm) &&
      isRecord(n.sizeMm) &&
      isRecord(n.rotation) &&
      isRecord(n.material),
  );

/** Validate an imported backup; returns null when the file is not one of ours. */
export const parseBackup = (text: string): BackupFile | null => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.app !== 'woodworking-planner' || data.version !== 1) return null;
  const { projects, library, images } = data;
  if (!Array.isArray(projects) || !Array.isArray(library) || !isRecord(images)) return null;
  const projectsOk = projects.every(
    (p) => isRecord(p) && typeof p.id === 'string' && typeof p.name === 'string' && isNodeList(p.nodes),
  );
  const libraryOk = library.every(
    (l) => isRecord(l) && typeof l.id === 'string' && typeof l.name === 'string' && isNodeList(l.nodes),
  );
  const imagesOk = Object.values(images).every((v) => typeof v === 'string' && v.startsWith('data:image/'));
  if (!projectsOk || !libraryOk || !imagesOk) return null;
  return data as unknown as BackupFile;
};

/**
 * Copy nodes with fresh ids (keeping group membership), shifted so their bounds start at `origin`.
 * Used to put an inventory item into a scene, or to store a selection in the inventory.
 */
export const cloneNodes = (
  nodes: readonly SceneNode[],
  makeId: () => string,
  shift: { x: number; y: number; z: number },
): SceneNode[] => {
  const idMap = new Map(nodes.map((n) => [n.id, makeId()]));
  return nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id) ?? makeId(),
    parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    positionMm: { x: n.positionMm.x + shift.x, y: n.positionMm.y + shift.y, z: n.positionMm.z + shift.z },
    openAmount: undefined,
    hidden: undefined,
  }));
};
