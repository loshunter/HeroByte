import { describe, expect, it } from "vitest";
import {
  createTerrainField,
  renderTerrainField,
  TERRAIN_RIM,
  type TerrainFieldConfig,
  type TerrainFieldFamily,
} from "../proceduralTerrain";

const GRASS = "terrain:grass";
const DIRT = "terrain:dirt";
const GRASS_BASE = "#7cb04a";
const DIRT_BASE = "#60482e";

const FAMILIES: TerrainFieldFamily[] = [
  { assetId: "terrain:path", priority: 1, base: "#565338", rim: "#3f3d28" },
  { assetId: DIRT, priority: 2, base: DIRT_BASE, rim: "#4a3420" },
  { assetId: GRASS, priority: 3, base: GRASS_BASE, rim: "#4a764e" },
];
const CELL = 16;

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const fill = (cols: number, rows: number, fam: string | null): (string | null)[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => fam));

function render(rows: (string | null)[][], families = FAMILIES) {
  const w = rows[0]!.length * CELL;
  const h = rows.length * CELL;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const familyAt = (cx: number, cy: number): string | null =>
    cy >= 0 && cy < rows.length && cx >= 0 && cx < rows[0]!.length ? rows[cy]![cx]! : null;
  renderTerrainField(pixels, w, h, { familyAt, families, cellSize: CELL, originX: 0, originY: 0 });
  return { pixels, w, h };
}
const px = (r: { pixels: Uint8ClampedArray; w: number }, x: number, y: number): number[] => {
  const o = (y * r.w + x) * 4;
  return [r.pixels[o]!, r.pixels[o + 1]!, r.pixels[o + 2]!, r.pixels[o + 3]!];
};
const isRgb = (p: number[], hex: string): boolean => {
  const [r, g, b] = hexToRgb(hex);
  return p[0] === r && p[1] === g && p[2] === b && p[3] === 255;
};
const center = (cell: number): number => cell * CELL + CELL / 2;

describe("renderTerrainField", () => {
  it("paints a solid grass interior as the grass base colour", () => {
    const r = render(fill(6, 6, GRASS));
    expect(isRgb(px(r, center(3), center(3)), GRASS_BASE)).toBe(true);
  });

  it("leaves empty (no family) pixels transparent", () => {
    const r = render(fill(4, 4, null));
    expect(px(r, center(2), center(2))[3]).toBe(0);
  });

  it("has no holes or spurious rim deep inside solid grass (prox confines bumps to edges)", () => {
    const r = render(fill(8, 8, GRASS));
    for (let y = 3 * CELL; y < 5 * CELL; y += 1) {
      for (let x = 3 * CELL; x < 5 * CELL; x += 1) {
        const p = px(r, x, y);
        expect(p[3]).toBe(255); // never a hole
        expect(isRgb(p, GRASS_BASE)).toBe(true); // never spurious rim/dirt
      }
    }
  });

  it("is deterministic for identical input", () => {
    const rows = fill(5, 5, GRASS).map((row) => row.map((_, cx) => (cx === 2 ? DIRT : GRASS)));
    const a = render(rows);
    const b = render(rows);
    expect(Array.from(a.pixels)).toEqual(Array.from(b.pixels));
  });

  it("is palette-driven — swapping the grass base recolours the interior", () => {
    const alt = FAMILIES.map((f) => (f.assetId === GRASS ? { ...f, base: "#ff00ff" } : f));
    const r = render(fill(6, 6, GRASS), alt);
    expect(isRgb(px(r, center(3), center(3)), "#ff00ff")).toBe(true);
  });

  it("rounds grass over dirt with an underfilled, bumpy seam", () => {
    const rows = Array.from({ length: 6 }, () => [
      GRASS,
      GRASS,
      GRASS,
      GRASS,
      DIRT,
      DIRT,
      DIRT,
      DIRT,
    ]);
    const r = render(rows);
    // Underfill: the whole boundary band is opaque — grass's receded edge reveals
    // dirt beneath, never the transparent background.
    let sawDirt = false;
    for (let cy = 0; cy < 6; cy += 1) {
      for (let x = 3 * CELL; x < 6 * CELL; x += 1) {
        const p = px(r, x, center(cy));
        expect(p[3]).toBe(255);
        if (isRgb(p, DIRT_BASE)) sawDirt = true;
      }
    }
    expect(sawDirt).toBe(true);
    // Bumpy: the grass→dirt crossover x is not the same on every row.
    const crossover = (yy: number): number => {
      let x = 3 * CELL;
      while (x < 6 * CELL && isRgb(px(r, x, yy), GRASS_BASE)) x += 1;
      return x;
    };
    const xs = new Set<number>();
    for (let cy = 0; cy < 6; cy += 1) xs.add(crossover(center(cy)));
    expect(xs.size).toBeGreaterThan(1);
  });
});

