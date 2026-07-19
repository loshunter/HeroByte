// Polar-course engine (P1–P3): each painted region of a `polar` family gets a
// point source (centre + radius) and renders as quantized radial courses —
// cones, domes, dais rings, spiral thatch as pure palette data. Pins the
// region builder, the course painter's behaviours (concentric tone, ramp,
// sun split, spiral step, joints), and the four shipped variants' wiring.

import { describe, expect, it } from "vitest";
import { floorFamilyFromAssetId, INTERIOR_FLOOR_ASSET_IDS } from "../../map-edit/mapEditFamilies";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { createTerrainField, type TerrainFieldFamily } from "../proceduralTerrain";
import { buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import type { StructuredTerrainLayer } from "../tileRenderCore";

const GRID = { size: 16, offsetX: 0, offsetY: 0 };
const CELL = GRID.size;

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

const blob = (x0: number, y0: number, w: number, h: number): [number, number][] => {
  const cells: [number, number][] = [];
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) cells.push([x, y]);
  return cells;
};

describe("point-source polar regions (P1)", () => {
  it("maps every cell of a painted blob to one shared centre + radius", () => {
    const cone = layerOf("terrain:roof-cone", blob(0, 0, 5, 5));
    const built = buildProceduralFieldConfig([cone], GRID, VILLAGE_TERRAIN)!;
    const centre = built.config.polarOf!("terrain:roof-cone", 2, 2)!;
    expect(centre.centerX).toBeCloseTo(2.5 * CELL, 6);
    expect(centre.centerY).toBeCloseTo(2.5 * CELL, 6);
    // Furthest cell centre (a corner, 2√2 cells) + half a cell.
    expect(centre.radius).toBeCloseTo(2 * Math.SQRT2 * CELL + CELL / 2, 6);
    for (const [x, y] of blob(0, 0, 5, 5)) {
      expect(built.config.polarOf!("terrain:roof-cone", x, y)).toBe(centre);
    }
  });

  it("separate blobs get separate point sources; off-family cells read null", () => {
    const cone = layerOf("terrain:roof-cone", [...blob(0, 0, 3, 3), ...blob(10, 0, 3, 3)]);
    const grass = layerOf("terrain:grass", [[5, 5]]);
    const built = buildProceduralFieldConfig([cone, grass], GRID, VILLAGE_TERRAIN)!;
    const a = built.config.polarOf!("terrain:roof-cone", 1, 1)!;
    const b = built.config.polarOf!("terrain:roof-cone", 11, 1)!;
    expect(a).not.toBe(b);
    expect(a.centerX).toBeCloseTo(1.5 * CELL, 6);
    expect(b.centerX).toBeCloseTo(11.5 * CELL, 6);
    expect(built.config.polarOf!("terrain:roof-cone", 5, 5)).toBeNull();
    expect(built.config.polarOf!("terrain:grass", 5, 5)).toBeNull(); // not a polar family
  });
});

