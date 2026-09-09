// ============================================================================
// PUBLISH — the third rider of the one suspend/resume composition
// ============================================================================
// `map-studio-publish` used to compile its document straight into
// `state.compiledScene`, outside travel, and leave `liveMapDocumentId` where it
// was. Publish the map the DM is standing on and that was harmless; publish
// any OTHER map — the Map Studio's selection is a client-local notion that a
// kicked-in door or a travel does not move — and the table was left with its
// binding on one document and its scene on another: terrain dropped, elements
// cleared, a raster of the wrong map, no error. A DM watched their dungeon
// vanish that way on 2026-09-08.
//
// Now a publish IS a travel with a raster on top. `travelToDocument` owns the
// physics either way: the same scene recompiles with door runtime preserved
// (the "recompiles on republish" contract), another scene is captured on the
// way out and the destination installed — and the binding follows, so a
// publish can never again part binding from scene.

import { toLiveGridSize, type MapPublishBackgroundMode } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { deriveMapTerrain } from "./mapStudioHandlerUtils.js";
import { travelToDocument, type SceneTravelDeps } from "./sceneTravel.js";

export interface PublishMessage {
  documentId: string;
  background: string;
  backgroundMode?: MapPublishBackgroundMode;
}

export function publishDocument(
  deps: SceneTravelDeps,
  state: RoomState,
  roomId: string,
  message: PublishMessage,
): RouteHandlerResult {
  // A missing document THROWS (MapDocumentNotFoundError), before anything on
  // the table moves — the caller's contract, kept as it was.
  const document = deps.mapStudioService.get(roomId, message.documentId);

  travelToDocument(deps, state, roomId, document, {
    warpTravelers: false,
    firstVisitFogEnabled: state.fogEnabled,
  });
  state.liveMapDocumentId = document.id;

  // The raster on top. KNOWN BOUNDARY: `background` is a DM-client-rendered
  // raster stored verbatim — the server has no rasterizer, so the notes-layer
  // and hidden-element privacy rules for this ONE field are enforced in the
  // DM's client (rasterVisibility.ts), unlike mapTerrain/mapElements/
  // compiledScene, which are derived server-side from the stored document.
  // Not player-exploitable (only DMs publish, and the sibling background
  // control accepts arbitrary art anyway), but a buggy DM client can leak GM
  // notes into player art.
  state.mapBackground = message.background;
  // A full raster has the terrain baked in — attaching it as data too would
  // draw it twice; elements-only carries a point-in-time copy instead.
  state.mapTerrain = deriveMapTerrain(document, message.backgroundMode);
  // The publish bakes scenery into the background (raster or SVG), so the
  // data-element channel is cleared — otherwise the table renders the stale
  // mapElements OVER the new raster.
  state.mapElements = undefined;
  state.gridSize = toLiveGridSize(document.grid.size);
  state.gridSquareSize = document.grid.squareSize;
  return { broadcast: true, save: true };
}
