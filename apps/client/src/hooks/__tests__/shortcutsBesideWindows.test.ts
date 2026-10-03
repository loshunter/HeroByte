// Map shortcuts beside an open floating window. U2 routed Delete, Ctrl+Z/Y
// (selection and drawing undo) and the DM's G through the shortcut owner, which
// refuses every key while any window is in front — so with Chat & Rolls open, a
// selected token could not be deleted and a stroke could not be undone, though
// `main` allowed both. The map-edit hotkeys were repaired by `4e63230d`
// (`useMapEditHotkeys.focus.test.ts`); these are the same rule for the rest:
// the focused map keeps its keys beside an opted-in desktop floating panel, and
// nothing else changes (a modal, a popover, a text field or a phone screen in
// front still own the key).

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { escapeRegistry } from "../../features/interaction/useEscapeOwner";
import { layerAt, rootAt } from "../../features/interaction/__tests__/ownershipFixtures";
import { useKickedInDoor } from "../../features/atlas/useKickedInDoor";
import { useKeyboardNavigation } from "../useKeyboardNavigation";
import { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from "../useKeyboardShortcuts";

const releases: (() => void)[] = [];
let map: HTMLDivElement;

function openChatWindow() {
  const chat = layerAt("panel", 50, "chat");
  chat.owner.allowFocusedCanvasHistory = true;
  releases.push(escapeRegistry.register(chat.read));
}

function press(target: HTMLElement, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  map = document.createElement("div");
  map.dataset.mapHistorySurface = "true";
  map.tabIndex = -1;
  document.body.append(map);
  openChatWindow();
  map.focus();
});

afterEach(() => {
  cleanup();
  releases
    .splice(0)
    .reverse()
    .forEach((release) => release());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function shortcuts(over: Partial<UseKeyboardShortcutsOptions> = {}) {
  const options: UseKeyboardShortcutsOptions = {
    selectedObjectIds: ["token:a"],
    isDM: true,
    snapshot: { sceneObjects: [{ id: "token:a", locked: false }] } as unknown as RoomSnapshot,
    uid: "dm",
    sendMessage: vi.fn(),
    clearSelection: vi.fn(),
    drawMode: false,
    drawingManager: { canUndo: false, canRedo: false, handleUndo: vi.fn(), handleRedo: vi.fn() },
    undoSelection: vi.fn(),
    canUndoSelection: true,
    notify: vi.fn(),
    ...over,
  };
  renderHook(() => useKeyboardShortcuts(options));
  return options;
}

describe("Delete and undo on the focused map beside Chat & Rolls", () => {
  it("deletes the selected token", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { sendMessage } = shortcuts();
    expect(press(map, { key: "Delete" }).defaultPrevented).toBe(true);
    expect(sendMessage).toHaveBeenCalled();
  });

  it("undoes a stroke in Draw", () => {
    const handleUndo = vi.fn();
    shortcuts({
      selectedObjectIds: [],
      drawMode: true,
      drawingManager: { canUndo: true, canRedo: false, handleUndo, handleRedo: vi.fn() },
    });
    press(map, { key: "z", ctrlKey: true });
    expect(handleUndo).toHaveBeenCalledTimes(1);
  });

  it("undoes the DM's last selection change", () => {
    const undoSelection = vi.fn();
    shortcuts({ selectedObjectIds: [], undoSelection });
    press(map, { key: "z", ctrlKey: true });
    expect(undoSelection).toHaveBeenCalledTimes(1);
  });

  it("deletes the selected drawing in Select", () => {
    const sendMessage = vi.fn();
    renderHook(() =>
      useKeyboardNavigation({
        selectedDrawingId: "d1",
        selectMode: true,
        sendMessage,
        handleSelectDrawing: vi.fn(),
        selectedObjectId: null,
      }),
    );
    press(map, { key: "Delete" });
    expect(sendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "d1" });
  });

  it("opens Kick in a door on G", () => {
    const { result } = renderHook(() =>
      useKickedInDoor({
        isDM: true,
        snapshot: { compiledScene: { sourceDocumentId: "doc" } } as unknown as RoomSnapshot,
        sendMessage: vi.fn(),
        activeTool: null,
        toast: { info: vi.fn(() => "t"), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
        atlasErrorRef: { current: null },
      }),
    );
    press(map, { key: "g" });
    expect(result.current.open).toBe(true);
  });
});

describe("what still owns the key", () => {
  it.each(["modal", "popover"] as const)("a %s in front, even with the map focused", (kind) => {
    const blocker = layerAt(kind, 100);
    releases.push(escapeRegistry.register(blocker.read));
    const { sendMessage } = shortcuts();
    expect(press(map, { key: "Delete" }).defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a covering phone screen", () => {
    const sheet = rootAt(100);
    releases.push(escapeRegistry.observeFrame(() => sheet.root));
    const { sendMessage } = shortcuts();
    expect(press(map, { key: "Delete" }).defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("the Chat window itself, when focus is in it rather than on the map", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const { sendMessage } = shortcuts();
    expect(press(button, { key: "Delete" }).defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a text field: Backspace edits the text", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const { sendMessage } = shortcuts();
    expect(press(input, { key: "Backspace" }).defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
