// U2 baseline at 44c6ab82, before changing history shortcut ownership.
// Real hook baseline before repairing empty Draw history's selection fallthrough.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from "../../useKeyboardShortcuts";

afterEach(cleanup);

function fixture(canUndo: boolean, canRedo = false) {
  const drawingManager = {
    canUndo,
    canRedo,
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
  };
  const options: UseKeyboardShortcutsOptions = {
    selectedObjectIds: [],
    isDM: true,
    snapshot: null,
    uid: "history-owner",
    sendMessage: vi.fn(),
    clearSelection: vi.fn(),
    drawMode: true,
    drawingManager,
    undoSelection: vi.fn(),
    canUndoSelection: true,
  };
  renderHook(() => useKeyboardShortcuts(options));
  return { options, drawingManager };
}

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe("production drawing history shortcut baseline", () => {
  it.each(["ctrlKey", "metaKey"] as const)("%s+Z uses drawing history before selection", (key) => {
    const { options, drawingManager } = fixture(true);
    expect(press({ key: "z", [key]: true }).defaultPrevented).toBe(true);
    expect(drawingManager.handleUndo).toHaveBeenCalledTimes(1);
    expect(drawingManager.handleRedo).not.toHaveBeenCalled();
    expect(options.undoSelection).not.toHaveBeenCalled();
    expect(options.sendMessage).not.toHaveBeenCalled();
  });

  it("BASELINE BUG: empty Draw history falls through to DM selection undo", () => {
    const { options, drawingManager } = fixture(false);
    expect(press({ key: "z", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(drawingManager.handleUndo).not.toHaveBeenCalled();
    expect(options.undoSelection).toHaveBeenCalledTimes(1);
  });

  it.each([
    { key: "y", ctrlKey: true },
    { key: "Z", metaKey: true, shiftKey: true },
  ])("redo uses the drawing callback for %j", (keys) => {
    const { options, drawingManager } = fixture(false, true);
    expect(press(keys).defaultPrevented).toBe(true);
    expect(drawingManager.handleRedo).toHaveBeenCalledTimes(1);
    expect(drawingManager.handleUndo).not.toHaveBeenCalled();
    expect(options.undoSelection).not.toHaveBeenCalled();
    expect(options.sendMessage).not.toHaveBeenCalled();
  });
});
