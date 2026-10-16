// ============================================================================
// TOKEN FRAME — set-token-frame (C5a)
// ============================================================================
// A token's frame is its owner's or the DM's to change, like its colour. The
// validator has already refused anything the catalog does not allow (a shape
// other than the circle, a finish, an unknown generator or palette, more than
// six bands, a weight outside 0.04–0.34); what is stored is the clean, clamped
// copy sanitizeTokenFrame returns, never the client's object. `null` deletes
// the field: the token draws as it did before frames.

import { sanitizeTokenFrame } from "@herobyte/shared";
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
