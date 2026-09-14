// ============================================================================
// ATLAS CASH — turn a promise node into a real map, atomically
// ============================================================================
// The core of `atlas-generate-node`, extracted so the kick (one message that
// mints, cashes, pins and travels) shares it exactly. The ORDER is the A3 spec
// and the review's F1 fix: VALIDATE-THEN-PERSIST. createMapDocument is pure,
// so the recipe runs against an in-memory mint — a validation or budget
// failure persists NOTHING, and the one persisted step that can still fail
// (apply) deletes the document on the way out. No orphans, ever.
//
// The node passed in is mutated only on success, so a caller holding an
// UNPUSHED node object (the kick) pushes it whole or not at all.

import {
  applyMapDocumentCommand,
  createMapDocument,
  type AtlasNode,
  type GenerateRequest,
  type MapDocument,
  type MapDocumentCommand,
  type ServerMessage,
} from "@herobyte/shared";
import { randomUUID } from "node:crypto";
import {
  assertGenerateSeed,
  assertRecipeBudget,
  resolveRecipeContext,
} from "../../domains/generation/recipeContext.js";
import { runRecipe } from "../../domains/generation/recipes.js";
import type { RecipeOutput } from "../../domains/generation/types.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import { MAX_SESSION_DOCUMENTS } from "../../middleware/validators/sessionValidators.js";
import { mintRefusal, type MintOverflow } from "../../domains/room/sessionExport.js";

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

export interface AtlasCashDeps {
  mapStudioService: MapStudioService;
  broadcastToDMs: (roomId: string, message: ServerMessage) => void;
  now: () => number;
  /**
   * The BYTE ceiling (the Weighed Campaign plan): weigh the export the room
   * would write with `candidate` minted — the finished in-memory document,
   * recipe applied — and report the overflow, or null when it fits.
   */
  weighMint: (candidate: MapDocument) => MintOverflow | null;
}

export type CashOutcome =
  | { ok: true; documentId: string }
  | { ok: false; code: "rejected" | "at-cap"; reason: string };

/**
 * Mint a document sized by the preset, run the recipe into it, persist, and
 * record the node's map, provenance (with `size`) and arrival. `commandId`
 * doubles as the recipe's element idPrefix and the place-room dedupe key.
 */
export function cashNode(
  deps: AtlasCashDeps,
  roomId: string,
  node: AtlasNode,
  seed: number,
  request: GenerateRequest,
  commandId: string,
): CashOutcome {
  // The mint ceiling protects the EXPORT promise: a room past
  // MAX_SESSION_DOCUMENTS writes a session file its own reimport rejects.
  if (deps.mapStudioService.list(roomId).length >= MAX_SESSION_DOCUMENTS) {
    return {
      ok: false,
      code: "at-cap",
      reason: `This table already holds the maximum of ${MAX_SESSION_DOCUMENTS} map documents — delete one first.`,
    };
  }

  const { cols, rows } = GENERATE_PRESETS[request.size];
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

  // Everything pure runs against the in-memory mint FIRST — the recipe, its
  // budget, and the place-room itself, so the CANDIDATE document exists in
  // memory before anything persists and the byte ceiling can weigh it.
  let output: RecipeOutput;
  let placeRoom: MapDocumentCommand;
  let candidate: MapDocument;
  try {
    const minted = createMapDocument(documentInput);
    const ctx = resolveRecipeContext(minted, bounds, commandId);
    assertGenerateSeed(seed);
    output = runRecipe(seed, bounds, request, ctx);
    assertRecipeBudget(output);
    placeRoom = {
      type: "place-room",
      commandId,
      documentId,
      baseRevision: 0,
      cells: output.cells,
      elements: output.elements,
    };
    candidate = applyMapDocumentCommand(minted, placeRoom, timestamp).document;
  } catch (error) {
    return {
      ok: false,
      code: "rejected",
      reason: error instanceof Error ? error.message : "The recipe failed.",
    };
  }

  // The BYTE ceiling: the export this mint would write must load back in one
  // frame. Weighed on the in-memory candidate — a refusal persists nothing,
  // like every refusal above it.
  const overflow = deps.weighMint(candidate);
  if (overflow) {
    return { ok: false, code: "at-cap", reason: mintRefusal(overflow) };
  }

  // Only now does anything persist — and the one step that can still fail
  // deletes the document on the way out.
  deps.mapStudioService.create(roomId, documentInput);
  try {
    deps.mapStudioService.apply(roomId, placeRoom, timestamp);
  } catch (error) {
    deps.mapStudioService.delete(roomId, documentId);
    return {
      ok: false,
      code: "rejected",
      reason: error instanceof Error ? error.message : "Applying the generated map failed.",
    };
  }

  node.mapDocumentId = documentId;
  node.recipe = { ...request, seed };
  if (output.arrival) {
    node.arrival = structuredClone(output.arrival);
  }
  node.updatedAt = timestamp;
  deps.broadcastToDMs(roomId, {
    t: "map-studio-document",
    document: deps.mapStudioService.get(roomId, documentId),
  });
  return { ok: true, documentId };
}
