import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type TerrainPaintCell } from "@herobyte/shared";
import { useTerrainBrush } from "../../map-studio/components/useTerrainBrush";
import { useMapEditTool } from "../useMapEditTool";
import { at, makeController } from "./characterization/mapLifecycle.fixtures";

afterEach(cleanup);
const grass = "terrain:grass";
const cells = (xs: number[], ys: number[], assetId: string | null = grass): TerrainPaintCell[] =>
  ys.flatMap((y) => xs.map((x) => ({ x, y, assetId })));
const coords = (items: TerrainPaintCell[]) => items.map((c) => `${c.x},${c.y}`).sort();

function setup(brushSize: 1 | 3 | 5 = 1, offset = 0, extent = 500) {
  const document = createMapDocument({
    id: "brush",
    name: "Brush",
    width: extent,
    height: extent,
    timestamp: 1,
  });
  document.grid = { ...document.grid, size: 50, offsetX: offset, offsetY: offset };
  const paintTerrain = vi.fn();
  const options = { activeDocument: document, paintTerrain, brushSize };
  const hook = renderHook(() => useTerrainBrush(options));
  return { ...hook, document, paintTerrain };
}

describe("U4b terrain footprint and continuous stroke", () => {
  it.each([1, 3, 5] as const)(
    "size %i previews and commits the exact square footprint once",
    (size) => {
      const h = setup(size);
      act(() => h.result.current.addStrokePoint({ x: 125, y: 125 }, grass));
      const axis = size === 1 ? [2] : size === 3 ? [1, 2, 3] : [0, 1, 2, 3, 4];
      const expected = cells(axis, axis);
      expect(coords(h.result.current.strokeCells)).toEqual(coords(expected));
      expect(h.paintTerrain).not.toHaveBeenCalled();
      act(() => h.result.current.flushStroke());
      expect(h.paintTerrain).toHaveBeenCalledExactlyOnceWith(expected);
      act(() => h.result.current.flushStroke());
      expect(h.paintTerrain).toHaveBeenCalledTimes(1);
    },
  );

  it("fills every crossed cell during a fast horizontal jump", () => {
    const h = setup();
    act(() => h.result.current.addStrokePoint({ x: 125, y: 125 }, grass));
    act(() => h.result.current.addStrokePoint({ x: 425, y: 125 }, grass));
    expect(h.result.current.strokeCells).toEqual(cells([2, 3, 4, 5, 6, 7, 8], [2]));
  });

  it("uses the actual segment's cell crossings rather than endpoint cell centers", () => {
    const h = setup();
    act(() => h.result.current.addStrokePoint({ x: 49, y: 49 }, grass));
    act(() => h.result.current.addStrokePoint({ x: 51, y: 199 }, grass));
    expect(h.result.current.strokeCells).toEqual([
      { x: 0, y: 0, assetId: grass },
      { x: 0, y: 1, assetId: grass },
      { x: 0, y: 2, assetId: grass },
      { x: 1, y: 2, assetId: grass },
      { x: 1, y: 3, assetId: grass },
    ]);
  });

  it.each([
    { point: { x: 26, y: 26 }, xs: [0, 1], ys: [0, 1] },
    { point: { x: 224, y: 26 }, xs: [2, 3], ys: [0, 1] },
    { point: { x: 26, y: 224 }, xs: [0, 1], ys: [2, 3] },
    { point: { x: 224, y: 224 }, xs: [2, 3], ys: [2, 3] },
  ])("clips the 3-cell footprint to complete offset-grid cells at $point", ({ point, xs, ys }) => {
    const h = setup(3, 25, 225);
    act(() => h.result.current.addStrokePoint(point, grass));
    expect(coords(h.result.current.strokeCells)).toEqual(coords(cells(xs, ys)));
  });

  it("deduplicates overlapping five-cell eraser samples into one command", () => {
    const h = setup(5);
    act(() => h.result.current.addStrokePoint({ x: 125, y: 125 }, null));
    act(() => h.result.current.addStrokePoint({ x: 225, y: 125 }, null));
    act(() => h.result.current.addStrokePoint({ x: 125, y: 125 }, null));
    expect(coords(h.result.current.strokeCells)).toEqual(
      coords(cells([0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4], null)),
    );
    const preview = h.result.current.strokeCells;
    act(() => h.result.current.flushStroke());
    expect(h.paintTerrain).toHaveBeenCalledExactlyOnceWith(preview);
  });

  it("bounds a tiny-grid fast stroke at the existing cell cap", () => {
    const h = setup(5, 0, 32768);
    h.document.grid.size = 0.0001;
    act(() => h.result.current.addStrokePoint({ x: 0.00025, y: 0.00025 }, grass));
    act(() => h.result.current.addStrokePoint({ x: 1_000_000, y: 0.00025 }, grass));
    expect(h.result.current.strokeCells).toHaveLength(16384);
    expect(new Set(coords(h.result.current.strokeCells)).size).toBe(16384);
    expect(
      h.result.current.strokeCells.every(
        (c) =>
          Number.isInteger(c.x) &&
          Number.isInteger(c.y) &&
          Math.abs(c.x) <= 65536 &&
          Math.abs(c.y) <= 65536,
      ),
    ).toBe(true);
    const preview = h.result.current.strokeCells;
    act(() => h.result.current.flushStroke());
    expect(h.paintTerrain).toHaveBeenCalledExactlyOnceWith(preview);
  });

  it("does not bridge a canceled stroke into its next press", () => {
    const h = setup(3);
    act(() => h.result.current.addStrokePoint({ x: 125, y: 125 }, grass));
    act(() => h.result.current.discardStroke());
    act(() => h.result.current.addStrokePoint({ x: 325, y: 325 }, grass));
    expect(coords(h.result.current.strokeCells)).toEqual(coords(cells([5, 6, 7], [5, 6, 7])));
  });
});

