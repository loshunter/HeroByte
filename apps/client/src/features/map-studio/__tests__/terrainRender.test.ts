import { describe, expect, it } from "vitest";
import { createMapDocument, paintTerrain } from "@herobyte/shared";
import { NEIGHBOR_BITS } from "../../render/blobAutotile";
import { buildTileOccupancy } from "../tileAutotiling";
import { buildStructuredTerrainLayers, buildTerrainRenderLayers } from "../terrainRender";

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

function painted(cells: Array<{ x: number; y: number; assetId: string }>) {
  let document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
  document = paintTerrain(document, cells, 2);
  return document;
}

describe("buildTerrainRenderLayers", () => {
  it("renders one fill and boundary layer per terrain family, deterministically ordered", () => {
    const document = painted([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
      { x: 2, y: 0, assetId: "terrain:water" },
    ]);

    const layers = buildTerrainRenderLayers(document.terrain!, GRID, buildTileOccupancy(document));

    expect(layers.map((layer) => layer.assetId)).toEqual(["terrain:stone-floor", "terrain:water"]);
    const stone = layers[0]!;
    expect(stone.fillPath).toContain("M 0 0 h 50 v 50 h -50 Z");
    expect(stone.fillPath).toContain("M 50 0 h 50 v 50 h -50 Z");
    // Fused interior edge between the two stone cells is not drawn…
    expect(stone.boundaryPath).not.toContain("M 50 0 V 50");
    // …but the border against water is.
    expect(stone.boundaryPath).toContain("M 100 0 V 50");
  });

  it("fuses terrain against same-family tile elements through shared occupancy", () => {
    const document = painted([{ x: 0, y: 0, assetId: "terrain:stone-floor" }]);
    document.elements.push({
      id: "legacy-tile",
      type: "tile",
      layerId: "terrain",
      locked: false,
      hidden: false,
      transform: { x: 50, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: "terrain:stone-floor", columns: 1, rows: 1 },
    });

    const layers = buildTerrainRenderLayers(document.terrain!, GRID, buildTileOccupancy(document));

    // The painted cell's right edge faces a same-family tile element: fused.
    expect(layers[0]!.boundaryPath).not.toContain("M 50 0 V 50");
    expect(layers[0]!.boundaryPath).toContain("M 0 0 V 50"); // left edge kept
  });

  it("positions cells on the document's offset lattice", () => {
    const document = painted([{ x: 0, y: 0, assetId: "terrain:grass" }]);

    const layers = buildTerrainRenderLayers(
      document.terrain!,
      { size: 50, offsetX: 25, offsetY: 10 },
      new Map([["0,0", "terrain:grass"]]),
    );

    expect(layers[0]!.fillPath).toContain("M 25 10 h 50 v 50 h -50 Z");
  });

  it("returns nothing for empty terrain", () => {
    expect(
      buildTerrainRenderLayers({ schemaVersion: 1, palette: [], chunks: {} }, GRID, new Map()),
    ).toEqual([]);
  });
});

describe("buildStructuredTerrainLayers — neighborMask", () => {
  const block3x3 = () =>
    painted([0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => ({ x, y, assetId: "terrain:grass" }))));

  const cellAt = (
    layers: ReturnType<typeof buildStructuredTerrainLayers>,
    assetId: string,
    cellX: number,
    cellY: number,
  ) => {
    const layer = layers.find((l) => l.assetId === assetId)!;
    return layer.cells.find((c) => c.cellX === cellX && c.cellY === cellY)!;
  };

  it("sets the full 8-neighbor mask on a cell surrounded by its own family", () => {
    const document = block3x3();
    const layers = buildStructuredTerrainLayers(
      document.terrain!,
      GRID,
      buildTileOccupancy(document),
    );
    // Centre cell (1,1) has all 8 neighbours same-family.
    expect(cellAt(layers, "terrain:grass", 1, 1).neighborMask).toBe(255);
  });

  it("sets only the present neighbours on a corner cell", () => {
    const document = block3x3();
    const layers = buildStructuredTerrainLayers(
      document.terrain!,
      GRID,
      buildTileOccupancy(document),
    );
    // (0,0) corner of the block: only E, S, SE are same-family.
    expect(cellAt(layers, "terrain:grass", 0, 0).neighborMask).toBe(
      NEIGHBOR_BITS.E | NEIGHBOR_BITS.S | NEIGHBOR_BITS.SE,
    );
  });

  it("excludes a different-family neighbour from the mask", () => {
    // Grass at (0,0) and (1,0); water at (0,1). Only E is same-family for (0,0).
    const document = painted([
      { x: 0, y: 0, assetId: "terrain:grass" },
      { x: 1, y: 0, assetId: "terrain:grass" },
      { x: 0, y: 1, assetId: "terrain:water" },
    ]);
    const layers = buildStructuredTerrainLayers(
      document.terrain!,
      GRID,
      buildTileOccupancy(document),
    );
    expect(cellAt(layers, "terrain:grass", 0, 0).neighborMask).toBe(NEIGHBOR_BITS.E);
  });
});

// The export byte-parity golden pins live in terrainRenderParity.frozen.test.ts
// (hash-enforced by scripts/check-frozen-tests.mjs — do not edit that file).
