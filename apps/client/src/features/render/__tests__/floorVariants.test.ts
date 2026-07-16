// Slice 3 of the floor repaint: the variant floors are pure DATA — new asset
// entries + palette entries over the same two material painters. This pins the
// contract that keeps them working: every floor id resolves as a terrain
// asset, joins the procedural field with a crisp edge and a floor painter, and
// agrees with its swatch fill so the field bake and the flat fallback match.

import { describe, expect, it } from "vitest";
import { floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { getMapStudioTileAsset, MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTiles";
import { VILLAGE_TERRAIN } from "../terrainPalette";

const WOOD_FLOORS = ["terrain:wood-floor", "terrain:wood-walnut", "terrain:wood-grey"] as const;
const STONE_FLOORS = [
  "terrain:stone-floor",
  "terrain:stone-cobble",
  "terrain:stone-sandstone",
] as const;
const ALL_FLOORS = [...WOOD_FLOORS, ...STONE_FLOORS];

describe("floor variants (Slice 3 — variants are data)", () => {
  it("every floor id resolves to a terrain asset on the terrain layer", () => {
    for (const id of ALL_FLOORS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id); // not the fallback
      expect(asset.category, id).toBe("terrain");
      expect(asset.layerKind, id).toBe("terrain");
    }
  });

  it("every floor is a crisp procedural field family with a floor painter", () => {
    for (const id of ALL_FLOORS) {
      const fam = VILLAGE_TERRAIN[id];
      expect(fam, id).toBeDefined();
      expect(fam!.edgeAmp, id).toBe(0);
      expect(fam!.floor, id).toBeDefined();
      expect(fam!.keyCluster, id).toBeUndefined();
    }
    for (const id of WOOD_FLOORS) expect(VILLAGE_TERRAIN[id]!.floor!.kind).toBe("plank");
    for (const id of STONE_FLOORS) expect(VILLAGE_TERRAIN[id]!.floor!.kind).toBe("flagstone");
  });

  it("cobblestone is the flagstone painter at a smaller scale", () => {
    const cobble = VILLAGE_TERRAIN["terrain:stone-cobble"]!.floor!;
    expect(cobble.scale).toBeDefined();
    expect(cobble.scale!).toBeLessThan(1);
  });

  it("each floor's palette base matches its swatch fill (bake and flat fallback agree)", () => {
    for (const id of ALL_FLOORS) {
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(getMapStudioTileAsset(id).fill);
    }
  });

  it("floors sit ABOVE the natural families with distinct priorities", () => {
    const naturalMax = Math.max(
      VILLAGE_TERRAIN["terrain:grass"]!.priority,
      VILLAGE_TERRAIN["terrain:dirt"]!.priority,
      VILLAGE_TERRAIN["terrain:path"]!.priority,
    );
    const priorities = ALL_FLOORS.map((id) => VILLAGE_TERRAIN[id]!.priority);
    for (const priority of priorities) expect(priority).toBeGreaterThan(naturalMax);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("the ORIGINAL two floors keep their frozen ids and fills (SVG export contract)", () => {
    expect(getMapStudioTileAsset("terrain:stone-floor").fill).toBe("#4d5361");
    expect(getMapStudioTileAsset("terrain:wood-floor").fill).toBe("#725236");
  });

  it("the shelf lists all six floors as terrain swatches", () => {
    const terrainIds = MAP_STUDIO_TILE_ASSETS.filter((a) => a.category === "terrain").map(
      (a) => a.id,
    );
    for (const id of ALL_FLOORS) expect(terrainIds).toContain(id);
  });

  it("the live map-edit palette recognises every floor as a paintable family", () => {
    // The toolbar's floor picker and the eyedropper both key off this mapping;
    // a variant missing here would exist as an asset but be unpaintable live.
    for (const id of ALL_FLOORS) {
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });
});
