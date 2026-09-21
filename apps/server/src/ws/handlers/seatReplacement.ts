// ============================================================================
// SEAT REPLACEMENT — a seated player is never left without a character
// ============================================================================
// provisionJoin's rule: a seat someone is sitting in needs a character. The
// owner's own delete mints a replacement client-side (usePlayerActions); a
// DM deleting a CONNECTED player's last character reaches the server with no
// such client path, and "Add Character" lives on the card that player no
// longer has. So the server mints it here. An abandoned seat — the owner is
// not in the connected roster — is left empty on purpose: that is what the
// delete was for. The roster can keep a dead socket's uid for up to the
// heartbeat window, so a delete in that window is refilled, not emptied; the
// DM's confirm says so when the owner is still listed.

import type { Character } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { TokenService } from "../../domains/token/service.js";
import type { RoomService } from "../../domains/room/service.js";

export interface SeatReplacementDeps {
  characterService: CharacterService;
  tokenService: TokenService;
  roomService: RoomService;
}

export function replaceIfSeatedPlayerLostLastCharacter(
  deps: SeatReplacementDeps,
  state: RoomState,
  deleted: Character,
  senderUid: string,
): void {
  const owner = deleted.ownedByPlayerUID;
  if (!owner || owner === senderUid) return;
  if (!state.users.includes(owner)) return;
  // Only a PC counts as a seat's character: a claimed NPC does not get a card.
  if (state.characters.some((c) => c.type === "pc" && c.ownedByPlayerUID === owner)) return;
  const replacement = deps.characterService.createCharacter(
    state,
    "New Character",
    100,
    undefined,
    "pc",
  );
  deps.characterService.claimCharacter(state, replacement.id, owner);
  const spawn = deps.roomService.getPlayerSpawnPosition();
  const token = deps.tokenService.createToken(state, owner, spawn.x, spawn.y);
  deps.characterService.linkToken(state, replacement.id, token.id);
}
