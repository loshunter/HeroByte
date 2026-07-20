import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the heavy per-pixel bake (it needs a real 2D canvas) so we can count
// exactly when it runs, and stub the palette so field-membership is fixed.
const { bakeSpy } = vi.hoisted(() => ({ bakeSpy: vi.fn() }));
vi.mock("../../../render/proceduralTerrainSurface", () => ({
  bakeProceduralTerrain: bakeSpy,
}));
vi.mock("../../../render/terrainPalette", () => ({
  // grass/dirt are field families; water is deliberately absent (a core family).
  // pond/drowned model the water BODY (depth-banded water + sunken sibling)
  // for the shimmer and body-membership tests.
  VILLAGE_TERRAIN: {
    "terrain:grass": {},
    "terrain:dirt": {},
    "terrain:pond": { depthBands: [{ maxCells: 2, base: "#204060" }] },
    "terrain:drowned": { sunken: { of: "terrain:grass" } },
  },
  VILLAGE_SHADOW_TINT: "#3a2f45",
}));

import {
  createFieldBakeCache,
  getFieldBake,
  coreTerrainLayers,
  blitFieldBake,
  drawWaterShimmer,
  waterBodyLayers,
} from "../terrainBake";
import type { StructuredTerrainLayer } from "../../../render/tileRenderCore";

const layer = (assetId: string): StructuredTerrainLayer => ({ assetId, cells: [], edges: [] });
const grass = layer("terrain:grass");
const dirt = layer("terrain:dirt");
const water = layer("terrain:water");
const grid = { size: 50, offsetX: 0, offsetY: 0 };

const BAKED = { canvas: {} as HTMLCanvasElement, originX: 3, originY: 5, width: 4, height: 6 };

beforeEach(() => {
  bakeSpy.mockReset();
  bakeSpy.mockReturnValue(BAKED);
});

describe("getFieldBake", () => {
  it("bakes once, then serves the cached canvas without re-baking", () => {
    const cache = createFieldBakeCache();
    const layers = [grass];
    const first = getFieldBake(cache, layers, grid);
    const second = getFieldBake(cache, layers, grid);
    expect(first).toBe(BAKED);
    expect(second).toBe(BAKED);
    expect(bakeSpy).toHaveBeenCalledTimes(1);
    // The live bake carries the village shadow tint (cool-hue shadows) — the
    // export path (rasterUnderlay) passes the same constant, so they agree.
    expect(bakeSpy.mock.calls[0]![0]).toMatchObject({ shadowTint: "#3a2f45" });
  });

  it("re-bakes when the layers identity changes (a terrain edit)", () => {
    const cache = createFieldBakeCache();
    getFieldBake(cache, [grass], grid);
    getFieldBake(cache, [grass, dirt], grid); // new array → terrain changed
    expect(bakeSpy).toHaveBeenCalledTimes(2);
  });

  it("re-bakes when the grid signature changes", () => {
    const cache = createFieldBakeCache();
    const layers = [grass];
    getFieldBake(cache, layers, { size: 50, offsetX: 0, offsetY: 0 });
    getFieldBake(cache, layers, { size: 64, offsetX: 0, offsetY: 0 });
    expect(bakeSpy).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-bake for a fresh grid object with identical values", () => {
    // A per-snapshot re-parse yields a new grid object each broadcast; the
    // signature is by VALUE so byte-identical terrain never re-bakes.
    const cache = createFieldBakeCache();
    const layers = [grass];
    getFieldBake(cache, layers, { size: 50, offsetX: 0, offsetY: 0 });
    getFieldBake(cache, layers, { size: 50, offsetX: 0, offsetY: 0 });
    expect(bakeSpy).toHaveBeenCalledTimes(1);
  });

  it("passes the palette-driven field bake through null (no field / too large)", () => {
    bakeSpy.mockReturnValue(null);
    const cache = createFieldBakeCache();
    expect(getFieldBake(cache, [water], grid)).toBeNull();
  });

  it("re-bakes when the lighting VALUE changes, not for a fresh identical object", () => {
    const cache = createFieldBakeCache();
    const layers = [grass];
    const dusk = { ambient: 0.6, lights: [] };
    getFieldBake(cache, layers, grid, dusk);
    getFieldBake(cache, layers, grid, { ambient: 0.6, lights: [] }); // same value, new object
    expect(bakeSpy).toHaveBeenCalledTimes(1);
    getFieldBake(cache, layers, grid, { ambient: 0.3, lights: [] }); // darker night
    expect(bakeSpy).toHaveBeenCalledTimes(2);
  });
});

