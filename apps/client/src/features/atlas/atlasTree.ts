// ============================================================================
// ATLAS TREE — pure parent/child ordering for the campaign graph
// ============================================================================
// Turns the snapshot's flat node list into indented rows. Defensive by
// design: a node whose parent is absent from the list renders at the root
// (players legitimately receive orphans — the projection blanks a hidden
// parent), and a cycle member renders at the root rather than recursing
// forever (the server refuses cycle-minting reparents, but this module must
// not trust that with the render loop).

import type { AtlasNodeSnapshot } from "@herobyte/shared";

export interface AtlasTreeRow {
  node: AtlasNodeSnapshot;
  depth: number;
}

function byNameThenId(a: AtlasNodeSnapshot, b: AtlasNodeSnapshot): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function atlasTreeRows(nodes: AtlasNodeSnapshot[]): AtlasTreeRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // A node is a ROOT when it has no parent, its parent is absent, or walking
  // its ancestry loops back (a cycle) — the visited set bounds every walk.
  const isRoot = (node: AtlasNodeSnapshot): boolean => {
    if (!node.parentId || !byId.has(node.parentId)) return true;
    const visited = new Set<string>([node.id]);
    let cursor: string | undefined = node.parentId;
    while (cursor !== undefined) {
      if (visited.has(cursor)) return true; // cycle — break it at this node
      visited.add(cursor);
      cursor = byId.get(cursor)?.parentId;
      if (cursor !== undefined && !byId.has(cursor)) return false;
    }
    return false;
  };

  const childrenOf = new Map<string, AtlasNodeSnapshot[]>();
  const roots: AtlasNodeSnapshot[] = [];
  for (const node of nodes) {
    if (isRoot(node)) {
      roots.push(node);
    } else {
      const siblings = childrenOf.get(node.parentId!) ?? [];
      siblings.push(node);
      childrenOf.set(node.parentId!, siblings);
    }
  }

  const rows: AtlasTreeRow[] = [];
  const emitted = new Set<string>();
  const emit = (node: AtlasNodeSnapshot, depth: number): void => {
    if (emitted.has(node.id)) return; // belt over the cycle-braces above
    emitted.add(node.id);
    rows.push({ node, depth });
    for (const child of (childrenOf.get(node.id) ?? []).sort(byNameThenId)) {
      emit(child, depth + 1);
    }
  };
  for (const root of roots.sort(byNameThenId)) {
    emit(root, 0);
  }
  // Anything never reached (a child chain hanging off a cycle) still renders.
  for (const node of nodes) {
    if (!emitted.has(node.id)) emit(node, 0);
  }
  return rows;
}
