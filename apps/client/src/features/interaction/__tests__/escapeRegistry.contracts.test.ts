// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEscapeRegistry, type EscapeRegistry } from "../escapeRegistry";
import { escapeFrom, inputIn, layerAt, rootAt } from "./ownershipFixtures";
import type { ReadOwner } from "../escapeTypes";

let registry: EscapeRegistry;
let releases: (() => void)[];
const register = (read: ReadOwner) => {
  releases.push(registry.register(read));
};
beforeEach(() => {
  registry = createEscapeRegistry(() => window, vi.fn());
  releases = [];
});
afterEach(() => {
  for (const release of releases) release();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("key-independent foreground eligibility", () => {
  it("allows canvas history with context-only palette, blocks it beneath content", () => {
    const canvas = rootAt(0);
    const palette = rootAt(200);
    const canvasSite = { root: canvas.root, anchor: canvas.node };
    expect(registry.isForeground(canvasSite)).toBe(true);
    expect(registry.isForeground({ root: palette.root, anchor: palette.node })).toBe(true);
    const chat = layerAt("panel", 1000);
    register(chat.read);
    // A history destination is the canvas, even when the key originated on Chat's button.
    const button = document.createElement("button");
    chat.node.append(button);
    expect(registry.isForeground(canvasSite)).toBe(false);
    expect(registry.isForeground({ root: chat.root, anchor: button })).toBe(true);
    const undo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
    expect(registry.canHandleLocalEscape(undo, { root: chat.root, anchor: button })).toBe(false);
    chat.owner.active = false;
    expect(registry.isForeground(canvasSite)).toBe(true);
  });

  it("honors the same-root popup boundary and rejects a detached intended owner", () => {
    const panel = layerAt("panel", 2500);
    const popup = document.createElement("div");
    panel.node.append(popup);
    const inside = inputIn(popup);
    register(panel.read);
    register(() => ({
      kind: "popover",
      active: true,
      name: "effects",
      root: panel.root,
      anchor: popup,
      localBand: 1000,
      handle: vi.fn(),
    }));
    expect(registry.isForeground({ root: panel.root, anchor: panel.node })).toBe(false);
    expect(registry.isForeground({ root: panel.root, anchor: inside })).toBe(true);
    inside.remove();
    expect(registry.isForeground({ root: panel.root, anchor: inside })).toBe(false);
  });
});

describe("pending view is advisory; actions read live state", () => {
  it("same label with a replaced callback uses the replacement without publishing", () => {
    let pending = true;
    const oldCancel = vi.fn();
    const newCancel = vi.fn(() => {
      pending = false;
    });
    let cancel = oldCancel;
    const changed = vi.fn();
    releases.push(registry.subscribe(changed));
    register(() => ({
      kind: "gesture",
      active: pending,
      name: "terrain",
      order: 0,
      label: "Cancel stroke",
      handle: cancel,
    }));
    expect(changed).toHaveBeenCalledTimes(1);
    cancel = newCancel;
    registry.refresh();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registry.cancelPending()).toBe(true);
    expect(oldCancel).not.toHaveBeenCalled();
    expect(newCancel).toHaveBeenCalledExactlyOnceWith("cancel-control");
    expect(registry.getPendingLabel()).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("a stale control never falls through to panel, tool, or selection", () => {
    let pending = true;
    const cancel = vi.fn(() => {
      pending = false;
    });
    const panel = layerAt("panel", 1000);
    const tool = vi.fn();
    const selection = vi.fn();
    register(panel.read);
    register(() => ({
      kind: "gesture",
      active: pending,
      name: "draw",
      order: 0,
      label: "Cancel stroke",
      handle: cancel,
    }));
    register(() => ({ kind: "tool", active: true, name: "draw mode", order: 0, handle: tool }));
    register(() => ({
      kind: "selection",
      active: true,
      name: "selected",
      order: 0,
      handle: selection,
    }));
    expect(registry.getPendingLabel()).toBe("Cancel stroke");
    pending = false; // An already-finished owner cannot be revived by stale presentation.
    expect(registry.cancelPending()).toBe(false);
    expect(registry.getPendingLabel()).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
    expect(panel.handle).not.toHaveBeenCalled();
    expect(tool).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
    pending = true;
    registry.refresh();
    expect(registry.cancelPending()).toBe(true); // pointerdown
    expect(registry.cancelPending()).toBe(false); // subsequent compatibility click
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("opening and closing an ordinary wheel preserves held work", () => {
    let pending = true;
    const cancel = vi.fn(() => {
      pending = false;
    });
    register(() => ({
      kind: "gesture",
      active: pending,
      name: "terrain",
      order: 0,
      handle: cancel,
    }));
    const wheel = layerAt("popover", 0, "quick wheel");
    wheel.owner.localBand = 1200;
    wheel.owner.handle = vi.fn(() => {
      wheel.owner.active = false;
    });
    register(wheel.read);
    expect(cancel).not.toHaveBeenCalled();
    escapeFrom();
    expect(wheel.owner.handle).toHaveBeenCalledExactlyOnceWith("escape");
    expect(cancel).not.toHaveBeenCalled();
    expect(pending).toBe(true);
    escapeFrom();
    expect(cancel).toHaveBeenCalledExactlyOnceWith("escape");
  });
});

describe("native and listener boundaries", () => {
  it("plain input closes its foreground panel but cannot reach tool fallback afterward", () => {
    const panel = layerAt("panel", 2500);
    const close = vi.fn(() => {
      panel.owner.active = false;
    });
    panel.owner.handle = close;
    register(panel.read);
    const tool = vi.fn();
    register(() => ({ kind: "tool", active: true, name: "draw", order: 0, handle: tool }));
    const input = inputIn(panel.node);
    escapeFrom(input);
    expect(close).toHaveBeenCalledExactlyOnceWith("escape");
    expect(tool).not.toHaveBeenCalled();
    expect(escapeFrom(input).defaultPrevented).toBe(false);
    expect(tool).not.toHaveBeenCalled();
  });

  it("retains keyCode 229 and resets tracked composition on window blur", () => {
    const panel = layerAt("panel", 1000);
    register(panel.read);
    const input = inputIn(panel.node);
    escapeFrom(input, { keyCode: 229 });
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    escapeFrom(input);
    expect(panel.handle).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("blur"));
    escapeFrom(input);
    expect(panel.handle).toHaveBeenCalledExactlyOnceWith("escape");
  });

  it("passive frame-only registration owns one listener and removes every observer", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const result = rootAt(1001);
    const release = registry.observeFrame(() => result.root);
    releases.push(release);
    expect(escapeFrom().defaultPrevented).toBe(true);
    release();
    release();
    expect(escapeFrom().defaultPrevented).toBe(false);
    for (const key of ["keydown", "compositionstart", "compositionend", "blur"]) {
      const added = add.mock.calls.filter(([name]) => name === key);
      const removed = remove.mock.calls.filter(([name]) => name === key);
      expect(added).toHaveLength(1);
      expect(removed).toHaveLength(1);
      expect(removed[0][1]).toBe(added[0][1]);
    }
  });
});
