// ============================================================================
// SEAT REMOVAL — what the Players tab says before the server decides
// ============================================================================
// The DM's REMOVE (PlayersTab.tsx) previews the server's rule
// (apps/server/src/ws/handlers/removePlayer.ts) rather than deciding anything:
// the grace window the row waits through, the tokens the confirm counts, and
// the words the DM agrees to. Its own module because the tab sits at the
// 350-line guard, and because the count and the grace are rules, not markup.

import type { SceneObject } from "@herobyte/shared";

/**
 * A seat whose last heartbeat is this recent cannot be removed yet: a network
 * blip drops a uid from the connected roster for a moment, and a REMOVE in
 * that moment would destroy a live player's characters. Mirrors the server's
 * REMOVE_PLAYER_GRACE_MS (apps/server/src/ws/handlers/removePlayer.ts), which
 * is the one that decides; the test reads that source so the two cannot drift.
 */
export const REMOVE_PLAYER_GRACE_MS = 60_000;

/** The slice of a character this tab needs: whose it is, what it is, what it stands on. */
export interface SeatCharacter {
  tokenId?: string | null;
  ownedByPlayerUID?: string | null;
  type?: "pc" | "npc";
}

/** The question REMOVE asks — exported so the test pins the words a DM agrees to. */
export function removePlayerConfirm(name: string, tokenCount: number): string {
  return (
    `Remove ${name} from the table? They are not at the table. Their character sheets and ` +
    `${tokenCount} token${tokenCount === 1 ? "" : "s"} on the map go with the seat. There is ` +
    "no undo, though loading an older session file brings the character and its token back " +
    "(not the seat). The table password still lets them back in, as a new player."
  );
}

/**
 * The tokens that go with the seat, counted the way the server removes them
 * (removePlayer.ts): every token the uid owns — locked or not — except one
 * still standing under a character that SURVIVES the sweep. Only the uid's
 * own PCs go; an NPC keeps its token whoever placed it or claimed it, and so
 * does another player's PC. Not the Select All count, which is unlocked-only.
 */
export function getSeatTokenCount(
  playerUid: string,
  sceneObjects: SceneObject[],
  characters: readonly SeatCharacter[],
): number {
  const survives = (c: SeatCharacter) => !(c.ownedByPlayerUID === playerUid && c.type === "pc");
  // Scene ids carry the kind prefix.
  const keptBySurvivors = new Set(
    characters.filter((c) => survives(c) && c.tokenId).map((c) => `token:${c.tokenId}`),
  );
  // A PC's own token goes with the PC whoever owns it (a DM may have made it).
  const ownPcTokens = new Set(
    characters.filter((c) => !survives(c) && c.tokenId).map((c) => `token:${c.tokenId}`),
  );
  return sceneObjects.filter(
    (obj) =>
      obj.type === "token" &&
      (obj.owner === playerUid || ownPcTokens.has(obj.id)) &&
      !keptBySurvivors.has(obj.id),
  ).length;
}
