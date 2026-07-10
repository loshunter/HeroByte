import { describe, expect, it, vi } from "vitest";
import { createTerrainField } from "../proceduralTerrain";
import {
  bakeProceduralTerrain,
  buildProceduralFieldConfig,
  makeClipCtx,
  paintProceduralDetail,
} from "../proceduralTerrainSurface";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import type { StructuredTerrainLayer, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext } from "./recordingContext";

const GRID = { size: 16, offsetX: 0, offsetY: 0 };
const DIRT_KC = VILLAGE_TERRAIN["terrain:dirt"]!.keyCluster!;

const cell = (cellX: number, cellY: number) => ({
  x: cellX * GRID.size,
  y: cellY * GRID.size,
  size: GRID.size,
  cellX,
  cellY,
});
const layer = (
  assetId: string,
  cells: { cellX: number; cellY: number }[],
): StructuredTerrainLayer => ({
  assetId,
  cells: cells.map((c) => cell(c.cellX, c.cellY)),
  edges: [],
});
const asCtx = (context: unknown) => context as unknown as TileRenderContext2D;

describe("buildProceduralFieldConfig", () => {
  it("returns null when no field families are painted", () => {
    // Water stays a non-field family (animated, drawn on the core); floors now
    // ride the field, so water is the canonical non-field stand-in here.
    const water = layer("terrain:water", [{ cellX: 0, cellY: 0 }]);
    expect(buildProceduralFieldConfig([water], GRID, VILLAGE_TERRAIN)).toBeNull();
  });

  it("treats wood/stone floors as crisp field families (procedural repaint)", () => {
    const stone = layer("terrain:stone-floor", [{ cellX: 0, cellY: 0 }]);
    const wood = layer("terrain:wood-floor", [{ cellX: 1, cellY: 0 }]);
    const built = buildProceduralFieldConfig([stone, wood], GRID, VILLAGE_TERRAIN);
    expect(built).not.toBeNull();
    const { config } = built!;
    expect(config.familyAt(0, 0)).toBe("terrain:stone-floor");
    expect(config.familyAt(1, 0)).toBe("terrain:wood-floor");
    expect(config.families.map((f) => f.assetId).sort()).toEqual([
      "terrain:stone-floor",
      "terrain:wood-floor",
    ]);
    // Floors carry a near-zero edge amplitude so their boundaries stay crisp
    // (architectural), unlike the organic grass/dirt/path field.
    for (const fam of config.families) expect(fam.edgeAmp).toBe(0);
  });

  it("frames the painted cells with a one-cell bleed margin and a familyAt lookup", () => {
    const grass = layer("terrain:grass", [{ cellX: 2, cellY: 3 }]);
    const built = buildProceduralFieldConfig([grass], GRID, VILLAGE_TERRAIN);
    expect(built).not.toBeNull();
    const { config, width, height } = built!;
    expect(config.originX).toBe(16); // (2 - 1 margin) * 16
    expect(config.originY).toBe(32); // (3 - 1 margin) * 16
    expect(width).toBe(48); // cells 1..3 inclusive
    expect(height).toBe(48);
    expect(config.offsetX).toBe(0);
    expect(config.familyAt(2, 3)).toBe("terrain:grass");
    expect(config.familyAt(0, 0)).toBeNull();
    expect(config.families.map((f) => f.assetId)).toEqual(["terrain:grass"]);
  });

  it("carries the grid offset into the field config origin and offset", () => {
    const grass = layer("terrain:grass", [{ cellX: 0, cellY: 0 }]);
    const built = buildProceduralFieldConfig(
      [grass],
      { size: 16, offsetX: 100, offsetY: 40 },
      VILLAGE_TERRAIN,
    )!;
    expect(built.config.offsetX).toBe(100);
    expect(built.config.originX).toBe(100 - 16); // offset + (0 - margin) * size
    expect(built.config.originY).toBe(40 - 16);
  });

  it("ignores non-field families while keeping field ones", () => {
    const grass = layer("terrain:grass", [{ cellX: 0, cellY: 0 }]);
    const water = layer("terrain:water", [{ cellX: 1, cellY: 0 }]);
    const built = buildProceduralFieldConfig([grass, water], GRID, VILLAGE_TERRAIN)!;
    expect(built.config.familyAt(0, 0)).toBe("terrain:grass");
    expect(built.config.familyAt(1, 0)).toBeNull(); // water excluded from the field
    expect(built.config.families.map((f) => f.assetId)).toEqual(["terrain:grass"]);
  });
});

