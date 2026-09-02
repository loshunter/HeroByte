// ============================================================================
// SESSION VALIDATORS (session-export, and the load-session envelope)
// ============================================================================
// Its own module because roomValidators.ts sits near the 350-LOC structural
// ceiling (same precedent as generationValidators.ts / mapStudioLiveValidators.ts).
//
// Covers BOTH halves of load-session: the SessionFile envelope, and the
// snapshot's per-collection limits (moved here from roomValidators.ts, which
// crossed the ceiling when chatLog was added to SNAPSHOT_LIMITS).

import { z } from "zod";
import type { SceneState } from "@herobyte/shared";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";
import { isRecord } from "./commonValidators.js";
import { importDocument } from "./mapStudioValidators.js";

/**
 * A session file may legitimately carry every map in the room. EXPORTED
 * because it is also the mint ceiling: no path that creates documents
 * (map-studio-create, map-studio-import, atlas-generate-node — and the
 * load-session upsert, via `documentsPastCap`) may take a room past it, or
 * the DM's own export stops being re-importable — the cap tests pin the
 * refusal on every path against this constant.
 */
export const MAX_SESSION_DOCUMENTS = 64;

/**
 * How many documents a load would leave the room with, or 0 when it fits:
 * the file's documents UPSERT into whatever the room already holds, so a
 * disjoint backup loaded onto a busy table can cross the ceiling in one click.
 */
export function documentsPastCap(
  existingIds: Iterable<string>,
  incoming: { id: string }[],
): number {
  const ids = new Set(existingIds);
  for (const document of incoming) ids.add(document.id);
  return ids.size > MAX_SESSION_DOCUMENTS ? ids.size : 0;
}

/**
 * The SAME schema map-studio-import uses — deliberately, not incidentally.
 *
 * This was briefly `z.object({ id }).passthrough()`, on the reasoning that
 * importMapDocument sanitizes each document anyway so a loose shape "fails
 * safe". It does not: sanitization is exactly where the cost is paid. A ~30-byte
 * chunk `{"0,0":[999999999,1]}` reaches decodeTerrainChunk, which pushes `count`
 * entries BEFORE checking the length — allocating ~1e9 slots to arrive at a
 * rejection. On a 512MB Render instance that is a heap OOM, which aborts the
 * process rather than throwing, so restoreMapDocuments' try/catch cannot contain
 * it, and one process serves every room. The import path already caps runs at
 * 512; a second door onto the same sanitizer must not have a weaker lock.
 */
const mapDocuments = z
  .array(importDocument)
  .max(MAX_SESSION_DOCUMENTS, { message: `exceeds ${MAX_SESSION_DOCUMENTS} map documents` });

/**
 * Per-collection entry caps for loaded session snapshots.
 *
 * EVERY collection SnapshotLoader writes into room state must appear here —
 * the loop below is the only check that a restored collection is even an
 * array of objects, so a key missing from this table reaches state entirely
 * unvalidated. chatLog was missing for one commit, and `chatLog: {}` then hit
 * visibleChatFor's `.filter` inside the debounced broadcast timer (outside
 * route()'s try/catch), killing the one process that serves every room.
 *
 * ⚠️ `characters` HAS A SECOND CONSUMER, and it is not on the load path.
 * NPCMessageHandler.handleCreateNPC reads it as the room's LIVE creation
 * ceiling, so this number now answers two different questions: what a session
 * file may contain, and how many characters a DM may ever make. They agree on
 * purpose — a room allowed to grow past what a snapshot may hold produces a
 * save that fails its own load validation, so the DM's backup silently stops
 * being a backup — but the coupling is invisible from either end. Raising this
 * to tolerate a big imported session also raises the creation cap; lowering it
 * to be stricter starts refusing NPC creation in rooms that already exist.
 * `sessionValidators.test.ts` pins them together; change it deliberately.
 *
 * (Declared ABOVE the envelope schemas because sceneState reads it at module
 * load — a later `const` would be a temporal-dead-zone crash on import.)
 */
export const SNAPSHOT_LIMITS = {
  players: 100,
  tokens: 1000,
  drawings: 5000,
  props: 500,
  characters: 500,
  diceRolls: 1000,
  sceneObjects: 5000,
  chatLog: 200,
  // The campaign graph (ATLAS_LIMITS mirrors these numbers — its test pins
  // them together). sceneStates are deliberately ABSENT: they never ride a
  // RoomSnapshot; the envelope schema below is their gate.
  atlasNodes: 64,
  atlasLinks: 256,
} as const;