describe("createTerrainField", () => {
  const configFor = (
    rows: (string | null)[][],
    families = FAMILIES,
    offsetX = 0,
    offsetY = 0,
  ): TerrainFieldConfig => ({
    familyAt: (cx: number, cy: number): string | null =>
      cy >= 0 && cy < rows.length && cx >= 0 && cx < rows[0]!.length ? rows[cy]![cx]! : null,
    families,
    cellSize: CELL,
    originX: 0,
    originY: 0,
    offsetX,
    offsetY,
  });

  it("colorAt reproduces renderTerrainField pixel-for-pixel (one field impl)", () => {
    // grass ⟵→ dirt seam exercises base, rim, underfill and cast shadow.
    const rows = Array.from({ length: 6 }, () =>
      [GRASS, GRASS, GRASS, GRASS, DIRT, DIRT, DIRT, DIRT].slice(),
    );
    const field = createTerrainField(configFor(rows));
    const r = render(rows);
    for (let y = 0; y < r.h; y += 3) {
      for (let x = 0; x < r.w; x += 3) {
        const c = field.colorAt(x + 0.5, y + 0.5);
        const p = px(r, x, y);
        if (c === null) expect(p[3]).toBe(0);
        else expect([c[0], c[1], c[2], 255]).toEqual(p);
      }
    }
  });

  it("sampleField is well inside a family's interior and negative outside it", () => {
    const field = createTerrainField(configFor(fill(6, 6, GRASS)));
    // deep interior: base 1 ⇒ field ≈ 0.5, comfortably past the rim band.
    expect(field.sampleField(GRASS, center(3), center(3))).toBeGreaterThanOrEqual(TERRAIN_RIM);
    // far outside the painted area ⇒ negative (this family absent).
    expect(field.sampleField(GRASS, 40 * CELL, 40 * CELL)).toBeLessThan(0);
    // an unknown family id samples as absent, never throws.
    expect(field.sampleField("terrain:nope", center(3), center(3))).toBeLessThan(0);
  });

  it("honours the grid offset when mapping world coords to cells", () => {
    // Cells 0..3 painted, lattice shifted right by 100 world px.
    const field = createTerrainField(configFor(fill(4, 4, GRASS), FAMILIES, 100, 0));
    // Centre of cell 1 in the offset lattice is painted grass.
    expect(field.colorAt(100 + 1.5 * CELL, 1.5 * CELL)).not.toBeNull();
    // World x=5 falls left of the offset origin ⇒ off the painted lattice.
    expect(field.colorAt(5, 1.5 * CELL)).toBeNull();
  });
});

