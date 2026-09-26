import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { useTerrainBrush } from "../../../map-studio/components/useTerrainBrush";
import { boundPalette } from "./palette.fixtures";

afterEach(cleanup);

function setup() {
  const document = createMapDocument({
    id: "brush",
    name: "Brush",
    width: 225,
    height: 225,
    timestamp: 1,
  });
  document.grid = { ...document.grid, size: 50, offsetX: 25, offsetY: 25 };
  const paintTerrain = vi.fn();
  const hook = renderHook(() => useTerrainBrush({ activeDocument: document, paintTerrain }));
  return { ...hook, paintTerrain };
}

describe("terrain ownership before U4b footprint changes", () => {
  it.each(["terrain:grass", null])(
    "deduplicates %s and commits the preview once on release",
    (assetId) => {
      const h = setup();
      act(() => h.result.current.addStrokePoint({ x: 26, y: 26 }, assetId));
      act(() => h.result.current.addStrokePoint({ x: 74, y: 74 }, assetId));
      act(() => h.result.current.addStrokePoint({ x: 76, y: 76 }, assetId));
      const cells = [
        { x: 0, y: 0, assetId },
        { x: 1, y: 1, assetId },
      ];
      expect(h.result.current.strokeCells).toEqual(cells);
      expect(h.paintTerrain).not.toHaveBeenCalled();
      act(() => h.result.current.flushStroke());
      expect(h.paintTerrain).toHaveBeenCalledExactlyOnceWith(cells);
      expect(h.result.current.strokeCells).toEqual([]);
      act(() => h.result.current.flushStroke());
      expect(h.paintTerrain).toHaveBeenCalledTimes(1);
    },
  );

  it("paints only full cells within an offset document grid", () => {
    const h = setup();
    for (const point of [
      { x: 24, y: 30 },
      { x: 30, y: 24 },
      { x: 225, y: 225 },
    ]) {
      act(() => h.result.current.addStrokePoint(point, "terrain:grass"));
      act(() => h.result.current.discardStroke());
    }
    expect(h.paintTerrain).not.toHaveBeenCalled();
    expect(h.result.current.strokeCells).toEqual([]);
    act(() => h.result.current.addStrokePoint({ x: 224, y: 224 }, "terrain:grass"));
    expect(h.result.current.strokeCells).toEqual([{ x: 3, y: 3, assetId: "terrain:grass" }]);
  });

  it("discard clears every pending cell and the next stroke starts fresh", () => {
    const h = setup();
    act(() => h.result.current.addStrokePoint({ x: 30, y: 30 }, "terrain:grass"));
    act(() => h.result.current.discardStroke());
    act(() => h.result.current.flushStroke());
    expect(h.paintTerrain).not.toHaveBeenCalled();
    act(() => h.result.current.addStrokePoint({ x: 180, y: 180 }, null));
    act(() => h.result.current.flushStroke());
    expect(h.paintTerrain).toHaveBeenCalledExactlyOnceWith([{ x: 3, y: 3, assetId: null }]);
  });

  it("shortcut sampling preserves the active tool and shares the material selection", () => {
    const h = boundPalette();
    act(() => h.result.current.state.toolbarProps.onSelectSubTool("scatter"));
    act(() => h.result.current.state.onSampleAsset("terrain:stone-floor", "shortcut"));
    expect(h.result.current.state.activeSubTool).toBe("scatter");
    expect(h.result.current.state.floorFamily).toBe("stone-floor");
    expect(h.result.current.state.selectedAssetId).toBe("terrain:stone-floor");
    expect(h.result.current.state.toolbarProps.floorFamily).toBe("stone-floor");
  });
});
