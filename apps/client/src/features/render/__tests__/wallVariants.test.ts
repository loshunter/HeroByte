// The wall repaint: painted wall families are pure DATA — asset entries +
// palette entries over ONE wall painter (terrainWallDetail), like the floor
// variants before them. This pins the contract that makes a wall READ tall:
// the lightest base in the palette, a thin inked rim, a deep cast shadow, a
// crisp edge, and live paintability. See the Czepeku study in the wall-repaint
// arc for the visual rationale.

import { describe, expect, it } from "vitest";
import {
  floorFamilyFromAssetId,
  INTERIOR_FLOOR_ASSET_IDS,
  ROOF_FAMILIES,
  WALL_FAMILIES,
} from "../../map-edit/mapEditFamilies";
import { getMapStudioTileAsset, MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTiles";
import { TERRAIN_RIM, TERRAIN_SHADOW_STRENGTH } from "../proceduralTerrain";
import { VILLAGE_TERRAIN } from "../terrainPalette";

const ALL_WALLS = WALL_FAMILIES.map((family) => `terrain:${family}`);

const luma = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("wall variants (walls that look like walls — variants are data)", () => {
  it("every wall id resolves to a terrain asset on the terrain layer", () => {
    for (const id of ALL_WALLS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id); // not the fallback
      expect(asset.category, id).toBe("terrain");
      expect(asset.layerKind, id).toBe("terrain");
    }
  });

  it("every wall is a crisp field family with the wall painter and no floor painter", () => {
    for (const id of ALL_WALLS) {
      const fam = VILLAGE_TERRAIN[id];
      expect(fam, id).toBeDefined();
      expect(fam!.edgeAmp, id).toBe(0);
      expect(fam!.wall, id).toBeDefined();
      expect(fam!.floor, id).toBeUndefined();
      expect(fam!.keyCluster, id).toBeUndefined();
    }
  });

  it("walls carry the height cues: thin rim and a darker-than-default cast shadow", () => {
    for (const id of ALL_WALLS) {
      const fam = VILLAGE_TERRAIN[id]!;
      expect(fam.rimWidth, id).toBeDefined();
      expect(fam.rimWidth!, id).toBeLessThan(TERRAIN_RIM);
      // Strength is the applied knob (band is reserved) — pinned against the
      // exported default, never a magic literal.
      expect(fam.shadow, id).toBeDefined();
      expect(fam.shadow!.strength, id).toBeGreaterThan(TERRAIN_SHADOW_STRENGTH);
    }
  });

  it("each wall's palette base matches its swatch fill (bake and flat fallback agree)", () => {
    for (const id of ALL_WALLS) {
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(getMapStudioTileAsset(id).fill);
    }
  });

  it("walls sit ABOVE every ground-level family with distinct priorities", () => {
    // Ground level = everything that is not a wall or a roof (naturals,
    // floors, stairs, drowned siblings, the dais ring). Roofs — square
    // (shingle-row painter) or round (roof-block polar) — deliberately sit
    // above walls, pinned in the levels-illusion suite below.
    const groundMax = Math.max(
      ...Object.entries(VILLAGE_TERRAIN)
        .filter(
          ([, fam]) =>
            fam.wall === undefined &&
            fam.roof === undefined &&
            (fam.polar === undefined || fam.priority < 20),
        )
        .map(([, fam]) => fam.priority),
    );
    const priorities = ALL_WALLS.map((id) => VILLAGE_TERRAIN[id]!.priority);
    for (const priority of priorities) expect(priority).toBeGreaterThan(groundMax);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("every wall top is lighter than the darkest interior stone floor (reads raised)", () => {
    // The core Czepeku cue: the wall band must never read darker than the
    // floor it stands over. Pin ALL four variants, not a sample.
    const floorLuma = luma(VILLAGE_TERRAIN["terrain:stone-floor"]!.base);
    for (const id of ALL_WALLS) {
      expect(luma(VILLAGE_TERRAIN[id]!.base), id).toBeGreaterThan(floorLuma);
    }
  });

  it("the ring-protection set is exactly the palette's ground-level laid surfaces", () => {
    // INTERIOR_FLOOR_ASSET_IDS guards the Room/Hallway wall bands from
    // overwriting a laid surface. It must track the palette: every
    // GROUND-level family (below the 20+ wall/roof blocks) with a floor,
    // stairs, sunken or polar routing (floors, staircases, drowned siblings,
    // the dais ring) is protected, nothing else is. Walls and roofs are fair
    // game — bands fuse, roofs (round ones included) cover; water is
    // unprotected, but authored architecture WITHIN it is not.
    const paletteInteriors = Object.entries(VILLAGE_TERRAIN)
      .filter(
        ([, fam]) =>
          fam.priority < 20 &&
          (fam.floor !== undefined ||
            fam.stairs !== undefined ||
            fam.sunken !== undefined ||
            fam.polar !== undefined),
      )
      .map(([id]) => id)
      .sort();
    expect([...INTERIOR_FLOOR_ASSET_IDS].sort()).toEqual(paletteInteriors);
  });

  it("the shelf lists all four walls as terrain swatches", () => {
    const terrainIds = MAP_STUDIO_TILE_ASSETS.filter((a) => a.category === "terrain").map(
      (a) => a.id,
    );
    for (const id of ALL_WALLS) expect(terrainIds).toContain(id);
  });

  it("the live map-edit palette recognises every wall as a paintable family", () => {
    for (const id of ALL_WALLS) {
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });

  it("the legacy placeable stone block is untouched (frozen id and fill)", () => {
    const legacy = getMapStudioTileAsset("structures:stone-wall");
    expect(legacy.id).toBe("structures:stone-wall");
    expect(legacy.fill).toBe("#64606a");
    expect(legacy.layerKind).toBe("walls");
  });
});

describe("roof + stairs families (the levels illusion)", () => {
  const ALL_ROOFS = ROOF_FAMILIES.map((family) => `terrain:${family}`);
  const STAIRS = "terrain:stairs-stone";

  it("every roof/stairs id resolves to a paintable terrain asset with a matching palette base", () => {
    for (const id of [...ALL_ROOFS, STAIRS]) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id);
      expect(asset.category, id).toBe("terrain");
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(asset.fill);
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });

  it("roofs are the tallest level: above every wall, hardest shadow, crisp edge", () => {
    const wallMax = Math.max(
      ...WALL_FAMILIES.map((f) => VILLAGE_TERRAIN[`terrain:${f}`]!.priority),
    );
    const wallStrength = VILLAGE_TERRAIN["terrain:wall-stone"]!.shadow!.strength;
    for (const id of ALL_ROOFS) {
      const fam = VILLAGE_TERRAIN[id]!;
      // Square roofs read through the shingle-row painter; round ones through
      // the polar-course field — every roof must have exactly one of the two.
      expect(fam.roof !== undefined || fam.polar !== undefined, id).toBe(true);
      expect(fam.roof !== undefined && fam.polar !== undefined, id).toBe(false);
      expect(fam.edgeAmp, id).toBe(0);
      expect(fam.priority, id).toBeGreaterThan(wallMax);
      expect(fam.shadow!.strength, id).toBeGreaterThan(wallStrength);
      // The roof rim is a LIGHT fascia (an eave catches sun), unlike the
      // walls' dark inked outline.
      expect(luma(fam.rim), id).toBeGreaterThan(luma(fam.base));
    }
  });

  it("stairs sit between floors and walls with the tread painter and default shadow", () => {
    const fam = VILLAGE_TERRAIN[STAIRS]!;
    const floorMax = Math.max(
      ...Object.entries(VILLAGE_TERRAIN)
        .filter(([, f]) => f.floor !== undefined)
        .map(([, f]) => f.priority),
    );
    const wallMin = Math.min(
      ...WALL_FAMILIES.map((f) => VILLAGE_TERRAIN[`terrain:${f}`]!.priority),
    );
    expect(fam.stairs).toBeDefined();
    expect(fam.edgeAmp).toBe(0);
    expect(fam.priority).toBeGreaterThan(floorMax);
    expect(fam.priority).toBeLessThan(wallMin);
    expect(fam.shadow).toBeUndefined();
  });
});