// A floor is architectural: its boundary must stay STRAIGHT, unlike the organic
// grass/dirt/path field. A per-family `edgeAmp` scales the boundary displacement
// (default 1 = today's bumpy edges; 0 = crisp). Floor sits above grass in
// priority so it draws over natural terrain with its own crisp edge.
// A wall reads TALL through two per-family knobs: a THIN rim (inked outline
// instead of a wide bevel) and a DARKER cast shadow (strength only — band and
// probe stay shared, so the shadow deepens without widening). Families without
// the overrides keep the shipped defaults bit-for-bit.
describe("per-family rim width and cast shadow (walls read tall)", () => {
  const WALL = "terrain:wall-stone";
  const WALL_BASE = "#b3a687";
  const wallFamily = (overrides: Partial<TerrainFieldFamily>): TerrainFieldFamily => ({
    assetId: WALL,
    priority: 20,
    base: WALL_BASE,
    rim: "#4e4638",
    edgeAmp: 0,
    ...overrides,
  });
  // Grass on the left, a wall slab on the right; the wall shadows the grass
  // on its lower-left (light is top-right).
  const grassWallRows = (): (string | null)[][] =>
    Array.from({ length: 6 }, () => [GRASS, GRASS, GRASS, GRASS, WALL, WALL, WALL, WALL].slice());
  const grassZoneSum = (r: { pixels: Uint8ClampedArray; w: number }): number => {
    let sum = 0;
    for (let cy = 1; cy < 5; cy += 1) {
      for (let x = 2 * CELL; x < 4 * CELL; x += 1) {
        const p = px(r, x, center(cy));
        sum += p[0]! + p[1]! + p[2]!;
      }
    }
    return sum;
  };
  const rimPixelCount = (r: { pixels: Uint8ClampedArray; w: number }): number => {
    let count = 0;
    for (let cy = 1; cy < 5; cy += 1) {
      for (let x = 4 * CELL; x < 6 * CELL; x += 1) {
        if (isRgb(px(r, x, center(cy)), "#4e4638")) count += 1;
      }
    }
    return count;
  };

  it("a shadow-strength override darkens the bordered family more than the default", () => {
    const plain = render(grassWallRows(), [...FAMILIES, wallFamily({})]);
    const deep = render(grassWallRows(), [
      ...FAMILIES,
      wallFamily({ shadow: { band: 0.34, strength: 0.3 } }),
    ]);
    expect(grassZoneSum(deep)).toBeLessThan(grassZoneSum(plain));
  });

  it("a thin rimWidth narrows the rim band to an outline", () => {
    const plain = render(grassWallRows(), [...FAMILIES, wallFamily({})]);
    const thin = render(grassWallRows(), [...FAMILIES, wallFamily({ rimWidth: 0.055 })]);
    const plainRim = rimPixelCount(plain);
    const thinRim = rimPixelCount(thin);
    expect(plainRim).toBeGreaterThan(0);
    expect(thinRim).toBeGreaterThan(0);
    expect(thinRim).toBeLessThan(plainRim);
  });
});

// Czepeku catalog #1: low-frequency tonal clouds one octave below the cell
// detail. Interior pixels of a mottled family vary around the base; families
// without the knob keep the flat base bit-for-bit (pinned by the solid-grass
// interior test above, which runs on a mottle-free family).
describe("per-family value-noise mottle", () => {
  const MOTTLED = "terrain:mottled";
  const mottledFamily: TerrainFieldFamily = {
    assetId: MOTTLED,
    priority: 4,
    base: "#808080",
    rim: "#404040",
    edgeAmp: 0,
    mottle: { amp: 0.08, scale: 3 },
  };

  it("varies interior pixels around the base within the amplitude", () => {
    const rows = fill(12, 12, MOTTLED);
    const r = render(rows, [...FAMILIES, mottledFamily]);
    const seen = new Set<string>();
    let min = 255;
    let max = 0;
    for (let cy = 3; cy < 9; cy += 1) {
      for (let cx = 3; cx < 9; cx += 1) {
        const p = px(r, center(cx), center(cy));
        expect(p[3]).toBe(255);
        seen.add(p.slice(0, 3).join(","));
        min = Math.min(min, p[1]!);
        max = Math.max(max, p[1]!);
      }
    }
    // Clouds exist (several distinct tones) and stay near the base value
    // (0x80 = 128; ±8% ≈ ±10, with rounding slack).
    expect(seen.size).toBeGreaterThan(3);
    expect(min).toBeGreaterThanOrEqual(128 - 12);
    expect(max).toBeLessThanOrEqual(128 + 12);
    expect(max - min).toBeGreaterThan(2);
  });

  it("`cool` shifts dark patches cool and light patches warm", () => {
    const rows = fill(12, 12, MOTTLED);
    const r = render(rows, [
      ...FAMILIES,
      { ...mottledFamily, mottle: { amp: 0.08, scale: 3, cool: 1 } },
    ]);
    for (let cy = 3; cy < 9; cy += 1) {
      for (let cx = 3; cx < 9; cx += 1) {
        const [red, green, blue] = px(r, center(cx), center(cy));
        // Grey base: darkened pixels must lose more red than blue (cool),
        // lightened pixels gain more red than blue (warm).
        if (green! < 128) expect(red!).toBeLessThanOrEqual(blue!);
        if (green! > 128) expect(red!).toBeGreaterThanOrEqual(blue!);
      }
    }
  });
});

