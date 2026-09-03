// ============================================================================
// SCENE TRAVEL — the ONE suspend/resume composition
// ============================================================================
// `atlas-travel` and `map-studio-set-live` both move the table between maps,
// and they share THIS function; if the two ever diverge, one of them is wrong
// (plan §4.8). The whole mutation is one synchronous block — no await between
// capture and the caller's returned {broadcast:true} — so no recipient (and
// no racing fork) can observe a half-traveled room.
//
// The transition table (plan §2.2) in code:
//   • a compiled scene is REPLACED  → capture it (if its document still
//     exists), then restore the destination's saved scene or first-visit
//     defaults; travelers always carry across.
//   • no compiled scene on the table AND no saved scene for the destination
//     → COMPILE-ONLY: the START LIVE MAP row — tokens and drawings stay
//     exactly where they are (an uploaded-background table must survive its
//     first bind untouched).
//   • warping to the staging zone is TRAVEL's flavor only; a set-live rebind
//     preserves travelers' cells (a prep rebind must not teleport the party).
//
// Three phases, in this order and no other: COMPILE the destination (pure —
// a document that fails to compile throws before anything on the table has
// moved), CAPTURE the outgoing scene (it reads door runtime from the
// compiled scene still installed), INSTALL the compiled outputs and the
// destination's collections. Compiling after the capture once persisted a
// half-traveled room: the outgoing scene captured under its id, the live
// scene still live, and a destination that could not be traveled to.

import {
  compileScene,
  deriveMapElements,
  toLiveGridSize,
  type CompiledScene,
  type MapDocument,
  type SceneState,
  type ServerMessage,
} from "@herobyte/shared";
import {
  captureSceneState,
  isTravelingToken,
  overlaySavedDoorStates,
  placeArrivals,
  restoreCollections,
} from "../../domains/room/scene/sceneSuspend.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { deriveMapTerrain } from "./mapStudioHandlerUtils.js";

export interface SceneTravelDeps {
  mapStudioService: MapStudioService;
  now: () => number;
}

export interface SceneTravelOptions {
  /** Travel warps the party to the destination's staging zone; a rebind must not. */
  warpTravelers: boolean;
  /** Fog default when the destination has NO saved scene. */
  firstVisitFogEnabled: boolean;
  /** Injectable for deterministic arrival tests (zone spawns roll dice). */
  rng?: () => number;
}

/**
 * Move the table's scene to `document`. Mutates state's scene collections and
 * compiled outputs; the CALLER owns the binding (`liveMapDocumentId`) and the
 * broadcast/save result.
 */
