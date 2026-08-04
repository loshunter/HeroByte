// ============================================================================
// SELECTION SERIALIZATION
// ============================================================================
// Selections live in memory as a Map (keyed by player uid) and travel the wire
// as a plain object. These two functions are that conversion, nothing more.
//
// Extracted verbatim from model.ts (2026-08-02), unchanged. They were pure
// serialization helpers with no relationship to the room model, and keeping
// them there forced recipientFilter.ts to import a VALUE from model.ts —
// which model.ts imports back, i.e. a genuine import cycle. Moving them
// breaks the cycle and buys model.ts headroom under the file-size guard.

import type { SelectionState } from "@herobyte/shared";
import type { SelectionStateMap } from "./model.js";

/**
 * Create a Map-backed selection store from a plain object snapshot
 */
export function createSelectionMap(initial?: SelectionState): SelectionStateMap {
  const map: SelectionStateMap = new Map();
  if (!initial) {
    return map;
  }

  for (const [uid, entry] of Object.entries(initial)) {
    if (!entry) {
      continue;
    }

    if (entry.mode === "single") {
      map.set(uid, { mode: "single", objectId: entry.objectId });
    } else {
      map.set(uid, { mode: "multiple", objectIds: [...entry.objectIds] });
    }
  }

  return map;
}

/**
 * Convert selection map into a serializable record for clients
 */
export function selectionMapToRecord(map: SelectionStateMap): SelectionState {
  const serialized: SelectionState = {};

  for (const [uid, entry] of map.entries()) {
    if (entry.mode === "single") {
      serialized[uid] = { mode: "single", objectId: entry.objectId };
    } else {
      serialized[uid] = { mode: "multiple", objectIds: [...entry.objectIds] };
    }
  }

  return serialized;
}
