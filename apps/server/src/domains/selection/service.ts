// ============================================================================
// SELECTION DOMAIN - SERVICE
// ============================================================================
// Manages object selection state for connected clients

import type { SelectionMode, SelectionStateEntry } from "@shared";
import type { RoomState } from "../room/model.js";

const MAX_SELECTION = 100;

function normalizeIds(ids: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (unique.length >= MAX_SELECTION) {
      break;
    }
  }

  return unique;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

export class SelectionService {
  selectObject(state: RoomState, uid: string, objectId: string): boolean {
    return this.applySelection(state, uid, [objectId]);
  }

  private releaseConflictingSelections(state: RoomState, uid: string, ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);
    const updates: Array<[string, SelectionStateEntry | null]> = [];
    for (const [otherUid, entry] of state.selectionState.entries()) {
      if (otherUid === uid) {
        continue;
      }

      if (entry.mode === "single") {
        if (idSet.has(entry.objectId)) {
          updates.push([otherUid, null]);
        }
        continue;
      }

      const filtered = entry.objectIds.filter((objectId) => !idSet.has(objectId));
      if (filtered.length === entry.objectIds.length) {
        continue;
      }

      if (filtered.length === 0) {
        updates.push([otherUid, null]);
      } else if (filtered.length === 1) {
        updates.push([otherUid, { mode: "single", objectId: filtered[0] }]);
      } else {
        updates.push([otherUid, { mode: "multiple", objectIds: filtered }]);
      }
    }

    for (const [targetUid, entry] of updates) {
      if (entry) {
        state.selectionState.set(targetUid, entry);
      } else {
        state.selectionState.delete(targetUid);
      }
    }
  }

  selectMultiple(
    state: RoomState,
    uid: string,
    objectIds: string[],
    mode: SelectionMode = "replace",
  ): boolean {
    const current = state.selectionState.get(uid);
    const normalized = normalizeIds(objectIds);

    switch (mode) {
      case "append": {
        const base = this.currentAsList(current);
        const appended = normalizeIds([...base, ...normalized]);
        return this.applySelection(state, uid, appended);
      }

      case "subtract": {
        if (!current) {
          return false;
        }
        const base = this.currentAsList(current);
        if (base.length === 0) {
          return false;
        }
        const removal = new Set(normalized);
        const remaining = base.filter((id) => !removal.has(id));
        return this.applySelection(state, uid, remaining);
      }

      case "replace":
      default: {
        return this.applySelection(state, uid, normalized);
      }
    }
  }

  deselect(state: RoomState, uid: string): boolean {
    return this.applySelection(state, uid, []);
  }

  removeObject(state: RoomState, objectId: string): boolean {
    let changed = false;
    const entries = Array.from(state.selectionState.entries());

    for (const [uid, entry] of entries) {
      if (entry.mode === "single") {
        if (entry.objectId === objectId) {
          state.selectionState.delete(uid);
          changed = true;
        }
        continue;
      }

      const filtered = entry.objectIds.filter((id) => id !== objectId);
      if (!arraysEqual(filtered, entry.objectIds)) {
        changed = this.applySelection(state, uid, filtered) || changed;
      }
    }

    return changed;
  }

  private currentAsList(entry: SelectionStateEntry | undefined): string[] {
    if (!entry) {
      return [];
    }
    return entry.mode === "multiple" ? [...entry.objectIds] : [entry.objectId];
  }

  private applySelection(state: RoomState, uid: string, ids: string[]): boolean {
    const cleaned = normalizeIds(ids);
    const current = state.selectionState.get(uid);

    if (cleaned.length === 0) {
      if (current) {
        state.selectionState.delete(uid);
        return true;
      }
      return false;
    }

    if (cleaned.length === 1) {
      if (current?.mode === "single" && current.objectId === cleaned[0]) {
        return false;
      }
      this.releaseConflictingSelections(state, uid, cleaned);
      state.selectionState.set(uid, { mode: "single", objectId: cleaned[0] });
      return true;
    }

    if (current?.mode === "multiple" && arraysEqual(current.objectIds, cleaned)) {
      return false;
    }

    this.releaseConflictingSelections(state, uid, cleaned);
    state.selectionState.set(uid, { mode: "multiple", objectIds: cleaned });
    return true;
  }
}
