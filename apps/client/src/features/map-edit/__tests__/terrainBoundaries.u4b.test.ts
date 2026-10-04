import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { terrainBrushFootprint, terrainBrushPath } from "../../map-studio/terrainBrushGeometry";
import { useTerrainBrush } from "../../map-studio/components/useTerrainBrush";

afterEach(cleanup);

function doc(size = 50, offset = 0) {
  const d = createMapDocument({
    id: "bounds",
    name: "Bounds",
    width: 200,
    height: 200,
    timestamp: 1,
  });
  d.grid = { ...d.grid, size, offsetX: offset, offsetY: offset };
  return d;
}
describe("U4b terrain grid boundaries", () => {
  it.each([
    { size: 0.1, offset: 0.3, point: 0.6, index: 3 },
    { size: 0.1, offset: 0.3, point: 0.7, index: 4 },
    { size: 0.1, offset: 0.3, point: 0.5999999, index: 2 },
    { size: 0.1, offset: 0.3, point: 0.6000001, index: 3 },
    { size: 0.1e-9, offset: 0.3e-9, point: 0.5999999e-9, index: 2 },
  ])("assigns decimal interior point $point to cell $index", ({ size, offset, point, index }) => {
    const document = doc(size, offset);
    const position = { x: point, y: point };
    const expected = [{ x: index, y: index }];
    expect(terrainBrushFootprint(document, position, 1)).toEqual(expected);
    expect([...terrainBrushPath(document, position, position, 1)]).toEqual(expected);
    const paintTerrain = vi.fn();
    const h = renderHook(() => useTerrainBrush({ activeDocument: document, paintTerrain }));
    act(() => h.result.current.addStrokePoint(position, "terrain:grass"));
    const painted = [{ ...expected[0], assetId: "terrain:grass" }];
    expect(h.result.current.brushPreviewCells).toEqual(painted);
    act(() => h.result.current.flushStroke());
    expect(paintTerrain).toHaveBeenCalledExactlyOnceWith(painted);
  });

  it.each([
    { point: 0.05, index: -3 },
    { point: 199.95, index: 1996 },
  ])(
    "includes the full decimal edge cell $index in preview and one command",
    ({ point, index }) => {
      const document = doc(0.1, 0.3);
      const position = { x: point, y: point };
      const expected = [{ x: index, y: index }];
      expect(terrainBrushFootprint(document, position, 1)).toEqual(expected);
      expect([...terrainBrushPath(document, position, position, 1)]).toEqual(expected);
      const paintTerrain = vi.fn();
      const h = renderHook(() => useTerrainBrush({ activeDocument: document, paintTerrain }));
      act(() => h.result.current.addStrokePoint(position, "terrain:grass"));
      expect(h.result.current.brushPreviewCells).toEqual([
        { ...expected[0], assetId: "terrain:grass" },
      ]);
      act(() => h.result.current.flushStroke());
      expect(paintTerrain).toHaveBeenCalledExactlyOnceWith([
        { ...expected[0], assetId: "terrain:grass" },
      ]);
    },
  );
  it.each([
    { size: 0.1, offset: 0.2999999, point: 0.05 },
    { size: 0.1, offset: 0.3000001, point: 199.95 },
    { size: 0.1e-9, offset: 0.2999999e-9, point: 0.05e-9 },
  ])("does not admit a genuinely partial decimal cell at $offset", ({ size, offset, point }) => {
    const document = doc(size, offset);
    const position = { x: point, y: point };
    expect(terrainBrushFootprint(document, position, 1)).toEqual([]);
    expect([...terrainBrushPath(document, position, position, 1)]).toEqual([]);
  });
  it("clips to complete cells when an offset makes valid indexes negative", () => {
    expect(terrainBrushFootprint(doc(50, 125), { x: 26, y: 26 }, 3)).toEqual([
      { x: -2, y: -2 },
      { x: -1, y: -2 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
    ]);
  });
  it("clips a path entering and leaving the whole document", () => {
    expect([...terrainBrushPath(doc(), { x: -500, y: 25 }, { x: 500, y: 25 }, 1)]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
  it("handles fractional grids and reversed exact-corner crossings", () => {
    expect([
      ...terrainBrushPath(doc(2.5, 0.5), { x: 11.75, y: 11.75 }, { x: 4.25, y: 4.25 }, 1),
    ]).toEqual([
      { x: 4, y: 4 },
      { x: 3, y: 3 },
      { x: 2, y: 2 },
      { x: 1, y: 1 },
    ]);
  });
  it.each([0, -1, NaN, Infinity])("rejects an invalid grid size %s without iterating", (size) => {
    expect([...terrainBrushPath(doc(size), { x: 0, y: 0 }, { x: 100, y: 100 }, 5)]).toEqual([]);
    expect(terrainBrushFootprint(doc(size), { x: 50, y: 50 }, 5)).toEqual([]);
  });
  it("never emits coordinates outside the protocol's existing magnitude bound", () => {
    const d = doc(0.001);
    expect(terrainBrushFootprint(d, { x: 65.5365, y: 0.0025 }, 5)).toEqual(
      [0, 1, 2, 3, 4].flatMap((y) => [65534, 65535, 65536].map((x) => ({ x, y }))),
    );
    expect(terrainBrushFootprint(d, { x: Infinity, y: 0 }, 5)).toEqual([]);
    expect([...terrainBrushPath(d, { x: 0, y: 0 }, { x: NaN, y: 0 }, 5)]).toEqual([]);
  });
});
