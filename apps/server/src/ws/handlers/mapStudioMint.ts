// ============================================================================
// MAP STUDIO MINT — the ceiling the studio's own mints answer to
// ============================================================================
// Extracted from MapStudioMessageHandler for the 350-LOC cap. The count half
// (A3) and the byte half (the Weighed Campaign plan): a room past
// MAX_SESSION_DOCUMENTS, or whose export would outweigh what one load-session
// frame can carry, writes a session file its OWN reimport rejects — the DM's
// backup silently stops being a backup. Thrown like the duplicate-id case:
// the handler turns it into the frame the DM sees, and the mint does not
// happen. Every studio path that creates a document calls this with the
// document it WOULD create (create, import; the live GENERATE tool and the
// atlas mints weigh through `mintOverflowWith` / their own twins).

import type { MapDocument } from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";
import {
  mintOverflow,
  mintRefusal,
  withCandidate,
  type MintOverflow,
} from "../../domains/room/sessionExport.js";
import { MAX_SESSION_DOCUMENTS } from "../../middleware/validators/sessionValidators.js";
import { mintSceneBytes } from "./liveSceneBytes.js";

export interface MapStudioMintDeps {
  service: MapStudioService;
  getRoomState: (roomId: string) => RoomState;
  now: () => number;
}

/** The byte half alone: the export with `candidate` added or replaced, its scene swapped in. */
export function mintOverflowWith(
  deps: MapStudioMintDeps,
  roomId: string,
  senderUid: string,
  candidate: MapDocument,
): MintOverflow | null {
  const state = deps.getRoomState(roomId);
  return mintOverflow(
    state,
    withCandidate(deps.service.list(roomId), candidate),
    senderUid,
    mintSceneBytes(state, deps.service, roomId, candidate, deps.now()),
  );
}

/**
 * Both halves. The count first — before the candidate is even built, so a
 * table at 64 maps hears "maximum of 64" and not whatever the candidate's own
 * validation would have said.
 */
export function assertMintCeiling(
  deps: MapStudioMintDeps,
  roomId: string,
  senderUid: string,
  candidate: () => MapDocument,
): void {
  if (deps.service.list(roomId).length >= MAX_SESSION_DOCUMENTS) {
    throw new Error(
      `This table already holds the maximum of ${MAX_SESSION_DOCUMENTS} map documents — delete one first.`,
    );
  }
  const overflow = mintOverflowWith(deps, roomId, senderUid, candidate());
  if (overflow) {
    throw new Error(mintRefusal(overflow));
  }
}
