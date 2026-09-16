// ============================================================================
// LIVE SCENE BYTES — what a document adds to the export once it is the scene
// ============================================================================
import { utf8ByteLength, type MapDocument } from "@herobyte/shared";
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
 * What the scene ON THE TABLE weighs in the export right now — the five keys
 * a travel installs, as they stand. Measured, never recompiled from the
 * binding: a publish leaves `mapTerrain`/`mapElements` undefined, an unbind or
 * a delete-of-the-live-map keeps the scene with no binding at all, and every
 * other consumer in the codebase keys on the scene, not the binding (round 2
 * of the review). 0 when nothing is compiled.
 */
export function installedSceneBytes(state: RoomState): number {
  if (!state.compiledScene) return 0;
  return utf8ByteLength(
    JSON.stringify({
      compiledScene: state.compiledScene,
      mapTerrain: state.mapTerrain,
      mapElements: state.mapElements,
      gridSize: state.gridSize,
      gridSquareSize: state.gridSquareSize,
    }),
  );
}

/**
 * Both halves of a mint's scene weigh: the candidate's live-scene bytes and
 * the OUTGOING scene's — what a travel (or the live GENERATE tool's recompile)
 * replaces, which is whatever is installed now.
 */
export function mintSceneBytes(
  state: RoomState,
  candidate: MapDocument,
  now: number,
): MintSceneBytes {
  return { candidate: liveSceneBytes(candidate, now), outgoing: installedSceneBytes(state) };
}
