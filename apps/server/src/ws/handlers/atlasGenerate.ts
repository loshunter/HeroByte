// ============================================================================
// ATLAS GENERATE — cash a promise node into a real dungeon
// ============================================================================
// Split from AtlasMessageHandler for the 350-LOC cap (the mapStudioGenerate
// precedent). The ORDER here is the A3 spec and the review's F1 fix:
// VALIDATE-THEN-PERSIST. createMapDocument is pure, so the recipe runs against
// an in-memory mint — a validation or budget failure persists NOTHING, and the
// one persisted step that can still fail (apply) deletes the document on the
// way out. No orphans, ever.
//
// Idempotency is the NODE GUARD, not the place-room dedupe cache: the cache
// key contains the document id, which is minted fresh per attempt, so a retry
// can never hit it. A retried generate finds node.mapDocumentId set and acks
// as a no-op (re-broadcasting the document so a lost first ack still leaves
// the DM's studio list fresh).

import { createMapDocument, type AtlasNode, type ServerMessage } from "@herobyte/shared";
import { randomUUID } from "node:crypto";
import { dungeonRecipe } from "../../domains/generation/dungeonRecipe.js";
import {
  assertGenerateRequest,
  assertRecipeBudget,
  resolveRecipeContext,
} from "../../domains/generation/recipeContext.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import { MAX_SESSION_DOCUMENTS } from "../../middleware/validators/sessionValidators.js";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * Preset dimensions in CELLS. Every preset must clear the recipe's 20×20
 * floor (MIN_RECIPE_COLS/ROWS — small sits at zero row margin ON PURPOSE)
 * and the 16384-cell ceiling; a test pins both so a new preset cannot ship
 * an always-erroring button.
 */
export const GENERATE_PRESETS = {
  small: { cols: 24, rows: 20 },
  medium: { cols: 48, rows: 36 },
  large: { cols: 96, rows: 64 },
} as const;

export interface AtlasGenerateDeps {
  mapStudioService: MapStudioService;
  broadcastToDMs: (roomId: string, message: ServerMessage) => void;
  sendError: (
    uid: string,
    code: "rejected" | "not-found" | "at-cap",
    reason: string,
    nodeId?: string,
  ) => RouteHandlerResult;
  now: () => number;
}

export interface AtlasGenerateMessage {
  nodeId: string;
  commandId: string;
  seed: number;
  params: {
    theme: "stone" | "wood";
    density: "low" | "medium" | "high";
    size: keyof typeof GENERATE_PRESETS;
  };
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
  // The mint ceiling protects the EXPORT promise: a room past
  // MAX_SESSION_DOCUMENTS writes a session file its own reimport rejects.
  if (deps.mapStudioService.list(roomId).length >= MAX_SESSION_DOCUMENTS) {
    return deps.sendError(
      senderUid,
      "at-cap",
      `This table already holds the maximum of ${MAX_SESSION_DOCUMENTS} map documents — delete one first.`,
      message.nodeId,
    );
  }

  const { cols, rows } = GENERATE_PRESETS[message.params.size];
  const timestamp = deps.now();
  const documentId = randomUUID();
  const bounds = { x: 0, y: 0, cols, rows };
  const documentInput = {
    id: documentId,
    name: node.name,
    width: cols * 50,
    height: rows * 50,
    timestamp,
  };

  // Everything pure runs against the in-memory mint FIRST.
  let cells;
  let elements;
  try {
    const minted = createMapDocument(documentInput);
    const ctx = resolveRecipeContext(minted, bounds, message.commandId);
    assertGenerateRequest(message.seed, {
      theme: message.params.theme,
      density: message.params.density,
    });
    const output = dungeonRecipe(
      message.seed,
      bounds,
      { theme: message.params.theme, density: message.params.density },
      ctx,
    );
    assertRecipeBudget(output);
    cells = output.cells;
    elements = output.elements;
  } catch (error) {
    return deps.sendError(
      senderUid,
      "rejected",
      error instanceof Error ? error.message : "The recipe failed.",
      message.nodeId,
    );
  }

  // Only now does anything persist — and the one step that can still fail
  // deletes the document on the way out.
  deps.mapStudioService.create(roomId, documentInput);
  try {
    deps.mapStudioService.apply(
      roomId,
      {
        type: "place-room",
        commandId: message.commandId,
        documentId,
        baseRevision: 0,
        cells,
        elements,
      },
      timestamp,
    );
  } catch (error) {
    deps.mapStudioService.delete(roomId, documentId);
    return deps.sendError(
      senderUid,
      "rejected",
      error instanceof Error ? error.message : "Applying the generated map failed.",
      message.nodeId,
    );
  }

  node.mapDocumentId = documentId;
  node.recipe = {
    recipeId: "dungeon",
    seed: message.seed,
    theme: message.params.theme,
    density: message.params.density,
  };
  node.updatedAt = timestamp;
  deps.broadcastToDMs(roomId, {
    t: "map-studio-document",
    document: deps.mapStudioService.get(roomId, documentId),
  });
  return MUTATED;
}
