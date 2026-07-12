import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapEditHotkeys } from "../useMapEditHotkeys";

function press(init: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { ...init, cancelable: true }));
  });
}

describe("useMapEditHotkeys", () => {
  let undo: ReturnType<typeof vi.fn>;
  let redo: ReturnType<typeof vi.fn>;

  const setup = (overrides: Partial<Parameters<typeof useMapEditHotkeys>[0]> = {}) =>
    renderHook((props: Parameters<typeof useMapEditHotkeys>[0]) => useMapEditHotkeys(props), {
      initialProps: {
        mapEditMode: true,
        canUndo: true,
        canRedo: true,
        undo,
        redo,
        ...overrides,
      },
    });

  beforeEach(() => {
    undo = vi.fn();
    redo = vi.fn();
  });

  it("undoes on Ctrl+Z (exactly once, no redo)", () => {
    setup();
    press({ key: "z", ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
  });

  it("undoes on Cmd+Z (Mac)", () => {
    setup();
    press({ key: "z", metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("redoes on Ctrl+Y and Ctrl+Shift+Z (never undoes)", () => {
    setup();
    press({ key: "y", ctrlKey: true });
    press({ key: "Z", ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(2);
    expect(undo).not.toHaveBeenCalled();
  });

  it("does nothing when map-edit mode is off (listener not registered)", () => {
    setup({ mapEditMode: false });
    press({ key: "z", ctrlKey: true });
    press({ key: "y", ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it("leaves the keystroke untouched when history is empty (no no-op command)", () => {
    setup({ canUndo: false, canRedo: false });
    const zEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true });
    const prevent = vi.spyOn(zEvent, "preventDefault");
    act(() => window.dispatchEvent(zEvent));
    expect(undo).not.toHaveBeenCalled();
    expect(prevent).not.toHaveBeenCalled(); // falls through to other handlers
  });

  it("ignores plain z / z with no modifier", () => {
    setup();
    press({ key: "z" });
    expect(undo).not.toHaveBeenCalled();
  });

  it("removes the window listener on unmount", () => {
    const { unmount } = setup();
    unmount();
    press({ key: "z", ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
  });
});
