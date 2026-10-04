import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { escapeRegistry } from "../../interaction/useEscapeOwner";
import { layerAt, rootAt } from "../../interaction/__tests__/ownershipFixtures";
import { useMapEditHotkeys } from "../useMapEditHotkeys";

describe("map history after returning focus to the map", () => {
  const undo = vi.fn();
  const redo = vi.fn();
  const releases: (() => void)[] = [];
  let canvas: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement("div");
    canvas.dataset.mapHistorySurface = "true";
    canvas.tabIndex = -1;
    document.body.append(canvas);
    const chat = layerAt("panel", 50, "chat");
    chat.owner.allowFocusedCanvasHistory = true;
    releases.push(escapeRegistry.register(chat.read));
    renderHook(() =>
      useMapEditHotkeys({ mapEditMode: true, canUndo: true, canRedo: true, undo, redo }),
    );
    canvas.focus();
  });

  afterEach(() => {
    cleanup();
    releases
      .splice(0)
      .reverse()
      .forEach((release) => release());
    document.body.replaceChildren();
  });

  function press(target: HTMLElement, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it("undoes and redoes while a nonmodal Chat window stays open", () => {
    expect(press(canvas).defaultPrevented).toBe(true);
    press(canvas, { key: "Z", shiftKey: true });
    press(canvas, { key: "y" });
    press(canvas, { ctrlKey: false, metaKey: true });
    expect(undo).toHaveBeenCalledTimes(2);
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it.each(["button", "input", "textarea", "select"])(
    "does not steal keys from a focused %s",
    (tag) => {
      const field = document.createElement(tag);
      document.body.append(field);
      field.focus();
      expect(press(field).defaultPrevented).toBe(false);
      expect(undo).not.toHaveBeenCalled();
    },
  );

  it.each(["modal", "popover"] as const)(
    "keeps a %s protected even if map focus remains",
    (kind) => {
      const blocker = layerAt(kind, 100);
      releases.push(escapeRegistry.register(blocker.read));
      expect(press(canvas).defaultPrevented).toBe(false);
      expect(undo).not.toHaveBeenCalled();
    },
  );

  it("keeps a passive full-screen frame protected", () => {
    const sheet = rootAt(100);
    releases.push(escapeRegistry.observeFrame(() => sheet.root));
    expect(press(canvas).defaultPrevented).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });

  it("does not accept a canvas event after focus has moved away", () => {
    canvas.blur();
    expect(press(canvas).defaultPrevented).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });

  it("preserves IME composition and consumed keyboard events", () => {
    expect(press(canvas, { isComposing: true }).defaultPrevented).toBe(false);
    act(() => {
      canvas.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    });
    expect(press(canvas).defaultPrevented).toBe(false);
    act(() => {
      canvas.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    });
    canvas.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
    press(canvas);
    expect(undo).not.toHaveBeenCalled();
  });
});
