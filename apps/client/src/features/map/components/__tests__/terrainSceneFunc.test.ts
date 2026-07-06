import { describe, expect, it } from "vitest";
import type {
  StructuredTerrainLayer,
  TerrainAtlasSource,
  TileRenderContext2D,
} from "../../../render/tileRenderCore";
import { createRecordingContext as createRawRecordingContext } from "../../../render/__tests__/recordingContext";
import { drawTableTerrain } from "../terrainSceneFunc";

function createRecordingContext() {
  const { context, calls } = createRawRecordingContext();
  return { context: context as unknown as TileRenderContext2D, calls };
}

function cell(cellX: number, cellY: number) {
  return { x: cellX * 50, y: cellY * 50, size: 50, cellX, cellY };
}

const GRASS: StructuredTerrainLayer = {
  assetId: "terrain:grass",
  cells: [cell(0, 0)],
  edges: [],
};

const WATER: StructuredTerrainLayer = {
  assetId: "terrain:water",
  cells: [cell(1, 0)],
  edges: [],
};

// Atlas covers grass (a Tileset v1 family) but not water (flat-fill only).
const ATLAS: TerrainAtlasSource = {
  image: {} as CanvasImageSource,
  tileForCell: (assetId) => (assetId === "terrain:grass" ? { x: 0, y: 0, size: 16 } : null),
};

describe("drawTableTerrain", () => {
  it("draws atlas-covered families as textures via drawImage", () => {
    const { context, calls } = createRecordingContext();

    drawTableTerrain(context, [GRASS], ATLAS, 0);

    expect(calls.some(([op]) => op === "drawImage")).toBe(true);
    // The atlas cell must NOT also flat-fill — that would paint under the tile.
    expect(calls.some(([op]) => op === "fillRect")).toBe(false);
  });

  it("flat-fills families the atlas does not cover (water)", () => {
    const { context, calls } = createRecordingContext();

    drawTableTerrain(context, [WATER], ATLAS, 0);

    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
    expect(calls).toContainEqual(["fillRect", 50, 0, 50, 50]);
    expect(calls.some(([op]) => op === "drawImage")).toBe(false);
  });

  it("animates the water fill with the frame index (shared 300ms clock)", () => {
    const fillAt = (frame: number) => {
      const { context, calls } = createRecordingContext();
      drawTableTerrain(context, [WATER], null, frame);
      return calls.find(([op]) => op === "set:fillStyle")?.[1];
    };

    expect(fillAt(0)).toBe("#24516b");
    expect(fillAt(1)).toBe("#295a76");
    expect(fillAt(0)).not.toBe(fillAt(1));
  });

  it("no-ops on empty terrain", () => {
    const { context, calls } = createRecordingContext();

    drawTableTerrain(context, [], null, 0);

    expect(calls).toHaveLength(0);
  });
});
