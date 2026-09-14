// ============================================================================
// LIVE SCENE BYTES — what a document adds to the export once it is the scene
// ============================================================================
import { utf8ByteLength, type MapDocument } from "@herobyte/shared";
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
