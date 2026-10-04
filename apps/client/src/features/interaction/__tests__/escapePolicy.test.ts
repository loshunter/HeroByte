// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { localSiteEligible, pickEscape } from "../escapePolicy";
import { inputIn, layerAt } from "./ownershipFixtures";
import type { Entry, LayerOwner } from "../escapeTypes";

afterEach(() => {
  document.body.replaceChildren();
});

function chosenName(entries: Entry[], editable = false): string | undefined {
  const result = pickEscape(entries, editable);
  return result.state === "one" ? result.value.owner.name : undefined;
}

describe("explicit visual roots", () => {
  it.each([false, true])(
    "higher Character beats lower Help, reversed registration=%s",
    (reverse) => {
      const help = layerAt("popover", 2000, "help");
      const character = layerAt("panel", 2500, "character");
      const entries = [help.entry, character.entry];
      expect(chosenName(reverse ? entries.reverse() : entries)).toBe("character");
    },
  );

  it("Help over Chat is eligible even when a lower editor retains focus", () => {
    const chat = layerAt("panel", 1000, "chat");
    const input = inputIn(chat.node);
    input.focus();
    const help = layerAt("popover", 2000, "help");
    const entries = [chat.entry, help.entry];
    expect(localSiteEligible(entries, { root: chat.root, anchor: input })).toBe(false);
    expect(chosenName(entries, true)).toBe("help");
  });

  it.each([false, true])("same-band Characters follow actual DOM order, reverse=%s", (reverse) => {
    const alice = layerAt("panel", 2500, "alice");
    const bob = layerAt("panel", 2500, "bob");
    const entries = [alice.entry, bob.entry];
    expect(chosenName(reverse ? entries.reverse() : entries)).toBe("bob");
    // Moving the node changes paint order without changing registration order.
    document.body.append(alice.node);
    expect(chosenName(entries)).toBe("alice");
  });

  it("nested popup inherits its parent root, never beats a later Character", () => {
    const alice = layerAt("panel", 2500, "alice");
    const popup = document.createElement("div");
    alice.node.append(popup);
    const effects: LayerOwner = {
      kind: "popover",
      active: true,
      name: "effects",
      root: alice.root,
      anchor: popup,
      localBand: 1000,
      handle: vi.fn(),
    };
    const bob = layerAt("panel", 2500, "bob");
    const entry: Entry = { id: Symbol("effects"), owner: effects };
    expect(chosenName([entry, alice.entry, bob.entry])).toBe("bob");
    expect(chosenName([alice.entry, entry])).toBe("effects");
  });

  it("an eligible nested editor cancels before its enclosing popover only", () => {
    const character = layerAt("panel", 2500);
    const outside = inputIn(character.node);
    const popup = document.createElement("div");
    character.node.append(popup);
    const inside = inputIn(popup);
    const entry: Entry = {
      id: Symbol(),
      owner: {
        kind: "popover",
        active: true,
        name: "effects",
        root: character.root,
        anchor: popup,
        localBand: 1000,
        handle: vi.fn(),
      },
    };
    const entries = [character.entry, entry];
    expect(localSiteEligible(entries, { root: character.root, anchor: outside })).toBe(false);
    expect(localSiteEligible(entries, { root: character.root, anchor: inside })).toBe(true);
  });

  it("QuickWheel's explicit desktop canvas band stays below a Character", () => {
    const wheel = layerAt("popover", 0, "wheel");
    wheel.owner.localBand = 1200;
    const character = layerAt("panel", 2500, "character");
    expect(chosenName([wheel.entry, character.entry])).toBe("character");
  });

  it("a passive higher window blocks lower-panel dismissal without acquiring a close action", () => {
    const chat = layerAt("panel", 1000, "chat");
    const result = layerAt("panel", 1001, "result");
    // Only result's root is observed; its owner is deliberately NOT registered.
    expect(pickEscape([chat.entry], false, [result.root])).toEqual({ state: "blocked" });
    expect(result.handle).not.toHaveBeenCalled();
    expect(chat.handle).not.toHaveBeenCalled();
  });
});

describe("ladder after the eligible local editor declines", () => {
  const fallback = (kind: "gesture" | "tool" | "selection", order = 0): Entry => ({
    id: Symbol(kind),
    owner: { kind, name: kind, active: true, order, handle: vi.fn() },
  });

  it("pending gesture precedes content panel, including a plain-input target", () => {
    const panel = layerAt("panel", 2500);
    const entries = [panel.entry, fallback("gesture"), fallback("tool")];
    expect(chosenName(entries)).toBe("gesture");
    expect(chosenName(entries, true)).toBe("gesture");
  });

  it("tool precedes selection; ordinary text retains fallback Escape", () => {
    const entries = [fallback("selection"), fallback("tool")];
    expect(chosenName(entries)).toBe("tool");
    expect(pickEscape(entries, true)).toEqual({ state: "none" });
  });

  it.each([false, true])(
    "unresolved same-kind ties never use insertion order, reverse=%s",
    (reverse) => {
      const entries = [fallback("tool"), fallback("tool")];
      expect(pickEscape(reverse ? entries.reverse() : entries, false)).toEqual({
        state: "ambiguous",
      });
    },
  );
});
