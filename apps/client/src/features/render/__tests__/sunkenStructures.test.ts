// Water II S5: sunken-structure ghosting. Drowned families are DATA — a
// `sunken: { of }` palette entry renders its dry sibling's painters through
// the drown tint while the field pulls its pixels toward the water bathymetry
// with its own water-body depth. Pins the mechanism the way underfill: false
// is pinned: the combined water∪sunken BFS (no phantom shallow ring around
// drowned ruins), the depth-keyed field tint, the tinted/skipped detail, the
// algae band, and the two shipped variants' wiring.

import { describe, expect, it } from "vitest";
import { floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { createTerrainField, type TerrainFieldFamily } from "../proceduralTerrain";
import { buildProceduralFieldConfig, paintProceduralDetail } from "../proceduralTerrainSurface";
import { makeTintCtx } from "../terrainDetailCtx";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import type { StructuredTerrainLayer, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext } from "./recordingContext";

const GRID = { size: 16, offsetX: 0, offsetY: 0 };
const CELL = GRID.size;
const asCtx = (context: unknown) => context as unknown as TileRenderContext2D;

const layerOf = (assetId: string, cells: [number, number][]): StructuredTerrainLayer => ({
  assetId,
  cells: cells.map(([cellX, cellY]) => ({
    x: cellX * CELL,
    y: cellY * CELL,
    size: CELL,
    cellX,
    cellY,
  })),
  edges: [],
});

const square = (x0: number, y0: number, w: number, h: number, skip?: Set<string>) => {
  const cells: [number, number][] = [];
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (!skip?.has(`${x},${y}`)) cells.push([x, y]);
    }
  }
  return cells;
};

describe("the drowned field tint (depth pulls pixels toward the bathymetry)", () => {
  const SUNKEN = "terrain:test-sunken";
  const BASE = "#808080";
  const family: TerrainFieldFamily = {
    assetId: SUNKEN,
    priority: 3.6,
    base: BASE,
    rim: "#404040",
    edgeAmp: 0,
    rimWidth: 0.05,
    underfill: false,
    sunken: {
      bands: [
        { maxCells: 2, base: "#204060" },
        { maxCells: 4, base: "#102030" },
      ],
    },
  };
  // A 12×12 drowned slab whose water-body depth is simply its column index,
  // so the drowning gradient is directly addressable.
  const field = createTerrainField({
    familyAt: (cx, cy) => (cx >= 0 && cx < 12 && cy >= 0 && cy < 12 ? SUNKEN : null),
    families: [family],
    cellSize: CELL,
    originX: 0,
    originY: 0,
    depthOf: (assetId, cx, cy) =>
      assetId === SUNKEN && cx >= 0 && cx < 12 && cy >= 0 && cy < 12 ? cx : 0,
  });
  const at = (cx: number) => field.colorAt(cx * CELL + CELL / 2, 6 * CELL + CELL / 2)!;
  const distFromBase = (rgb: readonly number[]): number =>
    Math.abs(rgb[0]! - 0x80) + Math.abs(rgb[1]! - 0x80) + Math.abs(rgb[2]! - 0x80);

  it("depth ≤ 1 renders the pre-drowned base exactly (the shallow 40% is baked into data)", () => {
    expect(at(1)).toEqual([0x80, 0x80, 0x80]);
  });

  it("pixels converge toward the water colour as the body deepens", () => {
    const shallow = distFromBase(at(2));
    const mid = distFromBase(at(3));
    const deep = distFromBase(at(6));
    expect(shallow).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(shallow);
    expect(deep).toBeGreaterThan(mid);
  });
});

describe("the combined water-body BFS (surface)", () => {
  // A 10×10 village lake with a sunken stair strip running from the north
  // shore to mid-lake: the strip is part of the BODY, so neither it nor the
  // water beside it reads as shore.
  const strip = new Set(["4,0", "4,1", "4,2", "4,3", "4,4", "4,5", "5,5"]);
  const water = layerOf("terrain:water", square(0, 0, 10, 10, strip));
  const stairs = layerOf(
    "terrain:sunken-stairs",
    [...strip].map((k) => k.split(",").map(Number) as [number, number]),
  );
  const built = buildProceduralFieldConfig([water, stairs], GRID, VILLAGE_TERRAIN)!;
  const depthOf = built.config.depthOf!;

  it("registers the sunken family with water-body depths: shallow at the shore end, deep mid-lake", () => {
    expect(depthOf("terrain:sunken-stairs", 4, 0)).toBe(1);
    expect(depthOf("terrain:sunken-stairs", 4, 5)).toBe(5);
  });

  it("the water reads drowned cells as body, not shore — no phantom shallow ring", () => {
    // Water beside the strip, mid-lake: its true land distance, not 1.
    expect(depthOf("terrain:water", 3, 5)).toBe(4);
    // And the water's own map covers the strip cells (bilinear continuity).
    expect(depthOf("terrain:water", 4, 5)).toBe(5);
  });

  it("without sunken cells the body is exactly the water's own BFS (parity)", () => {
    const plain = buildProceduralFieldConfig(
      [layerOf("terrain:water", square(0, 0, 3, 3))],
      GRID,
      VILLAGE_TERRAIN,
    )!;
    expect(plain.config.depthOf!("terrain:water", 0, 0)).toBe(1);
    expect(plain.config.depthOf!("terrain:water", 1, 1)).toBe(2);
  });
});

