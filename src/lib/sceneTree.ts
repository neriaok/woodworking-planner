import type { Box, SceneNode } from '../types/scene';
import { nodeBox, unionBox } from './geometry';

/**
 * Scene nodes form a shallow tree: pieces may belong to one group (parentId).
 * Groups have no geometry of their own; their box is the union of their pieces.
 */

export const isPiece = (node: SceneNode): boolean => node.type === 'piece';

export const piecesOf = (nodes: readonly SceneNode[]): SceneNode[] => nodes.filter(isPiece);

export const childrenOf = (nodes: readonly SceneNode[], groupId: string): SceneNode[] =>
  nodes.filter((n) => n.parentId === groupId);

/** The pieces a selection stands for: the piece itself, or every piece in the group. */
export const memberPieces = (nodes: readonly SceneNode[], id: string): SceneNode[] => {
  const node = nodes.find((n) => n.id === id);
  if (!node) return [];
  return node.type === 'group' ? childrenOf(nodes, id).filter(isPiece) : [node];
};

export const targetBox = (nodes: readonly SceneNode[], id: string): Box | null =>
  unionBox(memberPieces(nodes, id).map(nodeBox));

/** Boxes of every visible piece that is not part of the given selection. */
export const otherBoxes = (nodes: readonly SceneNode[], id: string | null): Box[] => {
  const excluded = new Set(id ? memberPieces(nodes, id).map((n) => n.id) : []);
  return nodes.filter((n) => isPiece(n) && !n.hidden && !excluded.has(n.id)).map(nodeBox);
};

/**
 * What a tap on a piece should select. Inside a group: the first tap picks the whole group;
 * once the group (or one of its pieces) is selected, taps pick individual pieces.
 */
export const selectionForTap = (
  nodes: readonly SceneNode[],
  pieceId: string,
  selectedId: string | null,
): string => {
  const piece = nodes.find((n) => n.id === pieceId);
  if (!piece?.parentId) return pieceId;
  if (selectedId === piece.parentId) return pieceId;
  const selected = nodes.find((n) => n.id === selectedId);
  if (selected?.parentId === piece.parentId) return pieceId;
  return piece.parentId;
};

/** Top-level id for a piece: its group if it has one. */
export const topLevelId = (nodes: readonly SceneNode[], pieceId: string): string =>
  nodes.find((n) => n.id === pieceId)?.parentId ?? pieceId;

/** The node whose motion (door/drawer) moves this piece: itself, or its group. */
export const motionOwnerOf = (nodes: readonly SceneNode[], piece: SceneNode): SceneNode | null => {
  if (piece.motion) return piece;
  const parent = piece.parentId ? nodes.find((n) => n.id === piece.parentId) : undefined;
  return parent?.motion ? parent : null;
};

/** Orientation that defines front/left/top for a node (a group uses its first piece's). */
export const orientationOf = (nodes: readonly SceneNode[], node: SceneNode): SceneNode['rotation'] =>
  node.type === 'group' ? (childrenOf(nodes, node.id)[0]?.rotation ?? node.rotation) : node.rotation;
