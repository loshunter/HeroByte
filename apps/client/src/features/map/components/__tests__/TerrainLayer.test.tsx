import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { createTerrainMap, setTerrainCells, type MapTerrainSnapshot } from "@herobyte/shared";
import { TerrainLayer } from "../TerrainLayer";

// react-konva → divs that expose the props we assert on. sceneFuncs never run
// under this mock (they're covered by terrainSceneFunc.test.ts).
vi.mock("react-konva", () => ({
  Group: ({ children }: { children?: ReactNode }) => (
    <div data-testid="terrain-group">{children}</div>
  ),
  Shape: (props: { opacity?: number; fill?: string; stroke?: string }) => (
    <div
      data-testid="terrain-shape"
      data-opacity={String(props.opacity)}
      data-fill={props.fill}
      data-stroke={props.stroke}
    />
  ),
}));

// Keep the atlas null (avoid the async fetch); families flat-fill either way.
vi.mock("../../../render/tileAtlas", () => ({ useTileAtlas: () => null }));

// Stub ONLY the field bake (it touches a real 2D canvas, absent under jsdom).
// Default: null → the flat/atlas fallback path (one Shape per family). Tests
// that exercise the baked path set a return value. The real getFieldBake is
// unit-tested in terrainBake.test.ts; coreTerrainLayers/blitFieldBake stay real.
const getFieldBakeMock = vi.hoisted(() => vi.fn(() => null as unknown));
vi.mock("../terrainBake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../terrainBake")>()),
  getFieldBake: getFieldBakeMock,
}));

beforeEach(() => {
  getFieldBakeMock.mockReturnValue(null);
});

const cam = { x: 0, y: 0, scale: 1 };

function terrainWith(opacity: number): MapTerrainSnapshot {
  return {
    terrain: setTerrainCells(createTerrainMap(), [
      { x: 0, y: 0, assetId: "terrain:grass" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
    ]),
    grid: { size: 50, offsetX: 0, offsetY: 0 },
    opacity,
  };
}

describe("TerrainLayer", () => {
  it("renders one Shape per painted family", () => {
    const { getAllByTestId } = render(<TerrainLayer cam={cam} mapTerrain={terrainWith(1)} />);
    // grass + stone-floor → two families → two shapes.
    expect(getAllByTestId("terrain-shape")).toHaveLength(2);
  });

  it("carries the layer opacity on each family Shape", () => {
    const { getAllByTestId } = render(<TerrainLayer cam={cam} mapTerrain={terrainWith(0.5)} />);
    for (const shape of getAllByTestId("terrain-shape")) {
      expect(shape.getAttribute("data-opacity")).toBe("0.5");
    }
  });

  it("sets fill+stroke so Konva composites opacity per family (flatten-then-fade)", () => {
    // A single shared Shape would tint boundary strokes with the fill beneath;
    // per-family Shapes with fill+stroke trip Konva's buffer canvas so the
    // family flattens opaquely then fades once, matching the editor/export.
    const { getAllByTestId } = render(<TerrainLayer cam={cam} mapTerrain={terrainWith(0.5)} />);
    for (const shape of getAllByTestId("terrain-shape")) {
      expect(shape.getAttribute("data-fill")).toBeTruthy();
      expect(shape.getAttribute("data-stroke")).toBeTruthy();
    }
  });

  it("renders no Shapes for empty terrain", () => {
    const empty: MapTerrainSnapshot = {
      terrain: createTerrainMap(),
      grid: { size: 50, offsetX: 0, offsetY: 0 },
      opacity: 1,
    };
    const { queryAllByTestId } = render(<TerrainLayer cam={cam} mapTerrain={empty} />);
    expect(queryAllByTestId("terrain-shape")).toHaveLength(0);
  });

  it("collapses field families into one baked blit, keeping non-field families on top", () => {
    // grass + dirt are field families (baked into one canvas); water is not.
    const terrain: MapTerrainSnapshot = {
      terrain: setTerrainCells(createTerrainMap(), [
        { x: 0, y: 0, assetId: "terrain:grass" },
        { x: 1, y: 0, assetId: "terrain:dirt" },
        { x: 2, y: 0, assetId: "terrain:water" },
      ]),
      grid: { size: 50, offsetX: 0, offsetY: 0 },
      opacity: 0.5,
    };
    getFieldBakeMock.mockReturnValue({
      canvas: document.createElement("canvas"),
      originX: 0,
      originY: 0,
      width: 4,
      height: 4,
    });
    const { getAllByTestId } = render(<TerrainLayer cam={cam} mapTerrain={terrain} />);
    // 3 painted families → 1 field blit (grass+dirt) + 1 core Shape (water) = 2.
    const shapes = getAllByTestId("terrain-shape");
    expect(shapes).toHaveLength(2);
    // Every Shape (blit included) still carries the terrain opacity.
    for (const shape of shapes) {
      expect(shape.getAttribute("data-opacity")).toBe("0.5");
    }
  });
});
