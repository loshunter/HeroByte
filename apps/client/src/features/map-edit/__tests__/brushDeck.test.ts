// The painter's-deck derivation contract: paint families come from
// starterTiles ∩ VILLAGE_TERRAIN — no hand-kept list anywhere. These pins are
// what killed the old three-list swatch trap: a family added to the data
// MUST surface on the deck (completeness), and the derived wall/roof/ring
// sets must keep their pre-deck members and order.

import { beforeEach, describe, expect, it } from "vitest";
import { VILLAGE_TERRAIN } from "../../render/terrainPalette";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTiles";
import {
  INTERIOR_FLOOR_ASSET_IDS,
  PAINT_FAMILIES,
  ROOF_FAMILIES,
  WALL_FAMILIES,
  floorFamilyFromAssetId,
  isFloorFamilyAssetId,
} from "../mapEditFamilies";
import {
  buildBrushDeckGroups,
  filterBrushEntries,
  loadBrushPins,
  loadBrushRecents,
  pushBrushRecent,
  toggleBrushPin,
} from "../brushDeck";

const PINS_KEY = "herobyte:brush-deck:pins";

/** This jsdom's window.localStorage is an inert stub (no methods at all), so
 * storage tests install a functional in-memory one — the session.test.ts
 * pattern. brushDeck's readers/writers are try/caught, so the app itself
 * degrades to "pins don't persist" on broken storage. */
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

describe("paint-family derivation (mapEditFamilies)", () => {
  it("puts every palette family on the deck exactly once — the trap-killer", () => {
    const deckIds = PAINT_FAMILIES.map((entry) => entry.assetId);
    expect(new Set(deckIds).size).toBe(deckIds.length);
    expect([...deckIds].sort()).toEqual(Object.keys(VILLAGE_TERRAIN).sort());
  });

  it("every deck entry is fully authored: shelf material and a grammar note", () => {
    // The deck is the palette UI now — a new family must declare its shelf
    // and hover-card note where it declares its name and fill (the asset).
    for (const entry of PAINT_FAMILIES) {
      const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === entry.assetId)!;
      expect(asset.material, entry.assetId).toBeDefined();
      expect(asset.brushNote, entry.assetId).toBeTruthy();
      expect(entry.family).toBe(entry.assetId.slice("terrain:".length));
      expect(entry.material).toBe(asset.material);
      expect(entry.priority).toBe(VILLAGE_TERRAIN[entry.assetId]!.priority);
    }
  });

  it("derives the wall and roof families in the pre-deck toolbar order", () => {
    expect(WALL_FAMILIES).toEqual(["wall-stone", "wall-brick", "wall-timber", "wall-dark"]);
    expect(ROOF_FAMILIES).toEqual([
      "roof-shingle",
      "roof-thatch",
      "roof-cone",
      "roof-dome",
      "roof-thatch-spiral",
    ]);
  });

  it("keeps the ring-protection set byte-identical to the old hand-kept list", () => {
    expect([...INTERIOR_FLOOR_ASSET_IDS].sort()).toEqual(
      [
        "terrain:stone-floor",
        "terrain:wood-floor",
        "terrain:stone-cobble",
        "terrain:stone-sandstone",
        "terrain:wood-walnut",
        "terrain:wood-grey",
        "terrain:bridge-plank",
        "terrain:farm-furrow",
        "terrain:stairs-stone",
        "terrain:sunken-flagstone",
        "terrain:sunken-stairs",
        "terrain:dais-stone",
      ].sort(),
    );
  });

  it("round-trips every family through floorFamilyFromAssetId, nothing else", () => {
    for (const entry of PAINT_FAMILIES) {
      expect(floorFamilyFromAssetId(entry.assetId)).toBe(entry.family);
    }
    expect(floorFamilyFromAssetId("terrain:bogus")).toBeNull();
    expect(floorFamilyFromAssetId("objects:crate")).toBeNull();
    expect(floorFamilyFromAssetId("structures:stone-wall")).toBeNull();
    expect(isFloorFamilyAssetId("")).toBe(false);
  });
});

describe("brush deck view model", () => {
  it("shelves the families by material in priority order", () => {
    const byMaterial = Object.fromEntries(
      buildBrushDeckGroups().map((group) => [
        group.material,
        group.entries.map((entry) => entry.family),
      ]),
    );
    expect(byMaterial).toEqual({
      ground: ["path", "cave-floor", "ash-drift", "dirt", "grass", "sand", "farm-furrow"],
      water: ["water", "sunken-flagstone", "sunken-stairs"],
      molten: ["lava", "lava-crust"],
      stone: [
        "cliff",
        "cave-wall",
        "stone-floor",
        "stone-cobble",
        "stone-sandstone",
        "stairs-stone",
        "dais-stone",
        "wall-stone",
        "wall-brick",
        "wall-dark",
      ],
      wood: ["wood-floor", "wood-walnut", "wood-grey", "bridge-plank", "wall-timber"],
      roof: ["roof-shingle", "roof-thatch", "roof-cone", "roof-dome", "roof-thatch-spiral"],
      canopy: ["canopy", "canopy-blossom"],
      crystal: ["crystal-gold", "crystal-verdigris"],
    });
  });

  it("searches by name, family id, or shelf — case-insensitive", () => {
    expect(filterBrushEntries(PAINT_FAMILIES, "")).toHaveLength(PAINT_FAMILIES.length);
    expect(filterBrushEntries(PAINT_FAMILIES, "oak").map((e) => e.family)).toEqual(["wood-floor"]);
    expect(filterBrushEntries(PAINT_FAMILIES, "OAK").map((e) => e.family)).toEqual(["wood-floor"]);
    expect(filterBrushEntries(PAINT_FAMILIES, "canopy").map((e) => e.family)).toEqual([
      "canopy",
      "canopy-blossom",
    ]);
  });
});

describe("pins + recents storage", () => {
  beforeEach(installMemoryStorage);

  it("toggles a pin and persists it", () => {
    expect(loadBrushPins()).toEqual([]);
    expect(toggleBrushPin("grass")).toEqual(["grass"]);
    expect(loadBrushPins()).toEqual(["grass"]);
    expect(toggleBrushPin("grass")).toEqual([]);
    expect(loadBrushPins()).toEqual([]);
  });

  it("drops unknown families and corrupted payloads on load", () => {
    window.localStorage.setItem(PINS_KEY, JSON.stringify(["grass", "no-such-family", 7]));
    expect(loadBrushPins()).toEqual(["grass"]);
    window.localStorage.setItem(PINS_KEY, "{not json");
    expect(loadBrushPins()).toEqual([]);
  });

  it("keeps recents deduped, newest-first, capped at six", () => {
    pushBrushRecent("grass");
    pushBrushRecent("dirt");
    expect(pushBrushRecent("grass")).toEqual(["grass", "dirt"]);
    for (const family of ["water", "sand", "path", "cliff", "canopy"]) {
      pushBrushRecent(family);
    }
    const recents = loadBrushRecents();
    expect(recents).toHaveLength(6);
    expect(recents[0]).toBe("canopy");
    expect(recents).not.toContain("dirt");
  });
});
