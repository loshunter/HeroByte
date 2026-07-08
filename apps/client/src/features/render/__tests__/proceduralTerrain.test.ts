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
