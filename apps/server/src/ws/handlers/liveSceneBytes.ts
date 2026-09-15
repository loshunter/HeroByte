// ============================================================================
// LIVE SCENE BYTES — what a document adds to the export once it is the scene
// ============================================================================
import { utf8ByteLength, type MapDocument } from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";
import type { MintSceneBytes } from "../../domains/room/sessionExport.js";
import { compileDocument } from "./sceneTravel.js";

/**
 * What `document` adds to the room's export the moment it is the LIVE scene:
 * the compiled scene, the terrain and the scenery ride the snapshot, and a
 * kick installs them in the same message that mints. The mint ceiling counts
 * this beside the document itself, or a kick weighed under the ceiling lands
 * a table past it (seen live: a large warehouse allowed at 0.75 MB read
 * 0.81 MB the moment the party arrived). For a mint nothing travels to, it is
 * what the export will weigh the day the party does — an upper bound.
 */
export function liveSceneBytes(document: MapDocument, now: number): number {
  return utf8ByteLength(JSON.stringify(compileDocument(document, now, undefined)));
}

/**
 * Both halves of a mint's scene weigh: the candidate's live-scene bytes and
 * the OUTGOING scene's (the document bound to the table now; 0 when there is
 * none, or when the store no longer has it — a boot-time desync the kick
 * itself refuses separately).
 */
export function mintSceneBytes(
  state: RoomState,
  mapStudioService: MapStudioService,
  roomId: string,
  candidate: MapDocument,
  now: number,
): MintSceneBytes {
  let outgoing = 0;
  if (state.liveMapDocumentId && state.liveMapDocumentId !== candidate.id) {
    try {
      outgoing = liveSceneBytes(mapStudioService.get(roomId, state.liveMapDocumentId), now);
    } catch {
      outgoing = 0;
    }
  } else if (state.liveMapDocumentId === candidate.id) {
    // The live GENERATE tool: the candidate REPLACES the live document, so the
    // outgoing scene is the live document as it stands.
    try {
      outgoing = liveSceneBytes(mapStudioService.get(roomId, candidate.id), now);
    } catch {
      outgoing = 0;
    }
  }
  return { candidate: liveSceneBytes(candidate, now), outgoing };
}
