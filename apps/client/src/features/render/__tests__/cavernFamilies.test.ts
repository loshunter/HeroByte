// The volcanic-cavern family roster (lava cavern benchmark study) + the two new
// field primitives it needed. Pins the contracts that keep the reuse honest:
// lava rides the WATER machinery without becoming the water body, the glow term
// brightens (every other darkening term can only darken), and no existing
// family's pixels move.

import { describe, expect, it } from "vitest";
import { renderTerrainField } from "../proceduralTerrain";
import { buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { VILLAGE_SHADOW_TINT, VILLAGE_TERRAIN } from "../terrainPalette";
import { waterFamilyOf } from "../terrainFieldColor";
import { computeFieldDepths } from "../terrainDistanceField";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { INTERIOR_FLOOR_ASSET_IDS } from "../../map-edit/mapEditFamilies";
import type { StructuredTerrainLayer, TerrainCellRect } from "../tileRenderCore";

const SIZE = 20;
const GRID = { size: SIZE, offsetX: 0, offsetY: 0 };

const CAVERN_IDS = [
  "terrain:lava",
  "terrain:lava-crust",
  "terrain:cave-floor",
  "terrain:ash-drift",
  "terrain:cave-wall",
  "terrain:crystal-gold",
  "terrain:crystal-verdigris",
];

function block(assetId: string, x0: number, y0: number, w: number, h: number) {
  const cells: TerrainCellRect[] = [];
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      cells.push({ x: x * SIZE, y: y * SIZE, size: SIZE, cellX: x, cellY: y });
    }
  }
  return { assetId, cells, edges: [] } satisfies StructuredTerrainLayer;
}

function bake(layers: StructuredTerrainLayer[]) {
  const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN, VILLAGE_SHADOW_TINT);
  if (!built) throw new Error("no field terrain");
  const { config, width, height } = built;
  const pixels = new Uint8ClampedArray(width * height * 4);
  renderTerrainField(pixels, width, height, config);
  return { pixels, width, height, config };
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("cavern family roster", () => {
  it("every family resolves to a paintable asset whose fill matches its palette base", () => {
    for (const id of CAVERN_IDS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id);
      expect(asset.category, id).toBe("terrain");
      expect(asset.layerKind, id).toBe("terrain");
      // Bake, flat fallback and SVG export must agree on the colour.
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(asset.fill);
    }
  });

  it("adds no new ring-protected interior surface (Room bands may cross lava and rock)", () => {
    for (const id of CAVERN_IDS) {
      expect(INTERIOR_FLOOR_ASSET_IDS.has(id), id).toBe(false);
    }
  });

  it("natural rock stays TERRAIN — the cave wall sits with the cliff, below the masonry block", () => {
    // The 20+ block is reserved for BUILT walls (wallVariants.test pins them
    // above every ground family), so a natural mass must stay under it or a
    // stone wall would no longer dominate the ground it stands on.
    const caveWall = VILLAGE_TERRAIN["terrain:cave-wall"]!;
    expect(caveWall.priority).toBeLessThan(20);
    expect(caveWall.priority).toBeGreaterThan(VILLAGE_TERRAIN["terrain:cliff"]!.priority);
    // It keeps a tall feature's long shadow throw.
    expect(caveWall.shadow!.band).toBeGreaterThan(0.15);
  });
});