export function travelToDocument(
  deps: SceneTravelDeps,
  state: RoomState,
  roomId: string,
  document: MapDocument,
  options: SceneTravelOptions,
): void {
  const now = deps.now();
  const outgoingId = state.compiledScene?.sourceDocumentId;
  const saved = state.sceneStates[document.id];
  // Split travelers from the CURRENT table before anything mutates.
  const travelers = state.tokens.filter((token) => isTravelingToken(token, state));

  // The destination IS the scene already on the table. The callers' no-op
  // guards key on the BINDING, but the binding and the scene diverge after an
  // unbind, a publish, or a delete-of-live (the §2.2 orphan row) — and a
  // "travel" here has nothing to suspend and nothing to resume. Re-attach:
  // recompile (edits made while unbound land) with door runtime preserved,
  // and leave every collection exactly as it stands. Falling through instead
  // skipped the capture and then first-visit-WIPED the live table uncaptured
  // (the arc's final review, three lenses independently).
  if (outgoingId === document.id) {
    const { saved: runtime } = captureSceneState(state, document, now);
    installCompiled(state, compileDocument(document, now, runtime));
    return;
  }

  // PHASE 1 — COMPILE, pure. Nothing on the table has moved yet, so a
  // document the compiler rejects (poisoned in the store, a shape it cannot
  // read) throws HERE and the room stays exactly as it was: no capture stored
  // for a scene that is still live, no half-traveled frame.
  const outputs = compileDocument(document, now, saved);

  // The START LIVE MAP row: nothing to replace, nothing to resume — compile
  // the document onto the table and leave every collection exactly in place.
  // Fog still takes the first-visit default: for a set-live that value IS the
  // room's current fog (an identity assignment), while TRAVELING from the
  // pre-Atlas limbo to a GENERATED node must still arrive concealed — and
  // travel still WARPS the party (the table row), even from limbo.
  if (!outgoingId && !saved) {
    installCompiled(state, outputs);
    state.fogEnabled = options.firstVisitFogEnabled;
    if (options.warpTravelers) {
      // The limbo table's staging zone was drawn for a map that was never a
      // scene; a WARP must not land the party in it on the destination. (A
      // set-live rebind never warps, so the row's "every collection exactly
      // in place" promise still holds for the rebind.)
      state.playerStagingZone = undefined;
      placeArrivals(state, travelers, document, options.rng);
    }
    return;
  }

  // PHASE 2 — CAPTURE the outgoing scene under ITS OWN document id — when
  // that document still exists. The capture reads door runtime from
  // `state.compiledScene`, which is still the OUTGOING scene (install comes
  // next). A deleted document's scene is uncapturable (and its record was
  // already dropped by map-studio-delete); stayers on it are lost with their
  // map, which is the honest outcome.
  if (outgoingId) {
    try {
      const outgoingDocument = deps.mapStudioService.get(roomId, outgoingId);
      const capture = captureSceneState(state, outgoingDocument, now);
      state.sceneStates[outgoingId] = capture.saved;
    } catch {
      console.warn(
        `[SceneTravel] outgoing scene ${outgoingId} is uncapturable (document gone) — its stayers are lost with it`,
      );
    }
  }

  // PHASE 3 — INSTALL the compiled outputs, then the destination's collections.
  installCompiled(state, outputs);
  restoreCollections(state, saved, travelers, {
    firstVisitFogEnabled: options.firstVisitFogEnabled,
  });
  // A resumed scene's record is CONSUMED: a record exists only for scenes
  // that are actually suspended. Left in place it aliased the live
  // collections (restore installs the saved arrays by reference), rode every
  // export as a phantom suspension of the map the party is standing on, and
  // was serialized on every save.
  delete state.sceneStates[document.id];
  // mapBackground is part of the scene (plan §4.11): restoreCollections set it
  // from the saved scene (or cleared it on a first visit) — recompile
  // deliberately never touches it, so without that a raster from the OLD map
  // would haunt the new one.
  if (options.warpTravelers) {
    placeArrivals(state, travelers, document, options.rng);
  }
}

/**
 * The `map-studio-set-live` body (extracted for the 350-LOC cap): unbind and
 * same-doc rows, the not-found error, then the shared travel with a rebind's
 * flavor (no warp, fog inherits).
 */
export function bindLiveDocument(
  deps: SceneTravelDeps,
  state: RoomState,
  senderUid: string,
  roomId: string,
  documentId: string | null,
  sendMessage: (uid: string, message: ServerMessage) => void,
): RouteHandlerResult {
  if (documentId === null) {
    // Unbind: the table keeps its last compiled scene, but future edits stop
    // auto-compiling. NO capture — suspension happens when a scene is
    // REPLACED, never before, so the post-unbind interlude keeps evolving
    // and is captured intact at the next real transition (review S1).
    state.liveMapDocumentId = undefined;
    return { broadcast: true, save: true };
  }
  // Idempotent: a same-document rebind used to recompile and silently wipe
  // door runtime state (the A4 rebuild's first casualty fixed).
  if (documentId === state.liveMapDocumentId) {
    return { broadcast: false, save: false };
  }
  let document: MapDocument;
  try {
    document = deps.mapStudioService.get(roomId, documentId);
  } catch (error) {
    sendMessage(senderUid, {
      t: "map-studio-error",
      commandId: `set-live:${documentId}`,
      documentId,
      code: "command-rejected",
      reason: error instanceof Error ? error.message : "Map document not found",
    });
    return { broadcast: false, save: false };
  }
  travelToDocument(deps, state, roomId, document, {
    warpTravelers: false,
    firstVisitFogEnabled: state.fogEnabled,
  });
  state.liveMapDocumentId = documentId;
  return { broadcast: true, save: true };
}

