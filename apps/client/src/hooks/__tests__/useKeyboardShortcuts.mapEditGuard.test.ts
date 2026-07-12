// Double-fire guard: while live map-edit mode is active, Ctrl+Z must NOT run the
// DM selection-undo branch (the map document owns undo via useMapEditHotkeys).
// Exercises the REAL useKeyboardShortcuts hook + its window listener — not the
// inline characterization mock in useKeyboardShortcuts.test.ts (which predates
// the selection-undo branch and never covered it).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from "../useKeyboardShortcuts";

const NOOP_DRAWING = { canUndo: false, canRedo: false, handleUndo: () => {}, handleRedo: () => {} };

function baseOptions(over: Partial<UseKeyboardShortcutsOptions>): UseKeyboardShortcutsOptions {
  return {
    selectedObjectIds: [],
    isDM: true,
    snapshot: null as RoomSnapshot | null,
    uid: "dm",
    sendMessage: vi.fn(),
    clearSelection: vi.fn(),
    drawMode: false,
    drawingManager: NOOP_DRAWING,
    undoSelection: vi.fn(),
    canUndoSelection: true,
    ...over,
  };
}

function pressCtrlZ() {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true }),
    );
  });
}

describe("useKeyboardShortcuts — map-edit double-fire guard", () => {
  let undoSelection: ReturnType<typeof vi.fn>;
  let handleUndo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    undoSelection = vi.fn();
    handleUndo = vi.fn();
  });

  it("skips DM selection-undo (and drawing-undo) when map-edit is active", () => {
    renderHook(() =>
      useKeyboardShortcuts(
        baseOptions({
          mapEditMode: true,
          undoSelection,
          drawingManager: { ...NOOP_DRAWING, handleUndo },
        }),
      ),
    );
    pressCtrlZ();
    expect(undoSelection).not.toHaveBeenCalled();
    expect(handleUndo).not.toHaveBeenCalled();
  });

  it("still runs DM selection-undo when NOT in map-edit mode (no regression)", () => {
    renderHook(() => useKeyboardShortcuts(baseOptions({ mapEditMode: false, undoSelection })));
    pressCtrlZ();
    expect(undoSelection).toHaveBeenCalledTimes(1);
  });

  it("treats an absent mapEditMode as off (selection-undo runs)", () => {
    renderHook(() => useKeyboardShortcuts(baseOptions({ undoSelection })));
    pressCtrlZ();
    expect(undoSelection).toHaveBeenCalledTimes(1);
  });
});
