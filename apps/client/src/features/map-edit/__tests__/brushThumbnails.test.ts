// Brush-thumbnail bake contract: the 3×3 patch must look like real painted
// terrain to the painter stack (same neighbour masks the live renderer
// emits), and an environment without a 2D canvas (this jsdom run) must
// degrade to the flat-fill fallback without throwing or re-queuing.

import { beforeEach, describe, expect, it } from "vitest";
import { NEIGHBOR_BITS } from "../../render/blobAutotile";
import {
  BRUSH_PREVIEW_SIZE,
  __resetBrushThumbnailsForTests,
  getBrushThumbnailVersion,
  peekBrushThumbnail,
  requestBrushThumbnails,
  subscribeBrushThumbnails,
  thumbnailPatchLayers,
} from "../brushThumbnails";

const CELL = BRUSH_PREVIEW_SIZE / 3;

describe("thumbnailPatchLayers", () => {
  it("builds one 3×3 layer with renderer-grade neighbour masks", () => {
    const { N, NE, E, SE, S, SW, W, NW } = NEIGHBOR_BITS;
    const layers = thumbnailPatchLayers("terrain:wall-stone");
    expect(layers).toHaveLength(1);
    expect(layers[0]!.assetId).toBe("terrain:wall-stone");
    expect(layers[0]!.edges).toEqual([]);
    const cells = layers[0]!.cells;
    expect(cells).toHaveLength(9);
    const at = (cx: number, cy: number) =>
      cells.find((cell) => cell.cellX === cx && cell.cellY === cy)!;
    // Centre cell is fully surrounded; corners and edges see only the patch.
    expect(at(1, 1).neighborMask).toBe(N | NE | E | SE | S | SW | W | NW);
    expect(at(0, 0).neighborMask).toBe(E | SE | S);
    expect(at(1, 0).neighborMask).toBe(E | SE | S | SW | W);
    expect(at(2, 2).neighborMask).toBe(N | W | NW);
    expect(at(0, 0).size).toBe(CELL);
    expect(at(2, 1).x).toBe(2 * CELL);
    expect(at(2, 1).y).toBe(CELL);
  });
});

describe("bake queue degradation (no 2D canvas in jsdom)", () => {
  beforeEach(() => __resetBrushThumbnailsForTests());

  const nextBake = () =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("bake never completed")), 10_000);
      const unsubscribe = subscribeBrushThumbnails(() => {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });

  it("marks the family failed, keeps the fallback, and never re-queues", async () => {
    const baked = nextBake();
    requestBrushThumbnails(["terrain:stone-floor"]);
    // Pending immediately — the deck shows the flat fill.
    expect(peekBrushThumbnail("terrain:stone-floor")).toBeNull();
    await baked;
    // jsdom has no 2D context, so the bake lands as a terminal failure: the
    // flat fill stays and the version ticked exactly once.
    expect(peekBrushThumbnail("terrain:stone-floor")).toBeNull();
    expect(getBrushThumbnailVersion()).toBe(1);
    // A repeat request is a cache no-op.
    requestBrushThumbnails(["terrain:stone-floor"]);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(getBrushThumbnailVersion()).toBe(1);
  });
});
