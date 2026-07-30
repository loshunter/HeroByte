// Async bake manager (P3) under jsdom — where Worker is absent, so every
// request takes the synchronous fallback: the same tested getFieldBake path
// the pre-P3 pipeline used. Pins the signature discipline (identity/grid/
// lighting), the fallback delegation, and the progress-chip store.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { getFieldBakeSpy } = vi.hoisted(() => ({ getFieldBakeSpy: vi.fn() }));
vi.mock("../terrainBake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../terrainBake")>()),
  getFieldBake: getFieldBakeSpy,
}));

import { createAsyncFieldBake } from "../terrainBakeAsync";
import {
  getTerrainBakeChipState,
  publishTerrainBakeChip,
  subscribeTerrainBakeChip,
} from "../terrainBakeChipStore";
import type { StructuredTerrainLayer } from "../../../render/tileRenderCore";

const layer = (assetId: string): StructuredTerrainLayer => ({ assetId, cells: [], edges: [] });
const grid = { size: 50, offsetX: 0, offsetY: 0 };
const BAKED = { canvas: {} as HTMLCanvasElement, originX: 0, originY: 0, width: 4, height: 4 };

beforeEach(() => {
  getFieldBakeSpy.mockReset();
  getFieldBakeSpy.mockReturnValue(BAKED);
});

describe("createAsyncFieldBake (no Worker → sync fallback)", () => {
  it("delegates to the tested sync path and completes immediately", () => {
    const onUpdate = vi.fn();
    const manager = createAsyncFieldBake(onUpdate);
    const layers = [layer("terrain:grass")];
    manager.request(layers, grid);
    expect(getFieldBakeSpy).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(manager.state()).toMatchObject({ baked: BAKED, progress: 1, pending: false });
  });

  it("signature-guards: identical inputs never re-bake", () => {
    const onUpdate = vi.fn();
    const manager = createAsyncFieldBake(onUpdate);
    const layers = [layer("terrain:grass")];
    manager.request(layers, grid);
    manager.request(layers, grid);
    manager.request(layers, { ...grid }); // same VALUES, new grid object
    expect(getFieldBakeSpy).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("re-bakes on a layers identity, grid value, or lighting value change", () => {
    const manager = createAsyncFieldBake(() => {});
    const layers = [layer("terrain:grass")];
    manager.request(layers, grid);
    manager.request([...layers], grid); // new identity → terrain changed
    manager.request([...layers], { ...grid, size: 64 });
    getFieldBakeSpy.mockClear();
    const sameLayers = [layer("terrain:grass")];
    manager.request(sameLayers, grid, { ambient: 0.4, lights: [] });
    manager.request(sameLayers, grid, { ambient: 0.4, lights: [] }); // same value
    manager.request(sameLayers, grid, { ambient: 0.2, lights: [] }); // darker
    expect(getFieldBakeSpy).toHaveBeenCalledTimes(2);
  });

  it("bumps the revision on every visual change", () => {
    const manager = createAsyncFieldBake(() => {});
    const first = [layer("terrain:grass")];
    manager.request(first, grid);
    const r1 = manager.state().revision;
    manager.request([...first], grid);
    expect(manager.state().revision).toBeGreaterThan(r1);
  });
});

describe("terrain bake chip store", () => {
  it("publishes state changes to subscribers and keeps idle identity stable", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeTerrainBakeChip(() =>
      seen.push(getTerrainBakeChipState().pending),
    );
    publishTerrainBakeChip(true, 0.5);
    expect(getTerrainBakeChipState()).toEqual({ pending: true, progress: 0.5 });
    const mid = getTerrainBakeChipState();
    publishTerrainBakeChip(true, 0.5); // unchanged → same object identity
    expect(getTerrainBakeChipState()).toBe(mid);
    publishTerrainBakeChip(false, 1);
    unsubscribe();
    publishTerrainBakeChip(true, 0.1); // after unsubscribe → not seen
    expect(seen).toEqual([true, true, false]);
    publishTerrainBakeChip(false, 1); // leave the store idle for other tests
  });
});