describe("drowned detail (tinted sibling painters, algae, the deep skip)", () => {
  const flagstoneShades = Object.values(VILLAGE_TERRAIN["terrain:stone-floor"]!.floor!.palette);

  function paintHarbour(waterCells: [number, number][], sunkenCells: [number, number][]) {
    const water = layerOf("terrain:water", waterCells);
    const sunken = layerOf("terrain:sunken-flagstone", sunkenCells);
    const built = buildProceduralFieldConfig([water, sunken], GRID, VILLAGE_TERRAIN)!;
    const field = createTerrainField(built.config);
    const { context, calls } = createRecordingContext();
    paintProceduralDetail(
      asCtx(context),
      [water, sunken],
      VILLAGE_TERRAIN,
      field,
      built.config.familyAt,
      built.config.depthOf,
    );
    return calls;
  }

  it("shallow drowned cells draw the sibling's painters through the drown tint, plus algae", () => {
    // A 5×5 pool with a drowned pier strip from the west shore (depths 1..3).
    const strip = new Set(["0,2", "1,2", "2,2"]);
    const calls = paintHarbour(
      square(0, 0, 5, 5, strip),
      [...strip].map((k) => k.split(",").map(Number) as [number, number]),
    );
    const styles = calls.filter((c) => c[0] === "set:fillStyle").map((c) => c[1] as string);
    expect(styles.some((s) => s.startsWith("rgb("))).toBe(true); // tinted sibling shades
    expect(styles).toContain("#6a7a34"); // algae on the land-contact cells
    for (const shade of flagstoneShades) expect(styles).not.toContain(shade); // never raw
  });

  it("past the deep band the sibling detail and algae are skipped entirely", () => {
    // A 12×12 lake with a drowned slab at its centre (depth 6).
    const slab = new Set(["5,5", "6,5", "5,6", "6,6"]);
    const calls = paintHarbour(
      square(0, 0, 12, 12, slab),
      [...slab].map((k) => k.split(",").map(Number) as [number, number]),
    );
    const styles = calls.filter((c) => c[0] === "set:fillStyle").map((c) => c[1] as string);
    expect(styles.some((s) => s.startsWith("rgb("))).toBe(false);
    expect(styles).not.toContain("#6a7a34");
  });
});

describe("no phantom waterline rim around mid-lake drowned structures", () => {
  it("the seam frame outside a deep slab is rim-free while the true shore keeps its waterline", () => {
    // Reviewer-probe regression: water's rim is a SHORE line; the exact-region
    // seam against a drowned slab at body depth ~5 must not ring it with
    // near-white dashes. 12×12 village lake, 2×2 sunken slab at (5,5)–(6,6).
    const slab = new Set(["5,5", "6,5", "5,6", "6,6"]);
    const water = layerOf("terrain:water", square(0, 0, 12, 12, slab));
    const sunken = layerOf(
      "terrain:sunken-flagstone",
      [...slab].map((k) => k.split(",").map(Number) as [number, number]),
    );
    const built = buildProceduralFieldConfig([water, sunken], GRID, VILLAGE_TERRAIN)!;
    const field = createTerrainField(built.config);
    // Nothing in the deep lake is bright but the waterline rim (#a7e3da) and
    // the foam/caustic terms, and those gate on depth — so "bright" ⇔ rim.
    const bright = (wx: number, wy: number): boolean => {
      const c = field.colorAt(wx + 0.5, wy + 0.5);
      return c !== null && c[1] > 150 && c[2] > 140;
    };
    let seam = 0;
    for (let wx = 5 * CELL - 3; wx < 7 * CELL + 3; wx += 1) {
      for (let wy = 5 * CELL - 3; wy < 7 * CELL + 3; wy += 1) {
        const inSlabBox = wx >= 5 * CELL && wx < 7 * CELL && wy >= 5 * CELL && wy < 7 * CELL;
        if (!inSlabBox && bright(wx, wy)) seam += 1;
      }
    }
    expect(seam).toBe(0);
    // Positive control: the lake's true north shore still paints its collar.
    let shore = 0;
    for (let wx = 2 * CELL; wx < 10 * CELL; wx += 2) {
      for (let wy = 0; wy < 4; wy += 1) {
        if (bright(wx, wy)) shore += 1;
      }
    }
    expect(shore).toBeGreaterThan(0);
  });
});

