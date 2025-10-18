// ============================================================================
// OBJECT SELECTION HOOK
// ============================================================================
// Synchronizes local selection state with the server-backed selection map.
// Provides optimistic updates so UI reacts immediately while the authoritative
// state propagates over the WebSocket snapshot stream.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientMessage, RoomSnapshot, SelectionMode, SelectionStateEntry } from "@shared";

interface UseObjectSelectionOptions {
  uid: string;
  snapshot: RoomSnapshot | null;
  sendMessage: (msg: ClientMessage) => void;
}

interface UseObjectSelectionResult {
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  isSelected: (objectId: string) => boolean;
  selectObject: (objectId: string | null) => void;
  selectMultiple: (objectIds: string[], mode?: SelectionMode) => void;
  deselect: () => void;
  lockSelected: () => void;
  unlockSelected: () => void;
}

const MAX_SELECTION = 100;

function normalizeIds(ids: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
    if (normalized.length >= MAX_SELECTION) {
      break;
    }
  }

  return normalized;
}

function toSelectionEntry(ids: string[]): SelectionStateEntry | null {
  if (ids.length === 0) {
    return null;
  }
  if (ids.length === 1) {
    return { mode: "single", objectId: ids[0]! };
  }
  return { mode: "multiple", objectIds: [...ids] };
}

function entryToIds(entry: SelectionStateEntry | null | undefined): string[] {
  if (!entry) {
    return [];
  }
  return entry.mode === "single" ? [entry.objectId] : entry.objectIds;
}

export function useObjectSelection({
  uid,
  snapshot,
  sendMessage,
}: UseObjectSelectionOptions): UseObjectSelectionResult {
  const serverEntry = snapshot?.selectionState?.[uid] ?? null;
  const [optimisticEntry, setOptimisticEntry] = useState<SelectionStateEntry | null>(null);

  // Clear optimistic state once the authoritative snapshot catches up
  useEffect(() => {
    setOptimisticEntry(null);
  }, [serverEntry]);

  const activeEntry = optimisticEntry ?? serverEntry;
  const selectedObjectIds = useMemo(() => entryToIds(activeEntry), [activeEntry]);
  const selectedObjectId = useMemo(() => {
    if (!activeEntry) {
      return null;
    }
    if (activeEntry.mode === "single") {
      return activeEntry.objectId;
    }
    return activeEntry.objectIds[activeEntry.objectIds.length - 1] ?? null;
  }, [activeEntry]);

  const selectObject = useCallback(
    (objectId: string | null) => {
      if (!objectId) {
        if (!activeEntry) {
          return;
        }
        setOptimisticEntry(null);
        sendMessage({ t: "deselect-object", uid });
        return;
      }

      if (activeEntry?.mode === "single" && activeEntry.objectId === objectId) {
        return;
      }

      setOptimisticEntry({ mode: "single", objectId });
      sendMessage({ t: "select-object", uid, objectId });
    },
    [activeEntry, sendMessage, uid],
  );

  const deselect = useCallback(() => {
    if (!activeEntry) {
      return;
    }
    setOptimisticEntry(null);
    sendMessage({ t: "deselect-object", uid });
  }, [activeEntry, sendMessage, uid]);

  const selectMultiple = useCallback(
    (objectIds: string[], mode: SelectionMode = "replace") => {
      const currentIds = entryToIds(activeEntry);
      const normalizedIncoming = normalizeIds(objectIds);

      let nextIds: string[];
      switch (mode) {
        case "append": {
          nextIds = normalizeIds([...currentIds, ...normalizedIncoming]);
          break;
        }

        case "subtract": {
          if (currentIds.length === 0) {
            return;
          }
          const removal = new Set(normalizedIncoming);
          nextIds = currentIds.filter((id) => !removal.has(id));
          break;
        }

        case "replace":
        default: {
          nextIds = normalizedIncoming;
          break;
        }
      }

      const unchanged =
        currentIds.length === nextIds.length &&
        currentIds.every((value, index) => value === nextIds[index]);
      if (unchanged) {
        return;
      }

      if (nextIds.length === 0) {
        setOptimisticEntry(null);
        if (mode === "replace") {
          sendMessage({ t: "deselect-object", uid });
        } else {
          sendMessage({ t: "select-multiple", uid, objectIds: normalizedIncoming, mode });
        }
        return;
      }

      setOptimisticEntry(toSelectionEntry(nextIds));
      if (mode === "replace" && nextIds.length === 1) {
        sendMessage({ t: "select-object", uid, objectId: nextIds[0]! });
      } else {
        sendMessage({ t: "select-multiple", uid, objectIds: normalizedIncoming, mode });
      }
    },
    [activeEntry, sendMessage, uid],
  );

  const isSelected = useCallback(
    (objectId: string) => selectedObjectIds.includes(objectId),
    [selectedObjectIds],
  );

  const lockSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) {
      return;
    }
    sendMessage({ t: "lock-selected", uid, objectIds: selectedObjectIds });
  }, [selectedObjectIds, sendMessage, uid]);

  const unlockSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) {
      return;
    }
    sendMessage({ t: "unlock-selected", uid, objectIds: selectedObjectIds });
  }, [selectedObjectIds, sendMessage, uid]);

  return {
    selectedObjectId,
    selectedObjectIds,
    isSelected,
    selectObject,
    selectMultiple,
    deselect,
    lockSelected,
    unlockSelected,
  };
}

export type UseObjectSelectionHook = ReturnType<typeof useObjectSelection>;