/**
 * The `atlas-travel` body (extracted for the same cap): resolve the node,
 * degrade store desyncs into defined errors, travel with the party warp and
 * the generated-node fog default, auto-discover on first visit.
 */
export function handleAtlasTravel(
  deps: SceneTravelDeps,
  state: RoomState,
  uid: string,
  roomId: string,
  nodeId: string,
  sendError: (
    uid: string,
    code: "rejected" | "not-found" | "at-cap",
    reason: string,
    nodeId?: string,
  ) => RouteHandlerResult,
): RouteHandlerResult {
  const node = state.atlasNodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return sendError(uid, "not-found", "That atlas node no longer exists.", nodeId);
  }
  if (!node.mapDocumentId) {
    return sendError(
      uid,
      "rejected",
      "That node has no map yet — generate or link one first.",
      nodeId,
    );
  }
  if (state.liveMapDocumentId === node.mapDocumentId) {
    // Already there: a replayed travel no-ops — but "travel to the node I
    // just linked my live map to" is the natural way to REVEAL it, and
    // set-live deliberately never discovers, so discovery still runs here.
    if (node.discovered) {
      return { broadcast: false, save: false };
    }
    node.discovered = true;
    node.updatedAt = deps.now();
    return { broadcast: true, save: true };
  }
  let document: MapDocument;
  try {
    document = deps.mapStudioService.get(roomId, node.mapDocumentId);
  } catch {
    // The state file and the maps file are separate stores and can desync at
    // boot; a "mapped" node whose document vanished degrades HERE into a
    // defined error, never a 12s open-timeout.
    return sendError(
      uid,
      "not-found",
      "That node's map document is missing from the store.",
      nodeId,
    );
  }
  travelToDocument(deps, state, roomId, document, {
    warpTravelers: true,
    // A FIRST visit to a GENERATED node defaults fog ON — a dungeon unmasked
    // on arrival is an irreversible reveal (review S7). Linked maps inherit.
    firstVisitFogEnabled: node.recipe ? true : state.fogEnabled,
  });
  state.liveMapDocumentId = document.id;
  if (!node.discovered) {
    node.discovered = true;
    node.updatedAt = deps.now();
  }
  return { broadcast: true, save: true };
}

/** Everything the compile derives — computed PURE, installed as one assignment. */
interface CompiledOutputs {
  compiledScene: CompiledScene;
  mapTerrain: RoomState["mapTerrain"];
  mapElements: RoomState["mapElements"];
  gridSize: RoomState["gridSize"];
  gridSquareSize: RoomState["gridSquareSize"];
}

/** Fresh compile + derived outputs + grid sync (door overlay when resuming). Touches no state. */
function compileDocument(
  document: MapDocument,
  now: number,
  saved: SceneState | undefined,
): CompiledOutputs {
  const compiled = compileScene(document, now);
  return {
    compiledScene: saved ? overlaySavedDoorStates(compiled, saved, document) : compiled,
    mapTerrain: deriveMapTerrain(document, "elements-only"),
    mapElements: deriveMapElements(document),
    gridSize: toLiveGridSize(document.grid.size),
    gridSquareSize: document.grid.squareSize,
  };
}

/** The install — after the capture, which reads the OUTGOING compiled scene. */
function installCompiled(state: RoomState, outputs: CompiledOutputs): void {
  state.compiledScene = outputs.compiledScene;
  state.mapTerrain = outputs.mapTerrain;
  state.mapElements = outputs.mapElements;
  state.gridSize = outputs.gridSize;
  state.gridSquareSize = outputs.gridSquareSize;
}