describe("the polar course painter (P2)", () => {
  const POLAR = "terrain:test-polar";
  // A big square slab with a point source at its centre; mottle-free so every
  // colour is exact. courseWidth 1 cell, huge jointPitch ⇒ 3 joints/course.
  const family = (polar: NonNullable<TerrainFieldFamily["polar"]>): TerrainFieldFamily => ({
    assetId: POLAR,
    priority: 32,
    base: "#808080",
    rim: "#f0e0c0",
    edgeAmp: 0,
    rimWidth: 0.05,
    polar,
  });
  const REGION = { centerX: 8 * CELL, centerY: 8 * CELL, radius: 6 * CELL };
  const fieldWith = (polar: NonNullable<TerrainFieldFamily["polar"]>) =>
    createTerrainField({
      familyAt: (cx, cy) => (cx >= 0 && cx < 16 && cy >= 0 && cy < 16 ? POLAR : null),
      families: [family(polar)],
      cellSize: CELL,
      originX: 0,
      originY: 0,
      polarOf: (assetId, cx, cy) =>
        assetId === POLAR && cx >= 0 && cx < 16 && cy >= 0 && cy < 16 ? REGION : null,
    });
  // A point mid-course c at angle theta, chosen off the joint/ring seams.
  const at = (field: ReturnType<typeof createTerrainField>, course: number, theta: number) => {
    const r = (course + 0.5) * CELL;
    return field.colorAt(
      REGION.centerX + r * Math.cos(theta),
      REGION.centerY + r * Math.sin(theta),
    )!;
  };
  const sum = (c: readonly number[]): number => c[0]! + c[1]! + c[2]!;
  const FLAT = { courseWidth: 1, jointPitch: 40 };

  it("is concentric: same course, different angles, same tone (no sun/ramp)", () => {
    const field = fieldWith(FLAT);
    const reference = at(field, 2, 0.4);
    for (const theta of [0.9, 1.7, 2.6, -1.2, -2.4]) {
      expect(at(field, 2, theta)).toEqual(reference);
    }
  });

  it("ramps darker toward the eave and draws light ring seams between courses", () => {
    const field = fieldWith({ ...FLAT, ramp: 0.4 });
    expect(sum(at(field, 4, 0.4))).toBeLessThan(sum(at(field, 1, 0.4)));
    // The ring seam (just past a course boundary) mixes toward the light rim.
    const seam = field.colorAt(REGION.centerX + 2.02 * CELL, REGION.centerY)!;
    expect(sum(seam)).toBeGreaterThan(sum(at(field, 2, 0.4)));
  });

  it("sun-splits luminance toward the shared top-right light", () => {
    const field = fieldWith({ ...FLAT, sunSplit: 0.4 });
    const lit = at(field, 3, -Math.PI / 4); // toward the light
    const shade = at(field, 3, (3 * Math.PI) / 4); // away from it
    expect(sum(lit)).toBeGreaterThan(sum(shade));
  });

  it("spiral steps one course per turn (a seam line, absent without the flag)", () => {
    const flat = fieldWith(FLAT);
    const spiral = fieldWith({ ...FLAT, spiral: true });
    // Just either side of the theta = π wrap line, same radius mid-course —
    // 0.2 rad clear of the wrap so neither probe sits on joint 0's seam.
    const above = (f: ReturnType<typeof createTerrainField>) => at(f, 2, Math.PI - 0.2);
    const below = (f: ReturnType<typeof createTerrainField>) => at(f, 2, -Math.PI + 0.2);
    expect(above(flat)).toEqual(below(flat));
    expect(above(spiral)).not.toEqual(below(spiral));
  });

  it("a polar family whose cell has no region falls back to its base", () => {
    const field = createTerrainField({
      familyAt: (cx, cy) => (cx >= 0 && cx < 4 && cy >= 0 && cy < 4 ? POLAR : null),
      families: [family(FLAT)],
      cellSize: CELL,
      originX: 0,
      originY: 0,
      // No polarOf entries at all — e.g. a caller without the sampler.
      polarOf: () => null,
    });
    expect(field.colorAt(2 * CELL, 2 * CELL)).toEqual([0x80, 0x80, 0x80]);
  });
});

describe("polar variants are data (P3 wiring contract)", () => {
  const ROOF_IDS = ["terrain:roof-cone", "terrain:roof-dome", "terrain:roof-thatch-spiral"];
  const ALL_IDS = [...ROOF_IDS, "terrain:dais-stone"];

  it("every polar id resolves to a terrain asset whose fill matches the palette base", () => {
    for (const id of ALL_IDS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id);
      expect(asset.category, id).toBe("terrain");
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(asset.fill);
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });

  it("carries the polar knob with sane courses; only the spiral spirals", () => {
    for (const id of ALL_IDS) {
      const polar = VILLAGE_TERRAIN[id]!.polar!;
      expect(polar, id).toBeDefined();
      expect(polar.courseWidth, id).toBeGreaterThan(0);
      expect(polar.jointPitch, id).toBeGreaterThan(0);
      expect(VILLAGE_TERRAIN[id]!.edgeAmp, id).toBe(0);
    }
    expect(VILLAGE_TERRAIN["terrain:roof-thatch-spiral"]!.polar!.spiral).toBe(true);
    for (const id of ["terrain:roof-cone", "terrain:roof-dome", "terrain:dais-stone"]) {
      expect(VILLAGE_TERRAIN[id]!.polar!.spiral, id).toBeFalsy();
    }
  });

  it("round roofs keep the roof grammar; the dais is a protected ground ring", () => {
    const wallMax = Math.max(
      ...Object.entries(VILLAGE_TERRAIN)
        .filter(([, fam]) => fam.wall !== undefined)
        .map(([, fam]) => fam.priority),
    );
    for (const id of ROOF_IDS) {
      const fam = VILLAGE_TERRAIN[id]!;
      expect(fam.priority, id).toBeGreaterThan(wallMax);
      expect(fam.shadow, id).toBeDefined();
      expect(fam.roof, id).toBeUndefined(); // the polar field does the reading
    }
    const dais = VILLAGE_TERRAIN["terrain:dais-stone"]!;
    expect(dais.priority).toBeLessThan(20);
    expect(dais.shadow).toBeUndefined();
    expect(INTERIOR_FLOOR_ASSET_IDS.has("terrain:dais-stone")).toBe(true);
    const priorities = ALL_IDS.map((id) => VILLAGE_TERRAIN[id]!.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});
