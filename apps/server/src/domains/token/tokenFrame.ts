// ============================================================================
// TOKEN FRAME — set-token-frame (C5a)
// ============================================================================
// A token's frame is its owner's or the DM's to change, like its colour. The
// validator has already refused anything the catalog does not allow (a shape
// it does not list, a notch but the one arrow, a finish, an unknown generator
// or palette, more than six bands, a weight outside 0.04–0.34); what is stored is the clean, clamped
// copy sanitizeTokenFrame returns, never the client's object. `null` deletes
// the field: the token draws as it did before frames.

import { pinFrameSeeds, sanitizeTokenFrame, type Token, type TokenFrame } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";

export function setTokenFrame(
  state: RoomState,
  tokenId: string,
  senderUid: string,
  frame: unknown,
  isDM: boolean,
): { broadcast: boolean; save: boolean } {
  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  if (!token || (token.owner !== senderUid && !isDM)) return { broadcast: false, save: false };
  if (frame === null) {
    delete token.frame;
    return { broadcast: true, save: true };
  }
  const checked = sanitizeTokenFrame(frame);
  if ("error" in checked) return { broadcast: false, save: false };
  token.frame = checked.frame;
  return { broadcast: true, save: true };
}

/** What an NPC's old token wore, for the token made in its place. */
export interface CarriedFrame {
  /** The old token was found (on this map, or parked on another). */
  found: boolean;
  /** Its frame with the stones' seeds pinned, or none if it wore none. */
  frame?: TokenFrame;
}

/**
 * The frame a token wore, wherever it stands (this map, or parked on
 * another), with its stones' seeds pinned from that token: given to a token
 * made in its place (an NPC placed again) it looks exactly the same, and a
 * token that wore no frame passes that on too.
 */
export function carriedFrame(state: RoomState, tokenId: string | null | undefined): CarriedFrame {
  if (!tokenId) return { found: false };
  const parked = Object.values(state.sceneStates ?? {}).flatMap((scene) => scene.tokens);
  const token = [...state.tokens, ...parked].find((candidate) => candidate.id === tokenId);
  if (!token) return { found: false };
  return token.frame
    ? { found: true, frame: pinFrameSeeds(token.frame, token.id) }
    : { found: true };
}

/** The new token wears what the old one wore: its frame, or none (not the default ring). */
export function wearCarriedFrame(token: Token, carried: CarriedFrame): void {
  if (!carried.found) return;
  if (carried.frame) token.frame = carried.frame;
  else delete token.frame;
}