describe("coreTerrainLayers", () => {
  it("drops field families when the field baked (they live in the blit)", () => {
    expect(coreTerrainLayers([grass, dirt, water], BAKED)).toEqual([water]);
  });

  it("keeps ALL families when the bake fell back to null", () => {
    expect(coreTerrainLayers([grass, water], null)).toEqual([grass, water]);
  });
});

describe("waterBodyLayers", () => {
  it("keeps the depth-banded water and its sunken siblings, nothing else", () => {
    const pond = layer("terrain:pond");
    const drowned = layer("terrain:drowned");
    const upload = layer("upload:abc123");
    expect(waterBodyLayers([grass, pond, drowned, upload, dirt])).toEqual([pond, drowned]);
  });
});

describe("drawWaterShimmer", () => {
  const SIZE = 50;
  const cellAt = (cellX: number, cellY: number) => ({
    x: cellX * SIZE,
    y: cellY * SIZE,
    size: SIZE,
    cellX,
    cellY,
  });
  // A 3×3 pond at cells (1..3)²: only the centre (2,2) is interior.
  const pond = (skip?: string): StructuredTerrainLayer => ({
    assetId: "terrain:pond",
    cells: [1, 2, 3].flatMap((cy) =>
      [1, 2, 3].filter((cx) => `${cx},${cy}` !== skip).map((cx) => cellAt(cx, cy)),
    ),
    edges: [],
  });
  const frames = ["#24516b", "#295a76", "#2a5f7c", "#245572"];

  function recordingCtx() {
    const rects: unknown[][] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: "",
      fillRect: (...args: unknown[]) => rects.push([ctx.globalAlpha, ctx.fillStyle, ...args]),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, raw: ctx };
  }

  it("washes only interior body cells with the frame colour at low alpha", () => {
    const { ctx, rects } = recordingCtx();
    drawWaterShimmer(ctx, [pond()], frames, 2);
    expect(rects).toEqual([[0.12, "#2a5f7c", 100, 100, 50, 50]]);
  });

  it("treats drowned structures as body: the wash crosses them instead of holing", () => {
    // The pond's centre cell is a drowned slab. The slab is interior (all 8
    // neighbours are body), so it washes — the old same-assetId mask read it
    // as shore and left a static hole (confirmed review finding).
    const { ctx, rects } = recordingCtx();
    const drowned: StructuredTerrainLayer = {
      assetId: "terrain:drowned",
      cells: [cellAt(2, 2)],
      edges: [],
    };
    drawWaterShimmer(ctx, [pond("2,2"), drowned], frames, 2);
    expect(rects).toEqual([[0.12, "#2a5f7c", 100, 100, 50, 50]]);
  });

  it("draws nothing on frame 0 so reduced motion and stills read the pure bake", () => {
    const { ctx, rects } = recordingCtx();
    drawWaterShimmer(ctx, [pond()], frames, 0);
    expect(rects).toEqual([]);
  });

  it("restores the caller's globalAlpha", () => {
    const { ctx, raw } = recordingCtx();
    raw.globalAlpha = 0.7;
    drawWaterShimmer(ctx, [pond()], frames, 1);
    expect(raw.globalAlpha).toBe(0.7);
  });
});

describe("blitFieldBake", () => {
  it("blits at the bake origin with smoothing off, then restores smoothing", () => {
    let smoothingDuringDraw: boolean | undefined;
    const drawArgs: unknown[] = [];
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage: (...args: unknown[]) => {
        smoothingDuringDraw = ctx.imageSmoothingEnabled;
        drawArgs.push(...args);
      },
    } as unknown as CanvasRenderingContext2D;

    blitFieldBake(ctx, BAKED);

    expect(smoothingDuringDraw).toBe(false); // crisp pixels during the blit
    expect(ctx.imageSmoothingEnabled).toBe(true); // caller's setting restored
    expect(drawArgs).toEqual([BAKED.canvas, 0, 0, 4, 6, 3, 5, 4, 6]);
  });
});
