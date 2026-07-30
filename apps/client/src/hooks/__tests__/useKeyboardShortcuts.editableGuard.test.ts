// Typing-surface guard: keystrokes that originate in a text field must never
// reach the global scene shortcuts — Backspace there edits text (not the
// selected tokens) and Ctrl+Z is native text undo. Same real-hook harness as
// useKeyboardShortcuts.mapEditGuard.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from "../useKeyboardShortcuts";

const NOOP_DRAWING = { canUndo: false, canRedo: false, handleUndo: () => {}, handleRedo: () => {} };

const SNAPSHOT = {
  sceneObjects: [{ id: "token:a", locked: false }],
} as unknown as RoomSnapshot;

function baseOptions(over: Partial<UseKeyboardShortcutsOptions>): UseKeyboardShortcutsOptions {
  return {
    selectedObjectIds: ["token:a"],
    isDM: true,
    snapshot: SNAPSHOT,
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

function dispatchOn(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("useKeyboardShortcuts — typing-surface guard", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    document.body.appendChild(input);
    return () => input.remove();
  });

  it("lets Backspace edit text instead of deleting the selected objects", () => {
    const sendMessage = vi.fn();
    renderHook(() => useKeyboardShortcuts(baseOptions({ sendMessage })));
    const event = dispatchOn(input, { key: "Backspace" });
    // Untouched event: the character delete proceeds, no delete flow ran.
    expect(event.defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("still runs the delete flow when Backspace comes from outside a field", () => {
    const sendMessage = vi.fn();
    renderHook(() => useKeyboardShortcuts(baseOptions({ sendMessage })));
    const event = dispatchOn(window, { key: "Backspace" });
    // The flow engaged (preventDefault) — the stubbed confirm() then declines.
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps Ctrl+Z in a field as native text undo (no selection-undo)", () => {
    const undoSelection = vi.fn();
    renderHook(() => useKeyboardShortcuts(baseOptions({ undoSelection })));
    dispatchOn(input, { key: "z", ctrlKey: true });
    expect(undoSelection).not.toHaveBeenCalled();
  });
});