/**
 * A suspended scene from the file's ENVELOPE (sceneStates never ride the
 * snapshot half — plan §3's single-carriage rule). Shallow on purpose, the
 * SNAPSHOT_LIMITS depth: each collection is bounded and entries must be
 * objects; the deep shapes are tolerated the way every loaded collection is.
 * NOT `.strict()` so a newer server's extra fields load here.
 */
const entryRecord = z.record(z.unknown());
const sceneState = z.object({
  mapDocumentId: z.string().trim().min(1).max(128),
  suspendedAt: z.number(),
  tokens: z.array(entryRecord).max(SNAPSHOT_LIMITS.tokens),
  props: z.array(entryRecord).max(SNAPSHOT_LIMITS.props),
  drawings: z.array(entryRecord).max(SNAPSHOT_LIMITS.drawings),
  sceneObjects: z.array(entryRecord).max(SNAPSHOT_LIMITS.sceneObjects),
  characterLinks: z.record(z.string().max(128)),
  doorStates: z.record(entryRecord),
  combatActive: z.boolean(),
  currentTurnCharacterId: z.string().max(128).optional(),
  initiatives: z.record(entryRecord),
  fogEnabled: z.boolean(),
  defaultVisionRadius: z.number().nullable(),
  playerStagingZone: entryRecord.optional(),
  mapBackground: z
    .string()
    .max(10 * 1024 * 1024)
    .optional(),
});

const envelopeSchema = z.object({
  mapDocuments: mapDocuments.optional(),
  liveMapDocumentId: z.string().trim().min(1).max(128).optional(),
  // One scene per document, so the document ceiling is also the scene ceiling.
  sceneStates: z.array(sceneState).max(MAX_SESSION_DOCUMENTS).optional(),
});

/**
 * The ONE scene sanitizer, for the two doors that are not the load-session
 * message: the DISK/Redis boundary (normalizeAtlasState) and the export
 * filter. Both used weaker locks — a record check, a mapDocumentId check —
 * and a half-shaped scene walked through either would throw inside travel
 * (mid-mutation) or write a file the DM's own reimport rejects. Returns the
 * ORIGINAL object on success: z.object strips unknown keys, and a newer
 * server's extra fields must survive a round trip through an older one.
 */
export function parseSceneState(value: unknown): SceneState | null {
  return sceneState.safeParse(value).success ? (value as SceneState) : null;
}

/**
 * Validate the map-document half of a load-session message. Both fields are
 * optional: a legacy save file is a bare snapshot with neither, and must still
 * load (it just restores a map that cannot be edited afterwards).
 */
export function validateLoadSessionEnvelope(message: MessageRecord): ValidationResult {
  const result = envelopeSchema.safeParse(message);
  if (result.success) {
    return { valid: true };
  }
  const issue = result.error.issues[0];
  const path = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return {
    valid: false,
    error: `load-session: invalid session file${path}: ${issue?.message ?? "unknown"}`,
  };
}

/** session-export carries no payload; the DM check is the handler's job. */
export function validateSessionExportMessage(_message: MessageRecord): ValidationResult {
  return { valid: true };
}

/**
 * Validate load-session message
 * Required: snapshot (object with players, tokens, drawings arrays)
 *
 * Snapshot collections are merged into live room state, so each collection is
 * bounded and every entry must at least be an object (not a primitive).
 */
export function validateLoadSessionMessage(message: MessageRecord): ValidationResult {
  const snapshot = message.snapshot;
  if (!isRecord(snapshot)) {
    return { valid: false, error: "load-session: missing or invalid snapshot data" };
  }
  const hasPlayers = Array.isArray(snapshot.players);
  const hasTokens = Array.isArray(snapshot.tokens);
  const hasDrawingArray = Array.isArray(snapshot.drawings);
  const assetRefs = isRecord(snapshot.assetRefs) ? snapshot.assetRefs : undefined;
  const hasDrawingAsset = assetRefs && typeof assetRefs.drawings === "string";

  if (!hasPlayers || !hasTokens || (!hasDrawingArray && !hasDrawingAsset)) {
    return {
      valid: false,
      error:
        "load-session: snapshot must contain players, tokens, and drawings (array or assetRef)",
    };
  }

  for (const [key, limit] of Object.entries(SNAPSHOT_LIMITS)) {
    const collection = snapshot[key];
    if (collection === undefined) {
      continue;
    }
    if (!Array.isArray(collection)) {
      return { valid: false, error: `load-session: snapshot ${key} must be an array` };
    }
    if (collection.length > limit) {
      return {
        valid: false,
        error: `load-session: snapshot ${key} exceeds limit (max ${limit} entries)`,
      };
    }
    if (!collection.every((entry) => isRecord(entry))) {
      return {
        valid: false,
        error: `load-session: snapshot ${key} entries must be objects`,
      };
    }
  }
  return { valid: true };
}
