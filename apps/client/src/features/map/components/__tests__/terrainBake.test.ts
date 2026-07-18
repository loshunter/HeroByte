import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the heavy per-pixel bake (it needs a real 2D canvas) so we can count
// exactly when it runs, and stub the palette so field-membership is fixed.
const { bakeSpy } = vi.hoisted(() => ({ bakeSpy: vi.fn() }));
vi.mock("../../../render/proceduralTerrainSurface", () => ({
  bakeProceduralTerrain: bakeSpy,
}));
vi.mock("../../../render/terrainPalette", () => ({
  // grass/dirt are field families; water is deliberately absent (a core family).
  VILLAGE_TERRAIN: { "terrain:grass": {}, "terrain:dirt": {} },
}));

import {
  createFieldBakeCache,
  getFieldBake,
  coreTerrainLayers,
  blitFieldBake,
  drawWaterShimmer,
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

describe("drawWaterShimmer", () => {
  const shimmerLayer: StructuredTerrainLayer = {
    assetId: "terrain:water",
    cells: [
      // Interior cell (all 8 neighbours water) — shimmers.
      { x: 100, y: 100, size: 50, cellX: 2, cellY: 2, neighborMask: 255 },
      // Shore cell — must NOT shimmer (square tint edges over the organic bake).
      { x: 150, y: 100, size: 50, cellX: 3, cellY: 2, neighborMask: 127 },
    ],
    edges: [],
  };
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

  it("washes only interior water cells with the frame colour at low alpha", () => {
    const { ctx, rects } = recordingCtx();
    drawWaterShimmer(ctx, [shimmerLayer], frames, 2);
    expect(rects).toEqual([[0.12, "#2a5f7c", 100, 100, 50, 50]]);
  });

  it("draws nothing on frame 0 so reduced motion and stills read the pure bake", () => {
    const { ctx, rects } = recordingCtx();
    drawWaterShimmer(ctx, [shimmerLayer], frames, 0);
    expect(rects).toEqual([]);
  });

  it("restores the caller's globalAlpha", () => {
    const { ctx, raw } = recordingCtx();
    raw.globalAlpha = 0.7;
    drawWaterShimmer(ctx, [shimmerLayer], frames, 1);
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