describe("the drowned tint shares the water's band jitter (seam continuity)", () => {
  it("a sunken pixel tints toward exactly the band the water would pick at that pixel", () => {
    const bands = [
      { maxCells: 2, base: "#204060" },
      { maxCells: 4, base: "#60a0b0" },
    ];
    const WATER_F: TerrainFieldFamily = {
      assetId: "terrain:test-w",
      priority: 3.5,
      base: "#204060",
      rim: "#a0e0e0",
      edgeAmp: 0,
      rimWidth: 0.05,
      underfill: false,
      depthBands: bands,
    };
    const SUNKEN_F: TerrainFieldFamily = {
      assetId: "terrain:test-s",
      priority: 3.6,
      base: "#808080",
      rim: "#404040",
      edgeAmp: 0,
      rimWidth: 0.05,
      underfill: false,
      sunken: { bands, priority: 3.5 },
    };
    // Field A: all water. Field B: the same lake with column cx=5 drowned.
    // Constant depth 2 puts every pixel's jittered band pick ON the 2-cells
    // boundary, where a mismatched jitter seed flips bands immediately.
    const familyAtA = (cx: number, cy: number): string | null =>
      cx >= 0 && cx < 12 && cy >= 0 && cy < 12 ? "terrain:test-w" : null;
    const familyAtB = (cx: number, cy: number): string | null =>
      cx >= 0 && cx < 12 && cy >= 0 && cy < 12 ? (cx === 5 ? "terrain:test-s" : "terrain:test-w") : null;
    const shared = {
      cellSize: CELL,
      originX: 0,
      originY: 0,
      depthOf: (assetId: string, cx: number, cy: number): number =>
        cx >= 0 && cx < 12 && cy >= 0 && cy < 12 ? 2 : 0,
    };
    const a = createTerrainField({ ...shared, familyAt: familyAtA, families: [WATER_F] });
    const b = createTerrainField({ ...shared, familyAt: familyAtB, families: [WATER_F, SUNKEN_F] });
    const wx = 5 * CELL + CELL / 2; // the drowned column's centre line
    for (let cy = 1; cy < 11; cy += 1) {
      for (const sub of [0.3, 0.5, 0.7]) {
        const wy = (cy + sub) * CELL;
        const band = a.colorAt(wx, wy)!; // the water's jittered band pick
        const drowned = b.colorAt(wx, wy)!;
        // depth 2 ⇒ tint strength 0.25 toward that same band.
        const expected = [
          Math.round(0x80 + (band[0] - 0x80) * 0.25),
          Math.round(0x80 + (band[1] - 0x80) * 0.25),
          Math.round(0x80 + (band[2] - 0x80) * 0.25),
        ];
        expect(drowned).toEqual(expected);
      }
    }
  });
});

describe("makeTintCtx", () => {
  it("remaps hex fillStyles through the tint and forwards everything else", () => {
    const { context, calls } = createRecordingContext();
    const tinted = makeTintCtx(asCtx(context), (hex) => `rgb(1, 2, 3)::${hex}`);
    tinted.fillStyle = "#4c3722";
    tinted.fillRect(1, 2, 3, 4);
    tinted.fillStyle = "red"; // non-hex passes through untouched
    expect(calls).toEqual([
      ["set:fillStyle", "rgb(1, 2, 3)::#4c3722"],
      ["fillRect", 1, 2, 3, 4],
      ["set:fillStyle", "red"],
    ]);
  });
});

describe("sunken variants are data (wiring contract)", () => {
  const IDS = ["terrain:sunken-flagstone", "terrain:sunken-stairs"] as const;

  it("every sunken id resolves to a terrain asset whose fill matches the palette base", () => {
    for (const id of IDS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id);
      expect(asset.category, id).toBe("terrain");
      expect(asset.layerKind, id).toBe("terrain");
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(asset.fill);
    }
  });

  it("carries the water containment guards: exact region, crisp edge", () => {
    for (const id of IDS) {
      const fam = VILLAGE_TERRAIN[id]!;
      expect(fam.underfill, id).toBe(false);
      expect(fam.edgeAmp, id).toBe(0);
      expect(fam.depthBands, id).toBeUndefined(); // body member, not banded
    }
  });

  it("sits between the water and the dry floors with distinct priorities", () => {
    const water = VILLAGE_TERRAIN["terrain:water"]!.priority;
    const floorMin = Math.min(
      ...Object.values(VILLAGE_TERRAIN)
        .filter((fam) => fam.floor || fam.stairs)
        .map((fam) => fam.priority),
    );
    const priorities = IDS.map((id) => VILLAGE_TERRAIN[id]!.priority);
    for (const priority of priorities) {
      expect(priority).toBeGreaterThan(water);
      expect(priority).toBeLessThan(floorMin);
    }
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("references a real, non-sunken dry sibling with a material painter, and olive algae", () => {
    for (const id of IDS) {
      const sunken = VILLAGE_TERRAIN[id]!.sunken!;
      const sibling = VILLAGE_TERRAIN[sunken.of];
      expect(sibling, id).toBeDefined();
      expect(sibling!.sunken, id).toBeUndefined(); // chains never render
      expect(sibling!.floor || sibling!.stairs, id).toBeTruthy();
      expect(sunken.algae, id).toBe("#6a7a34");
    }
  });

  it("is live-paintable: the family mapping and the toolbar list know both", () => {
    for (const id of IDS) {
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });
});
