import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectCapabilities, frame, mountManager } from "./drawingHistoryManager.fixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Clear All retains its DM confirmation and server history authority", () => {
  it("confirmed DM clear sends once and waits for the snapshot before disabling history", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const manager = mountManager(frame({ canUndo: true, canRedo: true }), true);
    act(() => manager.result.current.handleClearDrawings());
    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      "Clear all drawings from the map? Locked drawings stay. This cannot be undone.",
    );
    expect(manager.sendMessage.mock.calls).toEqual([[{ t: "clear-drawings" }]]);
    expectCapabilities(manager.result.current, true, true);
    manager.incoming(frame({ canUndo: false, canRedo: false }, [], 2));
    expectCapabilities(manager.result.current, false, false);
  });

  it("declining the existing confirmation sends nothing and preserves confirmed undo/redo", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const manager = mountManager(frame({ canUndo: true, canRedo: true }), true);
    act(() => manager.result.current.toolbarProps.onClearAll());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(manager.sendMessage).not.toHaveBeenCalled();
    expectCapabilities(manager.result.current, true, true);
  });

  it.each([false, undefined])(
    "clear permission %s has no prompt or outgoing command",
    (permission) => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const manager = mountManager(frame({ canUndo: true, canRedo: true }), permission);
      act(() => manager.result.current.handleClearDrawings());
      expect(confirm).not.toHaveBeenCalled();
      expect(manager.sendMessage).not.toHaveBeenCalled();
      expectCapabilities(manager.result.current, true, true);
      expect(manager.result.current.toolbarProps.canClearAll).toBe(false);
    },
  );

  it("another DM's clear snapshot disables this player's history without a local clear call", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: true }), false);
    manager.incoming(frame({ canUndo: false, canRedo: false }, [], 2));
    expectCapabilities(manager.result.current, false, false);
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.handleRedo();
    });
    expect(manager.sendMessage).not.toHaveBeenCalled();
  });
});
