// Player-lens helpers (P4 — trust): one toggle shows the DM exactly what
// players receive. The room snapshot's mapElements are ALREADY the
// player-filtered data for every recipient (deriveMapElements is the sole
// privacy producer — never add a second one); what differs client-side is the
// DM chrome and the per-recipient strips these helpers mirror:
//   - secret doors (the server strips them from player snapshots),
//   - fog of war (players render it, the DM sees through),
//   - the DM-only walls/notes overlays (gated off dmView in MapBoard).

import type { CompiledDoor, Token } from "@herobyte/shared";

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
