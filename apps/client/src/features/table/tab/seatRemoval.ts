// ============================================================================
// SEAT REMOVAL — what DM Menu → Table → Players at this table says before the server decides
// ============================================================================
// The DM's REMOVE (TablePlayersSection.tsx) previews the server's rule
// (apps/server/src/ws/handlers/removePlayer.ts) rather than deciding anything:
// the grace window the row waits through, the tokens the confirm counts, and
// the words the DM agrees to. Its own module because the count and the grace
// are rules, not markup.

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
export function removePlayerConfirm(name: string, tokenCount: number, lockedCount = 0): string {
  // A locked token is deleted by no one: the sweep leaves it on the map and passes it to the DM.
  const kept =
    lockedCount > 0
      ? ` ${lockedCount} locked token${lockedCount === 1 ? " stays" : "s stay"} on the map and ` +
        `pass${lockedCount === 1 ? "es" : ""} to you.`
      : "";
  return (
    `Remove ${name} from the table? They are not at the table. Their character sheets and ` +
    `${tokenCount} token${tokenCount === 1 ? "" : "s"} on the map go with the seat.${kept} There is ` +
    "no undo, though restoring an older table backup brings the character and its token back " +
    "(not the seat). The table password still lets them back in, as a new player."
  );
}

/**
 * The seat's tokens, counted the way the server sweeps them (removePlayer.ts):
 * every token the uid owns, except one still standing under a character that
 * SURVIVES the sweep. Only the uid's own PCs go; an NPC keeps its token whoever
 * placed it or claimed it, and so does another player's PC. A LOCKED one stays
 * (it passes to the DM), so `going` counts the unlocked and `kept` the locked.
 */
export function getSeatTokens(
  playerUid: string,
  sceneObjects: SceneObject[],
  characters: readonly SeatCharacter[],
): { going: number; kept: number } {
  const seat = seatTokenObjects(playerUid, sceneObjects, characters);
  const kept = seat.filter((obj) => obj.locked).length;
  return { going: seat.length - kept, kept };
}

/** The tokens that go with the seat: the unlocked ones (getSeatTokens). */
export function getSeatTokenCount(
  playerUid: string,
  sceneObjects: SceneObject[],
  characters: readonly SeatCharacter[],
): number {
  return getSeatTokens(playerUid, sceneObjects, characters).going;
}

function seatTokenObjects(
  playerUid: string,
  sceneObjects: SceneObject[],
  characters: readonly SeatCharacter[],
): SceneObject[] {
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
  );
}
