// Player-lens helpers (P4 — trust): one toggle shows the DM exactly what
// players receive. The room snapshot's mapElements are ALREADY the
// player-filtered data for every recipient (deriveMapElements is the sole
// privacy producer — never add a second one); what differs client-side is the
// DM chrome and the per-recipient strips these helpers mirror:
//   - secret doors (the server strips them from player snapshots),
//   - fog of war (players render it, the DM sees through),
//   - the DM-only walls/notes overlays (gated off dmView in MapBoard).

import {
  effectiveVisionRadiusFeet,
  gridCellToWorldPoint,
  type AtlasNodeSnapshot,
  type CompiledDoor,
  type MapLinkSnapshot,
  type ScenePoint,
  type Token,
} from "@herobyte/shared";

/** One sightline source for the fog: where it stands, and how far it sees. */
export interface FogViewer extends ScenePoint {
  /** `Token.visionRadius` in feet. Undefined means unlimited. */
  radiusFeet?: number;
}

/** DM chrome and DM-only data render only when this is true. */
export function dmViewActive(isDM: boolean, playerLens: boolean): boolean {
  return isDM && !playerLens;
}

/**
 * The doors this view may render. Mirrors the server's player strip: a
 * player snapshot never contains a secret door, so the lens must not show
 * one. This FILTERS a server-filtered list for display — it produces no new
 * player-facing data (the secrecy invariant stays with the server).
 */
export function visibleDoors(doors: readonly CompiledDoor[], dmView: boolean): CompiledDoor[] {
  return dmView ? [...doors] : doors.filter((door) => door.state !== "secret");
}

/**
 * The atlas links (and current node) this view may render. Mirrors the
 * server's player projection (atlasProjection.ts) for display under the lens:
 * a player receives a link only when it is visibleToPlayers and its from-node
 * is discovered, and no current node at all when the node underfoot is
 * undiscovered (the deliberately mysterious frame). Like visibleDoors this
 * FILTERS the DM's server-filtered data for display — it produces no new
 * player-facing data; a real player's list was filtered server-side.
 */
export function visibleAtlasLinks(
  links: readonly MapLinkSnapshot[],
  nodes: readonly AtlasNodeSnapshot[],
  currentNodeId: string | undefined,
  dmView: boolean,
): { links: MapLinkSnapshot[]; currentNodeId: string | undefined } {
  if (dmView) return { links: [...links], currentNodeId };
  const discovered = new Set(nodes.filter((node) => node.discovered).map((node) => node.id));
  return {
    links: links.filter(
      (link) => link.visibleToPlayers !== false && discovered.has(link.fromNodeId),
    ),
    currentNodeId: currentNodeId && discovered.has(currentNodeId) ? currentNodeId : undefined,
  };
}

/**
 * The tokens whose vision feeds the fog for this view. A player sees from
 * their OWN tokens; the lens has no single player to impersonate, so it shows
 * the PARTY's union vision — every token the DM does not own. That is the
 * most honest one-toggle answer to "what can the table see right now".
 */
export function fogViewerTokens(
  tokens: readonly Token[],
  uid: string,
  playerLens: boolean,
): Token[] {
  return playerLens
    ? tokens.filter((token) => token.owner !== uid)
    : tokens.filter((token) => token.owner === uid);
}

/**
 * The same tokens as world-space viewers, each carrying its OWN sight radius.
 *
 * Vision origins are cell centres, matching the renderer and the server's
 * `createVisionContext`. Under the DM's lens this is a union of discs, one per
 * party token — a lens that ignored the radii would show the DM a brighter
 * table than any player actually has, which is the opposite of what the lens
 * is for. The table default is resolved through the SHARED resolver for the
 * same reason, and it matters as much under the lens: a DM who set the table
 * dark must see that darkness when they look through the players' eyes.
 */
export function fogViewers(
  tokens: readonly Token[],
  uid: string,
  playerLens: boolean,
  gridSize: number,
  /**
   * `RoomSnapshot.defaultVisionRadius` — the fallback for tokens with none.
   * REQUIRED, though it is frequently undefined: an optional parameter can be
   * dropped from the single call site with every gate staying green, and the
   * result is client fog and server filtering disagreeing in silence.
   */
  defaultRadiusFeet: number | undefined,
): FogViewer[] {
  return fogViewerTokens(tokens, uid, playerLens).map((token) => ({
    ...gridCellToWorldPoint(gridSize, { x: token.x, y: token.y }),
    radiusFeet: effectiveVisionRadiusFeet(token.visionRadius, defaultRadiusFeet),
  }));
}
