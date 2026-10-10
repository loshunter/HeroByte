// ============================================================================
// THE LOOSE TOKEN — one rule for an unlinked PC's token
// ============================================================================
// A PC that predates linking has no `tokenId`. Two places read "its" token: at
// join, ensureToken links the PC to it (or spawns one); at send time,
// loosePcColours gives the PC its colour, so every screen shows the colour that
// PC will wear once linked. They must agree, so they share this rule.

import type { RoomState } from "../room/model.js";

/**
 * The one token `ownerUid` owns that no character claims, while they run exactly
 * ONE PC (with two, adopting a token is a guess). DM or player alike. Undefined
 * when there is none, or more than one.
 */
export function looseTokenOf(
  state: RoomState,
  ownerUid: string,
): RoomState["tokens"][number] | undefined {
  const ownedPcs = state.characters.filter(
    (c) => c.type === "pc" && c.ownedByPlayerUID === ownerUid,
  );
  if (ownedPcs.length !== 1) return undefined;
  const claimed = new Set(state.characters.flatMap((c) => (c.tokenId ? [c.tokenId] : [])));
  const loose = state.tokens.filter((t) => t.owner === ownerUid && !claimed.has(t.id));
  return loose.length === 1 ? loose[0] : undefined;
}