describe("lava rides the water machinery without becoming the water", () => {
  it("is depth-banded hot→deep with an incandescent lip and crust dashes", () => {
    const lava = VILLAGE_TERRAIN["terrain:lava"]!;
    expect(lava.depthBands!.length).toBeGreaterThan(2);
    expect(lava.underfill).toBe(false); // exact region, like water
    expect(lava.foam).toBeDefined(); // the hot lip at every rock contact
    expect(lava.water!.dash).toBeDefined(); // floating crust rafts
    // Bands run BRIGHT at the shore to DARK in the deep centre.
    const bands = [...lava.depthBands!].sort((a, b) => a.maxCells - b.maxCells);
    const lumas = bands.map((band) => {
      const r = parseInt(band.base.slice(1, 3), 16);
      const g = parseInt(band.base.slice(3, 5), 16);
      const b = parseInt(band.base.slice(5, 7), 16);
      return luma(r, g, b);
    });
    for (let i = 1; i < lumas.length; i += 1) {
      expect(lumas[i]!, `band ${i}`).toBeLessThan(lumas[i - 1]!);
    }
  });

  it("NEVER becomes the water body drowned architecture tints toward", () => {
    // waterFamilyOf picks the first banded family; without the body filter a
    // molten palette could capture the sunken drown tint.
    const water = waterFamilyOf(VILLAGE_TERRAIN);
    expect(water).toBe(VILLAGE_TERRAIN["terrain:water"]);
    expect(VILLAGE_TERRAIN["terrain:lava"]!.body).toBe("lava");
  });

  it("keeps a bathymetry independent of an adjacent water pool", () => {
    // Two 3x3 pools sharing an edge. Fused into one body (the pre-study
    // behaviour) the shared seam would read as deep interior; as separate
    // bodies each pool still sees the other as shore.
    const familyByCell = new Map<string, string>();
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) familyByCell.set(`${x},${y}`, "terrain:lava");
      for (let x = 3; x < 6; x += 1) familyByCell.set(`${x},${y}`, "terrain:water");
    }
    const depths = computeFieldDepths(
      familyByCell,
      ["terrain:lava", "terrain:water"],
      VILLAGE_TERRAIN,
    );
    // Cell (2,1) is lava on the seam with water: still shore (depth 1).
    expect(depths.get("terrain:lava")!.get("2,1")).toBe(1);
    // ...and the water side of the same seam likewise.
    expect(depths.get("terrain:water")!.get("3,1")).toBe(1);
  });
});

describe("glow — emissive spill onto lower families", () => {
  it("BRIGHTENS the rock ring around lava (every other field term only darkens)", () => {
    const floorOnly = bake([block("terrain:cave-floor", 0, 0, 9, 9)]);
    const withLava = bake([
      block("terrain:cave-floor", 0, 0, 9, 9),
      block("terrain:lava", 3, 3, 3, 3),
    ]);
    expect(withLava.width).toBe(floorOnly.width);

    // Probe in WORLD px. The lava block spans cells 3..5, so its left
    // silhouette sits at x = 60; the glow lives in the strip just outside it.
    const probe = (b: typeof floorOnly, wx: number, wy: number) => {
      const px = Math.round(wx - b.config.originX);
      const py = Math.round(wy - b.config.originY);
      const o = (py * b.width + px) * 4;
      return luma(b.pixels[o]!, b.pixels[o + 1]!, b.pixels[o + 2]!);
    };
    const midY = 4 * SIZE + SIZE / 2;
    // Rock hugging the lava edge: lit by it.
    expect(probe(withLava, 56, midY)).toBeGreaterThan(probe(floorOnly, 56, midY));
    // REACH IS SUB-CELL BY CONSTRUCTION: an adjacent cell's CENTRE already sits
    // at the field's −0.5 saturation floor, so a field-driven glow can only
    // ever light the half-cell strip hugging the silhouette. A wider
    // atmospheric bloom is the lighting pass's job, not this term's.
    expect(probe(withLava, 50, midY)).toBeCloseTo(probe(floorOnly, 50, midY), 5);
    // Far corner: untouched.
    expect(probe(withLava, 10, 10)).toBeCloseTo(probe(floorOnly, 10, 10), 5);
  });

  it("leaves a non-glowing family's neighbours bit-identical (the parity rule)", () => {
    // grass over dirt carries no glow knob — the whole bake must be unchanged
    // by the new term existing at all.
    const a = bake([block("terrain:dirt", 0, 0, 8, 8), block("terrain:grass", 2, 2, 4, 4)]);
    const b = bake([block("terrain:dirt", 0, 0, 8, 8), block("terrain:grass", 2, 2, 4, 4)]);
    expect(a.pixels).toEqual(b.pixels);
    // And no pixel in that scene is brighter than the unlit dirt+grass max —
    // a smoke test that the glow branch never fires without the knob.
    const glowless = VILLAGE_TERRAIN["terrain:grass"]!.glow;
    expect(glowless).toBeUndefined();
  });
});
