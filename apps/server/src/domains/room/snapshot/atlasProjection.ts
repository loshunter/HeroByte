// ============================================================================
// ATLAS PROJECTION — the discovered-only view of the campaign graph
// ============================================================================
// Called from buildRecipientView, which stays the ONE privacy-filtered
// producer. Its own module because recipientFilter.ts sits 19 lines under the
// 350-LOC guard.
//
// WHITELIST CONSTRUCTORS, never strip-lists: a spread-based projection fails
// OPEN for every field AtlasNode gains later (`pinned`, notes, …). The player
// shapes below are built field by field, and the projection tests pin their
// exact key sets so a new field fails a test by name before it can leak.
//
// What a player must never learn from these frames: that an undiscovered node
// exists at all (name, kind, count); a node's recipe provenance (a seed plus a
// reimplemented recipe is a floor-plan oracle); promise-vs-mapped status
// (mapDocumentId is DM prep state); edit timestamps (a ticking updatedAt with
// no visible change narrates hidden work); where a visible link LEADS when the
// target is undiscovered.

import type { AtlasNodeSnapshot, MapLinkSnapshot } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export interface AtlasView {
  atlasNodes: AtlasNodeSnapshot[];
  atlasLinks: MapLinkSnapshot[];
  currentAtlasNodeId: string | undefined;
}

export function projectAtlasFor(state: RoomState, isDM: boolean): AtlasView {
  // Same defence-in-depth as visibleChatFor: this runs inside the debounced
  // broadcast timer, so a poisoned non-array must be disarmed, not walked.
  const nodes = Array.isArray(state.atlasNodes) ? state.atlasNodes : [];
  const links = Array.isArray(state.atlasLinks) ? state.atlasLinks : [];

  const currentNode = state.liveMapDocumentId
    ? nodes.find((node) => node.mapDocumentId === state.liveMapDocumentId)
    : undefined;

  if (isDM) {
    return {
      atlasNodes: nodes,
      atlasLinks: links,
      currentAtlasNodeId: currentNode?.id,
    };
  }

  const discovered = new Set(
    nodes.filter((node) => node.discovered === true).map((node) => node.id),
  );

  const atlasNodes: AtlasNodeSnapshot[] = nodes
    .filter((node) => node.discovered === true)
    .map((node) => {
      const projected: AtlasNodeSnapshot = {
        id: node.id,
        kind: node.kind,
        name: node.name,
        discovered: true,
      };
      // Only when the parent itself is discovered — an orphan renders at the
      // player's root, and the hidden parent's existence leaks nothing.
      if (node.parentId && discovered.has(node.parentId)) {
        projected.parentId = node.parentId;
      }
      return projected;
    });

  const atlasLinks: MapLinkSnapshot[] = links
    .filter((link) => link.visibleToPlayers === true && discovered.has(link.fromNodeId))
    .map((link) => {
      const projected: MapLinkSnapshot = {
        id: link.id,
        fromNodeId: link.fromNodeId,
        anchor: { x: link.anchor.x, y: link.anchor.y },
        linkType: link.linkType,
      };
      // The sprite renders without knowing where it leads.
      if (discovered.has(link.toNodeId)) {
        projected.toNodeId = link.toNodeId;
      }
      return projected;
    });

  return {
    atlasNodes,
    atlasLinks,
    // Standing on an undiscovered node's map shows no "you are here" — the
    // deliberately mysterious frame (plan §2.2).
    currentAtlasNodeId: currentNode && discovered.has(currentNode.id) ? currentNode.id : undefined,
  };
}
