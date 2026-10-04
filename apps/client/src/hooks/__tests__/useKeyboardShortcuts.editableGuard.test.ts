// Typing-surface guard: keystrokes that originate in a text field must never
// reach the global scene shortcuts — Backspace there edits text (not the
// selected tokens) and Ctrl+Z is native text undo. Same real-hook harness as
// useKeyboardShortcuts.mapEditGuard.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import {
  LOCKED_CANNOT_DELETE,
  LOCKED_CANNOT_DELETE_DM,
  NOT_YOURS_CANNOT_DELETE,
  PROPS_NOT_HERE,
  useKeyboardShortcuts,
  type UseKeyboardShortcutsOptions,
} from "../useKeyboardShortcuts";

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
    notify: vi.fn(),
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

// Delete on a selection that holds props: they are not deleted by the key (they have their own
// panel) and it used to say nothing. A short toast now points to the panel (U10d).
describe("useKeyboardShortcuts — Delete and props", () => {
  const PROP_SNAPSHOT = {
    sceneObjects: [
      { id: "prop:p1", locked: false, owner: "dm" },
      { id: "token:t1", locked: false, owner: "dm" },
    ],
  } as unknown as RoomSnapshot;

  it("says where props are deleted when the selection holds only props", () => {
    const notify = vi.fn();
    const sendMessage = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts(
        baseOptions({
          selectedObjectIds: ["prop:p1"],
          snapshot: PROP_SNAPSHOT,
          sendMessage,
          notify,
        }),
      ),
    );
    dispatchOn(window, { key: "Delete" });
    expect(notify).toHaveBeenCalledExactlyOnceWith(PROPS_NOT_HERE);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("says nothing when the selection holds no prop", () => {
    const notify = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() =>
      useKeyboardShortcuts(
        baseOptions({ selectedObjectIds: ["token:t1"], snapshot: PROP_SNAPSHOT, notify }),
      ),
    );
    dispatchOn(window, { key: "Delete" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("deletes the tokens of a mixed selection and still says props are elsewhere", () => {
    const notify = vi.fn();
    const sendMessage = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() =>
      useKeyboardShortcuts(
        baseOptions({
          selectedObjectIds: ["token:t1", "prop:p1"],
          snapshot: PROP_SNAPSHOT,
          sendMessage,
          notify,
        }),
      ),
    );
    dispatchOn(window, { key: "Delete" });
    expect(sendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "t1" });
    expect(notify).toHaveBeenCalledExactlyOnceWith(PROPS_NOT_HERE);
  });
});

// A selection Delete cannot act on says why through the toast; it used to open a blocking alert()
// (U10d, at the owner's word). The partial-delete "Continue?" stays a confirm().
describe("useKeyboardShortcuts — Delete that cannot proceed", () => {
  const SNAP = {
    sceneObjects: [
      { id: "token:locked", locked: true, owner: "dm" },
      { id: "token:theirs", locked: false, owner: "someone-else" },
    ],
  } as unknown as RoomSnapshot;

  it.each([
    // The toast names the next step each role really has: the DM's 🔓 Unlock in the
    // selection toolbar; a player has none (the canvas lock icon is not a button).
    ["a locked token, as the DM", "token:locked", true, LOCKED_CANNOT_DELETE_DM],
    ["a locked token, as a player", "token:locked", false, LOCKED_CANNOT_DELETE],
    ["a token someone else owns", "token:theirs", false, NOT_YOURS_CANNOT_DELETE],
  ])("says so with the toast, not an alert, for %s", (_name, id, isDM, message) => {
    const notify = vi.fn();
    const sendMessage = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderHook(() =>
      useKeyboardShortcuts(
        baseOptions({
          selectedObjectIds: [id],
          snapshot: SNAP,
          isDM,
          uid: "me",
          sendMessage,
          notify,
        }),
      ),
    );
    dispatchOn(window, { key: "Delete" });
    expect(notify).toHaveBeenCalledExactlyOnceWith(message);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