describe("U4b live tool integration", () => {
  it.each([
    ["terrain", "touch"],
    ["erase", "touch"],
    ["terrain", "mouse"],
    ["erase", "mouse"],
  ] as const)("releases %s with %s preview lifetime and one command", (tool, input) => {
    const controller = makeController();
    const h = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: tool,
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        terrainBrushSize: 3,
        toWorld: (x, y) => ({ x, y }),
        mapTransform: undefined,
      }),
    );
    const asset = tool === "terrain" ? grass : null;
    act(() => h.result.current.onMouseDown(at(125, 125), input));
    act(() => h.result.current.onMouseMove(at(175, 125), input));
    const hover = cells([2, 3, 4], [1, 2, 3], asset);
    expect(h.result.current.brushPreviewCells).toEqual(hover);
    expect(controller.paintTerrain).not.toHaveBeenCalled();
    act(() => h.result.current.onMouseUp(input));
    expect(controller.paintTerrain).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining(cells([1, 2, 3, 4], [1, 2, 3], asset)),
    );
    expect(vi.mocked(controller.paintTerrain).mock.calls[0]![0]).toHaveLength(12);
    expect(h.result.current.strokeCells).toEqual([]);
    expect(h.result.current.brushPreviewCells).toEqual(input === "touch" ? [] : hover);
    act(() => h.result.current.onMouseUp(input));
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(h.result.current.brushPreviewCells).toEqual(input === "touch" ? [] : hover);
  });

  it("previews the same transformed footprint before press without adding stroke cells", () => {
    const controller = makeController();
    const options = {
      mapEditMode: true,
      activeSubTool: "terrain" as const,
      controller,
      liveDocumentId: "live",
      floorFamily: "grass",
      terrainBrushSize: 3 as const,
      toWorld: (x: number, y: number) => ({ x: 2 * x + 10, y: 2 * y + 20 }),
      mapTransform: { x: 100, y: 200, scaleX: 2, scaleY: 3, rotation: 90 },
    };
    const h = renderHook(() => useMapEditTool(options));
    act(() => h.result.current.onMouseMove(at(-142.5, 215)));
    expect(h.result.current).toMatchObject({
      brushPreviewCells: cells([1, 2, 3], [1, 2, 3]),
      strokeCells: [],
    });
    expect(controller.paintTerrain).not.toHaveBeenCalled();
    act(() => h.result.current.onMouseDown(at(-142.5, 215)));
    expect(h.result.current.strokeCells).toEqual(cells([1, 2, 3], [1, 2, 3]));
    act(() => h.result.current.onCancel());
    act(() => h.result.current.onMouseUp());
    expect(h.result.current).toMatchObject({ brushPreviewCells: [], strokeCells: [] });
    expect(controller.paintTerrain).not.toHaveBeenCalled();
  });

  it.each(["size", "material", "grid"] as const)(
    "cancels on a %s change without reviving on move/release",
    (changed) => {
      const controller = makeController();
      const initial = {
        size: 1 as 1 | 3 | 5,
        family: "grass",
        document: controller.activeDocument!,
      };
      const h = renderHook(
        ({ size, family, document }) => {
          const options = {
            mapEditMode: true,
            activeSubTool: "terrain" as const,
            controller: { ...controller, activeDocument: document },
            liveDocumentId: "live",
            floorFamily: family,
            terrainBrushSize: size,
            toWorld: (x: number, y: number) => ({ x, y }),
            mapTransform: undefined,
          };
          return useMapEditTool(options);
        },
        { initialProps: initial },
      );
      act(() => h.result.current.onMouseDown(at(125, 125)));
      expect(h.result.current.strokeCells).toHaveLength(1);
      h.rerender({
        ...initial,
        size: changed === "size" ? 3 : 1,
        family: changed === "material" ? "dirt" : "grass",
        document:
          changed === "grid"
            ? { ...initial.document, grid: { ...initial.document.grid, offsetX: 25 } }
            : initial.document,
      });
      expect(h.result.current.strokeCells).toEqual([]);
      act(() => h.result.current.onMouseMove(at(225, 125)));
      act(() => h.result.current.onMouseUp());
      expect(controller.paintTerrain).not.toHaveBeenCalled();
      act(() => h.result.current.onMouseDown(at(325, 325)));
      act(() => h.result.current.onMouseUp());
      expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    },
  );
});
