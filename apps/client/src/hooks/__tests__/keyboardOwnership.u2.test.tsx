import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useToolMode } from "../useToolMode";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";
import { useMapEditHotkeys } from "../../features/map-edit/useMapEditHotkeys";
import { escapeRegistry } from "../../features/interaction/useEscapeOwner";

afterEach(cleanup);

function key(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function drawingHistory() {
  const handleUndo = vi.fn();
  const handleRedo = vi.fn();
  const undoSelection = vi.fn();
  renderHook(() =>
    useKeyboardShortcuts({
      selectedObjectIds: [],
      isDM: true,
      snapshot: null,
      uid: "owner",
      sendMessage: vi.fn(),
      clearSelection: vi.fn(),
      drawMode: true,
      drawingManager: { canUndo: true, canRedo: true, handleUndo, handleRedo },
      canUndoSelection: true,
      undoSelection,
      notify: vi.fn(),
    }),
  );
  return { undo: handleUndo, redo: handleRedo, undoSelection };
}

function mapHistory() {
  const undo = vi.fn();
  const redo = vi.fn();
  renderHook(() =>
    useMapEditHotkeys({ mapEditMode: true, canUndo: true, canRedo: true, undo, redo }),
  );
  return { undo, redo };
}

describe("actual history owners respect foreground and native input", () => {
  it.each([drawingHistory, mapHistory])(
    "blocks hidden history from a foreground button (%#)",
    (mount) => {
      const history = mount();
      const frame = document.createElement("div");
      const button = document.createElement("button");
      frame.append(button);
      document.body.append(frame);
      const root = { node: () => frame, band: () => 1000 };
      const release = escapeRegistry.observeFrame(() => root);
      try {
        button.focus();
        key(button, { key: "z", ctrlKey: true });
        key(button, { key: "y", ctrlKey: true });
        expect(history.undo).not.toHaveBeenCalled();
        expect(history.redo).not.toHaveBeenCalled();
        release();
        key(document.body, { key: "z", ctrlKey: true });
        key(document.body, { key: "z", shiftKey: true, metaKey: true });
        expect(history.undo).toHaveBeenCalledTimes(1);
        expect(history.redo).toHaveBeenCalledTimes(1);
      } finally {
        release();
        frame.remove();
      }
    },
  );

  it.each([drawingHistory, mapHistory])(
    "keeps native/IME/prior prevention before actual history (%#)",
    (mount) => {
      const history = mount();
      const input = document.createElement("input");
      const select = document.createElement("select");
      document.body.append(input, select);
      const prevent = (event: KeyboardEvent) => event.preventDefault();
      try {
        key(input, { key: "z", ctrlKey: true });
        key(select, { key: "y", ctrlKey: true });
        key(document.body, { key: "z", ctrlKey: true, isComposing: true });
        key(document.body, { key: "z", ctrlKey: true, keyCode: 229 });
        document.addEventListener("keydown", prevent);
        key(document.body, { key: "z", ctrlKey: true });
        document.removeEventListener("keydown", prevent);
        expect(history.undo).not.toHaveBeenCalled();
        expect(history.redo).not.toHaveBeenCalled();
        key(document.body, { key: "z", ctrlKey: true });
        expect(history.undo).toHaveBeenCalledTimes(1);
      } finally {
        document.removeEventListener("keydown", prevent);
        input.remove();
        select.remove();
      }
    },
  );
});

describe("real tool setter and native Escape", () => {
  it("consumes one tool step, but leaves SELECT, IME and prevented Escape alone", () => {
    const { result } = renderHook(() => useToolMode());
    act(() => result.current.setActiveTool("draw"));
    const select = document.createElement("select");
    document.body.append(select);
    const prevent = (event: KeyboardEvent) => event.preventDefault();
    try {
      key(select, { key: "Escape" });
      key(document.body, { key: "Escape", isComposing: true });
      key(document.body, { key: "Escape", keyCode: 229 });
      document.addEventListener("keydown", prevent);
      key(document.body, { key: "Escape" });
      document.removeEventListener("keydown", prevent);
      act(() =>
        document.body.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })),
      );
      key(document.body, { key: "Escape" });
      expect(result.current.activeTool).toBe("draw");
      act(() =>
        document.body.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })),
      );
      expect(key(document.body, { key: "Escape" }).defaultPrevented).toBe(true);
      expect(result.current.activeTool).toBeNull();
    } finally {
      document.removeEventListener("keydown", prevent);
      select.remove();
    }
  });

  it("retains a repeated mode choice and ignores nested tool changes while cancelling for a new choice", () => {
    const { result } = renderHook(() => useToolMode());
    act(() => result.current.setActiveTool("atlas-link"));
    let pending = true;
    const cancel = vi.fn(() => {
      pending = false;
      result.current.setActiveTool(null);
    });
    const release = escapeRegistry.register(() => ({
      kind: "gesture",
      name: "one-shot contract",
      order: 10,
      active: pending,
      handle: cancel,
    }));
    try {
      act(() => result.current.setActiveTool("atlas-link"));
      expect(cancel).not.toHaveBeenCalled();
      act(() => result.current.setActiveTool("draw"));
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(result.current.activeTool).toBe("draw");
      expect(pending).toBe(false);
    } finally {
      release();
    }
  });
});
