// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEscapeRegistry } from "../escapeRegistry";
import { escapeFrom, inputIn, layerAt } from "./ownershipFixtures";
import type { EscapeRegistry } from "../escapeRegistry";
import type { ReadOwner } from "../escapeTypes";

let registry: EscapeRegistry;
let releases: (() => void)[];
const register = (read: ReadOwner) => {
  const release = registry.register(read);
  releases.push(release);
  return release;
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

describe("listener ownership and native first refusal", () => {
  it("attaches one bubble key listener and releases it only with the last owner", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const panel = layerAt("panel", 1000);
    const release1 = register(panel.read);
    const release2 = register(() => ({
      kind: "tool",
      active: false,
      name: "tool",
      order: 0,
      handle: vi.fn(),
    }));
    const keyAdds = add.mock.calls.filter(([key]) => key === "keydown");
    expect(keyAdds).toHaveLength(1);
    expect(keyAdds[0][2]).toBeUndefined();
    release1();
    release1();
    expect(remove.mock.calls.filter(([key]) => key === "keydown")).toHaveLength(0);
    release2();
    expect(remove.mock.calls.filter(([key]) => key === "keydown")).toHaveLength(1);
    expect(remove.mock.calls.find(([key]) => key === "keydown")?.[1]).toBe(keyAdds[0][1]);
  });

  it("respects defaultPrevented from an earlier valid field editor", () => {
    const panel = layerAt("panel", 1000);
    register(panel.read);
    const input = inputIn(panel.node);
    input.addEventListener("keydown", (event) => event.preventDefault());
    escapeFrom(input);
    expect(panel.handle).not.toHaveBeenCalled();
  });

  it("conservatively leaves every native select Escape to the browser", () => {
    const panel = layerAt("panel", 1000);
    register(panel.read);
    const select = document.createElement("select");
    panel.node.append(select);
    const event = escapeFrom(select);
    expect(event.defaultPrevented).toBe(false);
    expect(panel.handle).not.toHaveBeenCalled();
  });

  it("checks native isComposing and tracked composition across false keyboard flags", () => {
    const panel = layerAt("panel", 1000);
    register(panel.read);
    const input = inputIn(panel.node);
    escapeFrom(input, { isComposing: true });
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    escapeFrom(input, { isComposing: false });
    expect(panel.handle).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    escapeFrom(input);
    expect(panel.handle).toHaveBeenCalledExactlyOnceWith("escape");
  });

  it("composition observation survives local propagation stops", () => {
    const panel = layerAt("panel", 1000);
    register(panel.read);
    const input = inputIn(panel.node);
    input.addEventListener("compositionstart", (event) => event.stopPropagation());
    input.addEventListener("compositionend", (event) => event.stopPropagation());
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    escapeFrom(input);
    expect(panel.handle).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    escapeFrom(input);
    expect(panel.handle).toHaveBeenCalledExactlyOnceWith("escape");
  });

  it("window-targeted Escape still reads focused text for tool fallback", () => {
    const handle = vi.fn();
    register(() => ({ kind: "tool", active: true, name: "tool", order: 0, handle }));
    const input = inputIn(document.body);
    input.focus();
    escapeFrom(window);
    expect(handle).not.toHaveBeenCalled();
  });

  it("a local field behind Help may not mutate or consume Escape", () => {
    const chat = layerAt("panel", 1000, "chat");
    register(chat.read);
    const input = inputIn(chat.node);
    const local = vi.fn();
    input.addEventListener("keydown", (event) => {
      if (!registry.canHandleLocalEscape(event, { root: chat.root, anchor: input })) return;
      local();
      event.preventDefault();
    });
    const help = layerAt("popover", 2000, "help");
    register(help.read);
    escapeFrom(input);
    expect(local).not.toHaveBeenCalled();
    expect(help.handle).toHaveBeenCalledExactlyOnceWith("escape");
    expect(chat.handle).not.toHaveBeenCalled();
  });

  it("ignores a stale detached layer even before its effect cleanup runs", () => {
    const higher = layerAt("panel", 2500);
    const lower = layerAt("panel", 1000);
    register(higher.read);
    register(lower.read);
    higher.node.remove();
    escapeFrom();
    expect(higher.handle).not.toHaveBeenCalled();
    expect(lower.handle).toHaveBeenCalledExactlyOnceWith("escape");
  });

  it("passive root removal reveals the lower owner without installing another listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    const chat = layerAt("panel", 1000);
    const result = layerAt("panel", 1001);
    register(chat.read);
    const tool = vi.fn();
    register(() => ({ kind: "tool", active: true, name: "tool", order: 0, handle: tool }));
    const releaseRoot = registry.observeFrame(() => result.root);
    expect(escapeFrom().defaultPrevented).toBe(true);
    expect(chat.handle).not.toHaveBeenCalled();
    expect(result.handle).not.toHaveBeenCalled();
    expect(tool).not.toHaveBeenCalled();
    releaseRoot();
    releaseRoot();
    escapeFrom();
    expect(chat.handle).toHaveBeenCalledExactlyOnceWith("escape");
    expect(add.mock.calls.filter(([key]) => key === "keydown")).toHaveLength(1);
  });
});

