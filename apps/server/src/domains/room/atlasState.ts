// ============================================================================
// ATLAS STATE — load-path normalization for the campaign-graph fields
// ============================================================================
// ONE helper shared by every path that rebuilds RoomState from untrusted or
// aged JSON: StatePersistence.loadFromDisk, RedisRoomStore.hydrate, and
// SnapshotLoader.mergeSnapshot. `?? []` is the exact poisoned-non-array
// anti-pattern StatePersistence documents ({} is truthy AND non-nullish), and
// these arrays are walked inside the DEBOUNCED broadcast timer — outside
// route()'s try/catch, in a process with no uncaughtException handler — so a
// poisoned value kills the one process serving every room, on every restart.

import type { AtlasNode, MapLink, SceneState } from "@herobyte/shared";
import { parseSceneState } from "../../middleware/validators/sessionValidators.js";

export interface AtlasStateFields {
  atlasNodes: AtlasNode[];
  atlasLinks: MapLink[];
  sceneStates: Record<string, SceneState>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => isRecord(entry)) as T[];
}

/**
 * `anchor` is the ONE inner field the broadcast path dereferences
 * (`projectAtlasFor` builds `{ x: link.anchor.x, … }` for players), so
 * record-level filtering alone left an anchor-less link as a TypeError inside
 * the debounced broadcast timer — persisted, that is a crash on every restart.
 * Node fields need no such pass: strict `=== true` checks and Set lookups
 * tolerate any poison.
 */
function hasFiniteAnchor(link: MapLink): boolean {
  const anchor = (link as { anchor?: unknown }).anchor;
  return (
    isRecord(anchor) &&
    Number.isFinite((anchor as { x?: unknown }).x) &&
    Number.isFinite((anchor as { y?: unknown }).y)
  );
}

/**
 * File-authoritative and poison-proof: absent keys become empties (NEVER the
 * room's current values — the mergeSnapshot mapElements lesson), and any
 * non-array/non-record shape a hand-edited file smuggled in is dropped rather
 * than walked.
 */
export function normalizeAtlasState(data: {
  atlasNodes?: unknown;
  atlasLinks?: unknown;
  sceneStates?: unknown;
}): AtlasStateFields {
  // Scenes take the SAME schema the load-session envelope enforces: travel
  // dereferences deep inside a scene (saved.tokens.filter, saved.doorStates[id])
  // AFTER the outgoing capture and the destination compile have landed, so a
  // record-shallow scene that walked in here threw mid-mutation and persisted a
  // half-traveled room with an untravelable destination.
  const sceneStates: Record<string, SceneState> = {};
  if (isRecord(data.sceneStates)) {
    for (const [key, value] of Object.entries(data.sceneStates)) {
      const scene = parseSceneState(value);
      if (scene) {
        sceneStates[key] = scene;
      } else if (isRecord(value)) {
        console.warn(`normalizeAtlasState: dropped a malformed suspended scene under ${key}`);
      }
    }
  }
  return {
    atlasNodes: recordArray<AtlasNode>(data.atlasNodes),
    atlasLinks: recordArray<MapLink>(data.atlasLinks).filter(hasFiniteAnchor),
    sceneStates,
  };
}

/**
 * Rebuild the sceneStates record from a session file's ENVELOPE array,
 * dropping any scene whose document was not actually restored — an orphan
 * scene is not inert, it would resurrect stale content the first time a
 * later document reuses the id.
 */
export function sceneStatesFromEnvelope(
  sceneStates: SceneState[] | undefined,
  hasDocument: (documentId: string) => boolean,
): Record<string, SceneState> {
  const result: Record<string, SceneState> = {};
  for (const scene of sceneStates ?? []) {
    const documentId = typeof scene?.mapDocumentId === "string" ? scene.mapDocumentId : "";
    if (!documentId) continue;
    if (!hasDocument(documentId)) {
      console.warn(`load-session: dropped suspended scene for missing document ${documentId}`);
      continue;
    }
    result[documentId] = scene;
  }
  return result;
}
