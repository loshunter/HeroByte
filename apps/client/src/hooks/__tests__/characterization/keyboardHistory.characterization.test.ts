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

describe("production drawing history shortcut ownership", () => {
  it.each(["ctrlKey", "metaKey"] as const)("%s+Z uses drawing history before selection", (key) => {
    const { options, drawingManager } = fixture(true);
    expect(press({ key: "z", [key]: true }).defaultPrevented).toBe(true);
    expect(drawingManager.handleUndo).toHaveBeenCalledTimes(1);
    expect(drawingManager.handleRedo).not.toHaveBeenCalled();
    expect(options.undoSelection).not.toHaveBeenCalled();
    expect(options.sendMessage).not.toHaveBeenCalled();
  });

  it("empty Draw history leaves DM selection history untouched", () => {
    const { options, drawingManager } = fixture(false);
    expect(press({ key: "z", ctrlKey: true }).defaultPrevented).toBe(false);
    expect(drawingManager.handleUndo).not.toHaveBeenCalled();
    expect(drawingManager.handleRedo).not.toHaveBeenCalled();
    expect(options.undoSelection).not.toHaveBeenCalled();
    expect(options.sendMessage).not.toHaveBeenCalled();
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
