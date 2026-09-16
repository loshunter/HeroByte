// ============================================================================
// MAP STUDIO GENERATE — the live tool's recipe, landing as ONE place-room
// ============================================================================
// Extracted from MapStudioMessageHandler for the 350-LOC cap, and because this
// path is a MINT in everything but name: a recipe lands hundreds of elements
// on an existing document in one command, so it is weighed against the export
// ceiling like every other mint (the Weighed Campaign plan, W1). It is also
// the home the live tool's recipe picker (Kicked-In Door plan §7) will need.
//
// A recipe runs server-side and lands as ONE place-room command, so undo,
// retry-dedupe, revision conflicts, and (when the target is the live-bound
// document) the recompile all ride the existing rails. The message's
// commandId doubles as the element idPrefix — retries hit the dedupe cache,
// so generated ids can never collide with themselves.

import { applyMapDocumentCommand, type ClientMessage, type MapDocument } from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import { dungeonRecipe } from "../../domains/generation/dungeonRecipe.js";
import {
  assertGenerateSeed,
  assertRecipeBudget,
  resolveRecipeContext,
} from "../../domains/generation/recipeContext.js";
import type { RoomState } from "../../domains/room/model.js";
import { mintRefusal, type MintOverflow } from "../../domains/room/sessionExport.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { alreadyApplied, REPLAY_LANDED } from "./mapStudioHandlerUtils.js";

export type MapStudioGenerateMessage = Extract<ClientMessage, { t: "map-studio-generate" }>;

export interface MapStudioGenerateDeps {
  service: MapStudioService;
  getRoomState: (roomId: string) => RoomState;
  now: () => number;
  /** `weigh`: attach the campaign's weight after this frame — a recipe moves it by a map's worth. */
  broadcastDocument: (
    roomId: string,
    document: MapDocument,
    appliedCommandId?: string,
    weigh?: boolean,
  ) => void;
  recompileLiveScene: (
    roomId: string,
    previous: MapDocument | undefined,
    document: MapDocument,
  ) => void;
  sendCommandError: (
    senderUid: string,
    command: { commandId: string; documentId: string },
    error: unknown,
  ) => void;
  /**
   * The byte ceiling, weighed on the post-apply document REPLACING its
   * current version in the room's list — in memory, before the store sees it.
   */
  weighMint: (roomId: string, senderUid: string, candidate: MapDocument) => MintOverflow | null;
}

const IDLE: RouteHandlerResult = { broadcast: false, save: false };

export function handleMapStudioGenerate(
  deps: MapStudioGenerateDeps,
  senderUid: string,
  roomId: string,
  message: MapStudioGenerateMessage,
): RouteHandlerResult {
  try {
    // A replay (the client queue re-sends the in-flight message after a
    // reconnect) must ack from the dedupe cache BEFORE any validation:
    // re-running the resolver would reject a generate that already landed
    // if the document changed since (a layer locked, the grid moved).
    const replay = deps.service.cachedResult(roomId, message.documentId, message.commandId);
    if (replay) {
      deps.broadcastDocument(roomId, replay.document, replay.commandId);
      return IDLE;
    }
    const document = deps.service.get(roomId, message.documentId);
    const ctx = resolveRecipeContext(document, message.bounds, message.commandId);
    assertGenerateSeed(message.seed);
    const output = dungeonRecipe(message.seed, message.bounds, message.params, ctx);
    assertRecipeBudget(output);
    const command = {
      type: "place-room" as const,
      commandId: message.commandId,
      documentId: message.documentId,
      baseRevision: document.revision,
      cells: output.cells,
      elements: output.elements,
    };
    const timestamp = deps.now();
    // VALIDATE-THEN-PERSIST, as cashNode does: the candidate is the document
    // as it WOULD be after this command. Applied to a clone so `document`
    // stays the pre-apply "previous" the door-state preservation wants.
    const candidate = applyMapDocumentCommand(
      structuredClone(document),
      command,
      timestamp,
    ).document;
    const overflow = deps.weighMint(roomId, senderUid, candidate);
    if (overflow) {
      deps.sendCommandError(senderUid, message, new Error(mintRefusal(overflow)));
      return IDLE;
    }
    const isLive = deps.getRoomState(roomId).liveMapDocumentId === message.documentId;
    const result = deps.service.apply(roomId, command, timestamp);
    if (isLive) {
      // `document` is the store's pre-apply object (the clone above was consumed
      // by the weigh) — exactly the "previous" the door-state preservation wants.
      // Recompiled BEFORE the weighed frame below, so the weight it carries is
      // the table's after the recipe, scene included.
      deps.recompileLiveScene(roomId, document, result.document);
    }
    // Every DM's readout follows the recipe from this frame — no re-list, and
    // not only the DM who fired it (round 2 of the review).
    deps.broadcastDocument(roomId, result.document, result.commandId, true);
    if (isLive) {
      return { broadcast: true, save: true };
    }
  } catch (error) {
    // A replay whose dedupe entry has been evicted (the cache is global and
    // bounded) re-runs the recipe, deterministically re-mints the same ids,
    // and trips the duplicate-id guard. Nothing half-applies — the batch
    // validates before it commits — but "Map element already exists:
    // <uuid>:e17" is a lie dressed as an error: the dungeon IS on the map.
    deps.sendCommandError(senderUid, message, alreadyApplied(error) ? REPLAY_LANDED : error);
  }
  return IDLE;
}
