/**
 * A DM who stops being one keeps their own characters, but not the DM's pieces.
 *
 * Every monster a DM places is owned by that DM's uid, and `token.owner` is both
 * a move authority (token service, drag preview, keyboard steps) and a sightline:
 * a player sees from every token they own (visionFilter), and an own token
 * passes the fog (recipientFilter). Left with the uid, a DM who pressed Leave DM
 * mode — or anyone who reclaimed a DM's uid with the table password alone — saw
 * through every monster's eyes, saw NPCs through the fog, and could move,
 * delete or recolour hidden ones.
 *
 * Those tokens pass to the DM role: an owner no uid can be (a uid is
 * [A-Za-z0-9_-], ConnectionLifecycleManager), so no player ever matches it and
 * only a DM acts on them, as a DM does on any token it does not own. The uid's
 * own player characters' tokens stay theirs. REMOVE and a clear already hand a
 * departing seat's pieces to the DM who acted; a demotion has no acting DM.
 */

import type { Player } from "@herobyte/shared";
import type { RoomState } from "./model.js";

export const DM_ROLE_OWNER = "@dm";

export function demoteDM(state: Pick<RoomState, "tokens" | "characters">, player: Player): void {
  player.isDM = false;
  const ownCharacterTokens = new Set(
    state.characters
      .filter((character) => character.type === "pc" && character.ownedByPlayerUID === player.uid)
      .map((character) => character.tokenId),
  );
  let passed = 0;
  for (const token of state.tokens) {
    if (token.owner !== player.uid || ownCharacterTokens.has(token.id)) continue;
    token.owner = DM_ROLE_OWNER;
    passed += 1;
  }
  console.log(`[DM] ${player.uid} is no longer DM; ${passed} piece(s) passed to the DM role`);
}