describe("bakeProceduralTerrain", () => {
  it("returns null without baking when there are no field families", () => {
    const water = layer("terrain:water", [{ cellX: 0, cellY: 0 }]);
    expect(
      bakeProceduralTerrain({ terrainLayers: [water], grid: GRID, palette: VILLAGE_TERRAIN }),
    ).toBeNull();
  });

  it("caps oversized fields: returns null and warns instead of throwing/blanking", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Two far-apart cells inflate the bbox past the cap; the bake must bail
    // BEFORE allocating a multi-gigabyte buffer or an over-max canvas.
    const grass = layer("terrain:grass", [
      { cellX: 0, cellY: 0 },
      { cellX: 900, cellY: 900 },
    ]);
    let result: unknown;
    expect(() => {
      result = bakeProceduralTerrain({
        terrainLayers: [grass],
        grid: { size: 32, offsetX: 0, offsetY: 0 },
        palette: VILLAGE_TERRAIN,
      });
    }).not.toThrow();
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("makeClipCtx", () => {
  it("forwards only fillRects whose centre passes the predicate, preserving fillStyle", () => {
    const { context, calls } = createRecordingContext();
    const clip = makeClipCtx(asCtx(context), (wx) => wx < 50);
    clip.fillStyle = "#123456";
    clip.fillRect(10, 10, 4, 4); // centre x=12 → kept
    clip.fillRect(100, 10, 4, 4); // centre x=102 → dropped
    expect(calls).toContainEqual(["set:fillStyle", "#123456"]);
    expect(calls).toContainEqual(["fillRect", 10, 10, 4, 4]);
    expect(calls).not.toContainEqual(["fillRect", 100, 10, 4, 4]);
  });
});

describe("paintProceduralDetail", () => {
  it("no-ops for empty field layers", () => {
    const { context, calls } = createRecordingContext();
    paintProceduralDetail(
      asCtx(context),
      [],
      VILLAGE_TERRAIN,
      createTerrainField(
        buildProceduralFieldConfig(
          [layer("terrain:grass", [{ cellX: 0, cellY: 0 }])],
          GRID,
          VILLAGE_TERRAIN,
        )!.config,
      ),
      () => null,
    );
    expect(calls.some(([op]) => op === "fillRect")).toBe(false);
  });

  it("decorates a solid grass block but adds no dirt underfill without a lower neighbour", () => {
    const grass = layer("terrain:grass", [
      { cellX: 0, cellY: 0 },
      { cellX: 1, cellY: 0 },
      { cellX: 0, cellY: 1 },
      { cellX: 1, cellY: 1 },
    ]);
    const built = buildProceduralFieldConfig([grass], GRID, VILLAGE_TERRAIN)!;
    const field = createTerrainField(built.config);
    const { context, calls } = createRecordingContext();
    paintProceduralDetail(asCtx(context), [grass], VILLAGE_TERRAIN, field, built.config.familyAt);
    // grass detail ran (blades/flowers are fillRects)
    expect(calls.some(([op]) => op === "fillRect")).toBe(true);
    // no dirt pebble shades: all-grass, so no lower family to underfill
    const dirtShades = [DIRT_KC.crev, DIRT_KC.dark, DIRT_KC.mid, DIRT_KC.light];
    expect(calls.some((c) => c[0] === "set:fillStyle" && dirtShades.includes(c[1] as string))).toBe(
      false,
    );
  });

  it("paints the dirt family's key-cluster shades where grass meets dirt", () => {
    const grass = layer("terrain:grass", [{ cellX: 1, cellY: 0 }]);
    const dirt = layer("terrain:dirt", [{ cellX: 0, cellY: 0 }]);
    const built = buildProceduralFieldConfig([grass, dirt], GRID, VILLAGE_TERRAIN)!;
    const field = createTerrainField(built.config);
    const { context, calls } = createRecordingContext();
    paintProceduralDetail(
      asCtx(context),
      [grass, dirt],
      VILLAGE_TERRAIN,
      field,
      built.config.familyAt,
    );
    const dirtShades = [DIRT_KC.crev, DIRT_KC.dark, DIRT_KC.mid, DIRT_KC.light];
    expect(calls.some((c) => c[0] === "set:fillStyle" && dirtShades.includes(c[1] as string))).toBe(
      true,
    );
  });
});