// Czepeku catalog #2: water colour is shore distance, not position. Shallow
// band at the pool edge, deepest band in the middle, land untouched.
describe("shore-distance depth bands", () => {
  const WATER = "terrain:test-water";
  const waterFamily: TerrainFieldFamily = {
    assetId: WATER,
    priority: 3.5,
    base: "#204060",
    rim: "#a0e0e0",
    edgeAmp: 0,
    rimWidth: 0.05,
    depthBands: [
      { maxCells: 2.5, base: "#60a0b0" },
      { maxCells: 4.5, base: "#204060" },
    ],
  };
  // A 14x14 pool inside a grass shore; cell depths mirror the Chebyshev
  // distance transform (min distance to the pool edge + 1).
  const POOL = { x0: 3, y0: 3, w: 14, h: 14 };
  const rows = (): (string | null)[][] =>
    Array.from({ length: 20 }, (_, cy) =>
      Array.from({ length: 20 }, (_, cx) =>
        cx >= POOL.x0 && cx < POOL.x0 + POOL.w && cy >= POOL.y0 && cy < POOL.y0 + POOL.h
          ? WATER
          : GRASS,
      ),
    );
  const depthOf = (assetId: string, cx: number, cy: number): number => {
    if (assetId !== WATER) return 0;
    if (cx < POOL.x0 || cx >= POOL.x0 + POOL.w || cy < POOL.y0 || cy >= POOL.y0 + POOL.h) {
      return 0;
    }
    const dx = Math.min(cx - POOL.x0, POOL.x0 + POOL.w - 1 - cx);
    const dy = Math.min(cy - POOL.y0, POOL.y0 + POOL.h - 1 - cy);
    return Math.min(dx, dy) + 1;
  };

  function poolField() {
    const grid = rows();
    return createTerrainField({
      familyAt: (cx, cy) =>
        cy >= 0 && cy < grid.length && cx >= 0 && cx < grid[0]!.length ? grid[cy]![cx]! : null,
      families: [...FAMILIES, waterFamily],
      cellSize: CELL,
      originX: 0,
      originY: 0,
      depthOf,
    });
  }

  const lumaOf = (rgb: readonly number[]): number =>
    0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;

  it("shallow shore water is lighter than the deep centre, which reads the deepest band", () => {
    const field = poolField();
    // Shore-adjacent water cell centre (d=1; band jitter cannot reach the 2.5
    // threshold) vs the pool centre (d=7; beyond every band + jitter).
    const shore = field.colorAt(center(POOL.x0 + 1), center(POOL.y0 + 6))!;
    const deep = field.colorAt(center(POOL.x0 + 7), center(POOL.y0 + 7))!;
    expect(lumaOf(shore)).toBeGreaterThan(lumaOf(deep));
    expect(deep).toEqual([0x20, 0x40, 0x60]); // the last band extends inward
  });

  it("does not band the bordering land", () => {
    const field = poolField();
    const grass = field.colorAt(center(1), center(10))!;
    expect(grass).toEqual([0x7c, 0xb0, 0x4a]); // grass base, untouched
  });
});