describe("modal and gesture cancellation", () => {
  it.each([false, true])(
    "modal cancels pending refs in either registration order, modalFirst=%s",
    (modalFirst) => {
      let pending = true;
      const cancel = vi.fn(() => {
        pending = false;
      });
      const gesture: ReadOwner = () => ({
        kind: "gesture",
        name: "brush",
        active: pending,
        order: 0,
        handle: cancel,
      });
      const modal = layerAt("modal", 3000);
      if (modalFirst) {
        register(modal.read);
        register(gesture);
      } else {
        register(gesture);
        register(modal.read);
      }
      expect(cancel).toHaveBeenCalledExactlyOnceWith("foreground-modal");
      expect(pending).toBe(false);
      registry.refresh();
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it("a live modal transition cancels even without re-registering", () => {
    let pending = false;
    const cancel = vi.fn(() => {
      pending = false;
    });
    register(() => ({ kind: "gesture", name: "draw", active: pending, order: 0, handle: cancel }));
    const modal = layerAt("modal", 3000);
    modal.owner.active = false;
    register(modal.read);
    pending = true;
    modal.owner.active = true;
    registry.refresh();
    expect(cancel).toHaveBeenCalledExactlyOnceWith("foreground-modal");
  });

  it("a same-frame live modal edge cancels before its Escape action closes it", () => {
    let pending = true;
    const cancel = vi.fn(() => {
      pending = false;
    });
    register(() => ({ kind: "gesture", name: "draw", active: pending, order: 0, handle: cancel }));
    const modal = layerAt("modal", 3000);
    modal.owner.active = false;
    modal.owner.handle = () => {
      modal.owner.active = false;
    };
    register(modal.read);
    modal.owner.active = true;
    escapeFrom();
    expect(cancel).toHaveBeenCalledExactlyOnceWith("foreground-modal");
    expect(pending).toBe(false);
    expect(modal.owner.active).toBe(false);
  });

  it("loading modal consumes without dismissal or hidden tool/selection actions", () => {
    const modal = layerAt("modal", 3000);
    modal.owner.handle = undefined;
    register(modal.read);
    const tool = vi.fn();
    const selection = vi.fn();
    register(() => ({ kind: "tool", active: true, name: "tool", order: 0, handle: tool }));
    register(() => ({
      kind: "selection",
      active: true,
      name: "selection",
      order: 0,
      handle: selection,
    }));
    expect(escapeFrom().defaultPrevented).toBe(true);
    expect(modal.handle).not.toHaveBeenCalled();
    expect(tool).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
  });

  it("same-frame gesture -> panel -> tool -> selection take four distinct Escapes", () => {
    const calls: string[] = [];
    let pending = true;
    let toolActive = true;
    register(() => ({
      kind: "gesture",
      name: "brush",
      active: pending,
      order: 0,
      handle: () => {
        calls.push("gesture");
        pending = false;
      },
    }));
    const panel = layerAt("panel", 1000);
    panel.owner.handle = () => {
      calls.push("panel");
      panel.owner.active = false;
    };
    register(panel.read);
    register(() => ({
      kind: "tool",
      name: "tool",
      active: toolActive,
      order: 0,
      handle: () => {
        calls.push("tool");
        toolActive = false;
      },
    }));
    register(() => ({
      kind: "selection",
      name: "selection",
      active: true,
      order: 0,
      handle: () => {
        calls.push("selection");
      },
    }));
    escapeFrom();
    expect(calls).toEqual(["gesture"]);
    escapeFrom();
    expect(calls).toEqual(["gesture", "panel"]);
    escapeFrom();
    expect(calls).toEqual(["gesture", "panel", "tool"]);
    escapeFrom();
    expect(calls).toEqual(["gesture", "panel", "tool", "selection"]);
  });

  it("explicit transition cancels all unsent owners; same-frame Escape reads pending refs", () => {
    let annotation = true;
    let terrain = true;
    const draw = vi.fn(() => {
      annotation = false;
    });
    const map = vi.fn(() => {
      terrain = false;
    });
    register(() => ({ kind: "gesture", name: "draw", active: annotation, order: 0, handle: draw }));
    register(() => ({ kind: "gesture", name: "map", active: terrain, order: 1, handle: map }));
    expect(registry.cancelForTransition()).toBe(2);
    expect(draw).toHaveBeenCalledExactlyOnceWith("transition");
    expect(map).toHaveBeenCalledExactlyOnceWith("transition");
    terrain = true; // Driver ref mutation, before any React render or refresh.
    escapeFrom();
    expect(map).toHaveBeenLastCalledWith("escape");
    expect(terrain).toBe(false);
  });

  it("publishes a stable scalar only when pending label changes", () => {
    let pending = false;
    const changed = vi.fn();
    const unsubscribe = registry.subscribe(changed);
    const cancel = vi.fn(() => {
      pending = false;
    });
    register(() => ({
      kind: "gesture",
      name: "draw",
      active: pending,
      order: 0,
      label: "Cancel drawing",
      handle: cancel,
    }));
    registry.refresh();
    expect(changed).not.toHaveBeenCalled();
    pending = true;
    registry.refresh();
    registry.refresh();
    expect(registry.getPendingLabel()).toBe("Cancel drawing");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registry.cancelPending()).toBe(true);
    expect(cancel).toHaveBeenCalledExactlyOnceWith("cancel-control");
    expect(registry.getPendingLabel()).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
