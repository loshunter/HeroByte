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

// Golden pins for the export byte-parity invariant: renderMapDocumentSvg must
// stay byte-identical across renderer refactors, so the exact path strings —
// separators, emit order, sign formatting — are snapshot here verbatim.
describe("SVG path strings (export byte-parity pins)", () => {
  it("emits the exact fill and boundary strings for a mixed-terrain map", () => {
    const document = painted([
      { x: 2, y: 0, assetId: "terrain:water" },
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 1, assetId: "terrain:stone-floor" },
    ]);

    const layers = buildTerrainRenderLayers(document.terrain!, GRID, buildTileOccupancy(document));

    expect(layers).toMatchInlineSnapshot(`
      [
        {
          "assetId": "terrain:stone-floor",
          "boundaryPath": "M 0 0 H 50 M 0 50 H 50 M 0 0 V 50 M 50 0 H 100 M 100 0 V 50 M 50 100 H 100 M 50 50 V 100 M 100 50 V 100",
          "fillPath": "M 0 0 h 50 v 50 h -50 Z M 50 0 h 50 v 50 h -50 Z M 50 50 h 50 v 50 h -50 Z",
        },
        {
          "assetId": "terrain:water",
          "boundaryPath": "M 100 0 H 150 M 100 50 H 150 M 100 0 V 50 M 150 0 V 50",
          "fillPath": "M 100 0 h 50 v 50 h -50 Z",
        },
      ]
    `);
  });

  it("emits the exact strings on a fractional offset lattice", () => {
    const document = painted([
      { x: 0, y: 0, assetId: "terrain:water" },
      { x: 1, y: 0, assetId: "terrain:water" },
    ]);

    const layers = buildTerrainRenderLayers(
      document.terrain!,
      { size: 50, offsetX: 12.5, offsetY: 7.25 },
      buildTileOccupancy(document),
    );

    expect(layers).toMatchInlineSnapshot(`
      [
        {
          "assetId": "terrain:water",
          "boundaryPath": "M 12.5 7.25 H 62.5 M 12.5 57.25 H 62.5 M 12.5 7.25 V 57.25 M 62.5 7.25 H 112.5 M 62.5 57.25 H 112.5 M 112.5 7.25 V 57.25",
          "fillPath": "M 12.5 7.25 h 50 v 50 h -50 Z M 62.5 7.25 h 50 v 50 h -50 Z",
        },
      ]
    `);
  });

  it("keeps vertical edges 'V' when float absorption collapses the cell height", () => {
    // offsetY 1e18 passes sanitizeMapGrid, and 1e18 + 50 === 1e18 (ulp 128):
    // the edge collapses to a point, but orientation must not flip to 'H' —
    // the pre-refactor code chose the command letter structurally.
    const document = painted([{ x: 0, y: 0, assetId: "terrain:water" }]);

    const layers = buildTerrainRenderLayers(
      document.terrain!,
      { size: 50, offsetX: 0, offsetY: 1e18 },
      buildTileOccupancy(document),
    );

    expect(layers[0]!.fillPath).toBe("M 0 1000000000000000000 h 50 v 50 h -50 Z");
    expect(layers[0]!.boundaryPath).toBe(
      "M 0 1000000000000000000 H 50 M 0 1000000000000000000 H 50 " +
        "M 0 1000000000000000000 V 1000000000000000000 M 50 1000000000000000000 V 1000000000000000000",
    );
  });

  it("emits the exact strings for negative-coordinate cells", () => {
    const document = painted([
      { x: -1, y: -1, assetId: "terrain:grass" },
      { x: 0, y: -1, assetId: "terrain:grass" },
    ]);

    const layers = buildTerrainRenderLayers(document.terrain!, GRID, buildTileOccupancy(document));

    expect(layers).toMatchInlineSnapshot(`
      [
        {
          "assetId": "terrain:grass",
          "boundaryPath": "M -50 -50 H 0 M -50 0 H 0 M -50 -50 V 0 M 0 -50 H 50 M 0 0 H 50 M 50 -50 V 0",
          "fillPath": "M -50 -50 h 50 v 50 h -50 Z M 0 -50 h 50 v 50 h -50 Z",
        },
      ]
    `);
  });
});