// Water containment (found by review probe): an exact-indicator family must
// never appear where it is not painted. With the default union indicator a
// distant floor/wall region counts as "water or above", so a map with ANY pond
// would grow a phantom water fringe around every building's crisp edge.
describe("exact-indicator water containment (underfill: false)", () => {
  const WATER = "terrain:test-water";
  const FLOOR = "terrain:stone-floor";
  const waterFamily = (underfill: boolean | undefined): TerrainFieldFamily => ({
    assetId: WATER,
    priority: 3.5,
    base: "#204060",
    rim: "#a0e0e0",
    edgeAmp: 0.8,
    ...(underfill === undefined ? {} : { underfill }),
  });
  // 20x20 grass; a 4x4 crisp floor block at (10..13)²; a 2x2 pond far away.
  const familyAt = (cx: number, cy: number): string | null => {
    if (cx < 0 || cy < 0 || cx >= 20 || cy >= 20) return null;
    if (cx >= 10 && cx <= 13 && cy >= 10 && cy <= 13) return FLOOR;
    if (cx >= 2 && cx <= 3 && cy >= 2 && cy <= 3) return WATER;
    return GRASS;
  };
  const fieldWith = (underfill: boolean | undefined) =>
    createTerrainField({
      familyAt,
      families: [
        ...FAMILIES,
        { assetId: FLOOR, priority: 4, base: "#4d5361", rim: "#3d424e", edgeAmp: 0 },
        waterFamily(underfill),
      ],
      cellSize: CELL,
      originX: 0,
      originY: 0,
    });
  const leaksAroundFloor = (field: ReturnType<typeof createTerrainField>): number => {
    let leaks = 0;
    // A one-cell-wide band just outside the floor block's left edge, far from
    // the pond: water must sample negative everywhere here.
    for (let wy = 10 * CELL; wy < 14 * CELL; wy += 2) {
      for (let wx = 9 * CELL; wx < 10 * CELL; wx += 2) {
        if (field.sampleField(WATER, wx + 0.5, wy + 0.5) >= 0) leaks += 1;
      }
    }
    return leaks;
  };

  it("underfill: false confines water to its painted cells", () => {
    expect(leaksAroundFloor(fieldWith(false))).toBe(0);
  });

  it("the union default DOES leak here — proving the flag is the guard", () => {
    // Documents why water must opt out: if this stops leaking, the union
    // semantics changed and the flag may be removable.
    expect(leaksAroundFloor(fieldWith(undefined))).toBeGreaterThan(0);
  });

  it("extend-only bumps: water never recedes inside its own cells against a crisp neighbour", () => {
    // Pond cell centres must ALWAYS be water (no receding bumps), so a crisp
    // dock laid beside water can never expose a transparent seam.
    const field = fieldWith(false);
    for (let cy = 2; cy <= 3; cy += 1) {
      for (let cx = 2; cx <= 3; cx += 1) {
        expect(field.sampleField(WATER, center(cx), center(cy))).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("per-family edge amplitude (crisp floors)", () => {
  const FLOOR = "terrain:stone-floor";
  const FLOOR_BASE = "#4d5361";
  const floorFamily = (edgeAmp?: number): TerrainFieldFamily => ({
    assetId: FLOOR,
    priority: 4,
    base: FLOOR_BASE,
    rim: "#3d424e",
    ...(edgeAmp === undefined ? {} : { edgeAmp }),
  });
  // Left half floor, right half grass; measure where the floor base ends per
  // interior row (rows 1..4 avoid top/bottom corner rounding).
  const floorGrassRows = (): (string | null)[][] =>
    Array.from({ length: 6 }, () =>
      [FLOOR, FLOOR, FLOOR, FLOOR, GRASS, GRASS, GRASS, GRASS].slice(),
    );
  const crossovers = (r: { pixels: Uint8ClampedArray; w: number }): Set<number> => {
    const crossover = (yy: number): number => {
      let x = 3 * CELL;
      while (x < 6 * CELL && isRgb(px(r, x, yy), FLOOR_BASE)) x += 1;
      return x;
    };
    const xs = new Set<number>();
    for (let cy = 1; cy < 5; cy += 1) xs.add(crossover(center(cy)));
    return xs;
  };

  it("edgeAmp 0 gives a straight, grid-aligned seam on every row", () => {
    const r = render(floorGrassRows(), [...FAMILIES, floorFamily(0)]);
    // No boundary displacement: the floor→grass crossover x is identical row to row.
    expect(crossovers(r).size).toBe(1);
  });

  it("the same family without edgeAmp keeps the bumpy default seam", () => {
    const r = render(floorGrassRows(), [...FAMILIES, floorFamily(undefined)]);
    // Default (undefined ⇒ amplitude 1) still displaces the boundary, so the
    // crossover x varies row to row — proving edgeAmp, not priority, is the hook.
    expect(crossovers(r).size).toBeGreaterThan(1);
  });
});
