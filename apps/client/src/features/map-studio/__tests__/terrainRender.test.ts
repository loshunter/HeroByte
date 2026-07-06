import { describe, expect, it } from "vitest";
import { createMapDocument, paintTerrain } from "@herobyte/shared";
import { buildTileOccupancy } from "../tileAutotiling";
import { buildTerrainRenderLayers } from "../terrainRender";

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

// The export byte-parity golden pins live in terrainRenderParity.frozen.test.ts
// (hash-enforced by scripts/check-frozen-tests.mjs — do not edit that file).
