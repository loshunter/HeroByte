// ============================================================================
// ATLAS GENERATE — cash a promise node into a real map
// ============================================================================
// Split from AtlasMessageHandler for the 350-LOC cap (the mapStudioGenerate
// precedent). The cashing itself — mint, recipe, budget, persist, apply,
// provenance — lives in atlasCash.ts, SHARED with the kick: if the two doors
// ever cash differently, one of them is wrong.
//
// Idempotency is the NODE GUARD, not the place-room dedupe cache: the cache
// key contains the document id, which is minted fresh per attempt, so a retry
// can never hit it. A retried generate finds node.mapDocumentId set and acks
// as a no-op (re-broadcasting the document so a lost first ack still leaves
// the DM's studio list fresh).

import type { AtlasNode, GenerateRequest } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { cashNode, type AtlasCashDeps } from "./atlasCash.js";

export { GENERATE_PRESETS } from "./atlasCash.js";

export interface AtlasGenerateDeps extends AtlasCashDeps {
  sendError: (
    uid: string,
    code: "rejected" | "not-found" | "at-cap",
    reason: string,
    nodeId?: string,
  ) => RouteHandlerResult;
}

export interface AtlasGenerateMessage {
  nodeId: string;
  commandId: string;
  seed: number;
  recipe: GenerateRequest;
}

const NO_OP: RouteHandlerResult = { broadcast: false, save: false };
const MUTATED: RouteHandlerResult = { broadcast: true, save: true };

export function handleAtlasGenerateNode(
  deps: AtlasGenerateDeps,
  state: RoomState,
  senderUid: string,
  roomId: string,
  message: AtlasGenerateMessage,
): RouteHandlerResult {
  const node: AtlasNode | undefined = state.atlasNodes.find(
    (candidate) => candidate.id === message.nodeId,
  );
  if (!node) {
    return deps.sendError(
      senderUid,
      "not-found",
      "That atlas node no longer exists.",
      message.nodeId,
    );
  }
  if (node.mapDocumentId) {
    // Replay of a generate that landed (or a node someone linked meanwhile).
    try {
      deps.broadcastToDMs(roomId, {
        t: "map-studio-document",
        document: deps.mapStudioService.get(roomId, node.mapDocumentId),
      });
    } catch {
      // The document store desynced (boot-time state/maps file mismatch);
      // travel reports it properly — a replay ack must not crash over it.
    }
    return NO_OP;
  }

  const outcome = cashNode(deps, roomId, node, message.seed, message.recipe, message.commandId);
  if (!outcome.ok) {
    return deps.sendError(senderUid, outcome.code, outcome.reason, message.nodeId);
  }
  return MUTATED;
}
