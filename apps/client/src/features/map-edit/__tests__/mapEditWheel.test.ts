// Quick-wheel slot derivation (P5): four fixed tools + four brushes drawn
// from the SAME data the deck uses — pins first, then recents, then shelf
// order — so the wheel and the deck can never disagree.

import { beforeEach, describe, expect, it } from "vitest";
import { buildWheelSlots, toolAfterBrushPick, WHEEL_TOOLS } from "../mapEditWheel";

/** In-memory localStorage (this jsdom's stub is inert — see brushDeck.test). */
function installMemoryStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}

describe("buildWheelSlots", () => {
  beforeEach(installMemoryStorage);

  it("is always 8 slots: the tool arc plus four brushes", () => {
    const slots = buildWheelSlots([], []);
    expect(slots).toHaveLength(8);
    expect(slots.slice(0, 4)).toEqual(WHEEL_TOOLS);
    expect(slots.slice(4).every((slot) => slot.kind === "brush")).toBe(true);
  });

  it("fills empty pins/recents from the deck shelves in browse order", () => {
    const brushes = buildWheelSlots([], []).slice(4);
    // Ground shelf, priority order: path, dirt, grass, sand.
    expect(brushes.map((slot) => (slot.kind === "brush" ? slot.entry.family : ""))).toEqual([
      "path",
      "dirt",
      "grass",
      "sand",
    ]);
  });

  it("puts pins first, then recents, deduped, capped at four", () => {
    const brushes = buildWheelSlots(["water", "canopy"], ["water", "wall-stone", "cliff"]).slice(4);
    expect(brushes.map((slot) => (slot.kind === "brush" ? slot.entry.family : ""))).toEqual([
      "water",
      "canopy",
      "wall-stone",
      "cliff",
    ]);
    expect(brushes.map((slot) => (slot.kind === "brush" ? slot.pinned : null))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("ignores families that no longer exist", () => {
    const brushes = buildWheelSlots(["no-such-family"], []).slice(4);
    expect(brushes.map((slot) => (slot.kind === "brush" ? slot.entry.family : ""))).toEqual([
      "path",
      "dirt",
      "grass",
      "sand",
    ]);
  });
});

describe("toolAfterBrushPick", () => {
  it("keeps the floor-consuming tools and re-arms Paint for everything else", () => {
    expect(toolAfterBrushPick("room")).toBe("room");
    expect(toolAfterBrushPick("hallway")).toBe("hallway");
    expect(toolAfterBrushPick("terrain")).toBe("terrain");
    expect(toolAfterBrushPick("wall")).toBe("terrain");
    expect(toolAfterBrushPick("place")).toBe("terrain");
    expect(toolAfterBrushPick("select")).toBe("terrain");
  });
});
