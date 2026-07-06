import { describe, expect, it } from "vitest";
import { createMapDocument, paintTerrain } from "@herobyte/shared";
import { getGridGeometry } from "../../map-studio/gridGeometry";
import { buildStructuredTerrainLayers } from "../../map-studio/terrainRender";
import { buildTileOccupancy } from "../../map-studio/tileAutotiling";
import { terrainStyleForFrame } from "../../map-studio/starterTiles";
import {
  drawGrid,
  drawTerrain,
  parseGridPatternPath,
  type StructuredTerrainLayer,
  type TileRenderContext2D,
} from "../tileRenderCore";

type RecordedCall = [op: string, ...args: unknown[]];

/** Mock 2D context: records every method call and property set, in order. */
function createRecordingContext() {
  const calls: RecordedCall[] = [];
  const context: Record<string, unknown> = {};
  for (const method of [
    "fillRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "closePath",
    "stroke",
    "save",
    "restore",
  ]) {
    context[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
    };
  }
  for (const property of ["fillStyle", "strokeStyle", "lineWidth", "globalAlpha"]) {
    Object.defineProperty(context, property, {
      set: (value: unknown) => {
        calls.push([`set:${property}`, value]);
      },
    });
  }
  return { context: context as unknown as TileRenderContext2D, calls };
}

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

function structuredLayers(cells: Array<{ x: number; y: number; assetId: string }>) {
  let document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
  document = paintTerrain(document, cells, 2);
  return buildStructuredTerrainLayers(document.terrain!, GRID, buildTileOccupancy(document));
}

describe("drawTerrain", () => {
  it("reproduces the SVG flat-color terrain model cell-for-cell", () => {
    const layers = structuredLayers([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
      { x: 2, y: 0, assetId: "terrain:water" },
    ]);
    const { context, calls } = createRecordingContext();

    drawTerrain(context, layers, terrainStyleForFrame, 0);

    expect(calls).toEqual([
      // Stone family: fills, then fused boundary (SVG edge emit order:
      // per cell top, bottom, left, right).
      ["set:fillStyle", "#4d5361"],
      ["fillRect", 0, 0, 50, 50],
      ["fillRect", 50, 0, 50, 50],
      ["set:strokeStyle", "#6e7688"],
      ["set:lineWidth", 2],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["lineTo", 50, 0],
      ["moveTo", 0, 50],
      ["lineTo", 50, 50],
      ["moveTo", 0, 0],
      ["lineTo", 0, 50],
      ["moveTo", 50, 0],
      ["lineTo", 100, 0],
      ["moveTo", 50, 50],
      ["lineTo", 100, 50],
      ["moveTo", 100, 0],
      ["lineTo", 100, 50],
      ["stroke"],
      // Water family.
      ["set:fillStyle", "#24516b"],
      ["fillRect", 100, 0, 50, 50],
      ["set:strokeStyle", "#48a7bd"],
      ["set:lineWidth", 2],
      ["beginPath"],
      ["moveTo", 100, 0],
      ["lineTo", 150, 0],
      ["moveTo", 100, 50],
      ["lineTo", 150, 50],
      ["moveTo", 100, 0],
      ["lineTo", 100, 50],
      ["moveTo", 150, 0],
      ["lineTo", 150, 50],
      ["stroke"],
    ]);
  });

  it("animates water through the frame parameter while stone stays static", () => {
    const layers = structuredLayers([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:water" },
    ]);
    const { context, calls } = createRecordingContext();

    drawTerrain(context, layers, terrainStyleForFrame, 1);

    const fills = calls.filter(([op]) => op === "set:fillStyle").map(([, value]) => value);
    expect(fills).toEqual(["#4d5361", "#295a76"]);
  });

  it("frame 0 uses the static export fills", () => {
    const layers = structuredLayers([{ x: 0, y: 0, assetId: "terrain:water" }]);
    const { context, calls } = createRecordingContext();

    drawTerrain(context, layers, terrainStyleForFrame, 0);

    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
  });

  it("culls cells and edges outside the camera view", () => {
    const layers = structuredLayers([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
    ]);
    const { context, calls } = createRecordingContext();

    // Only cell (1,0) [50..100] intersects a view starting at x=60.
    drawTerrain(context, layers, terrainStyleForFrame, 0, { x: 60, y: 0, width: 200, height: 200 });

    const fillRects = calls.filter(([op]) => op === "fillRect");
    expect(fillRects).toEqual([["fillRect", 50, 0, 50, 50]]);
    // Cell (0,0)'s edges (max x = 50 < 60) are culled; cell (1,0) keeps
    // top, bottom, and right (its left edge is fused, not drawn).
    const segments = calls.filter(([op]) => op === "moveTo" || op === "lineTo");
    expect(segments).toEqual([
      ["moveTo", 50, 0],
      ["lineTo", 100, 0],
      ["moveTo", 50, 50],
      ["lineTo", 100, 50],
      ["moveTo", 100, 0],
      ["lineTo", 100, 50],
    ]);
  });

  it("draws nothing for a layer entirely outside the view", () => {
    const layers = structuredLayers([{ x: 0, y: 0, assetId: "terrain:water" }]);
    const { context, calls } = createRecordingContext();

    drawTerrain(context, layers, terrainStyleForFrame, 0, {
      x: 500,
      y: 500,
      width: 100,
      height: 100,
    });

    expect(calls).toEqual([]);
  });

  it("skips boundary strokes for a layer without edges", () => {
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:stone-floor",
      cells: [{ x: 0, y: 0, size: 50 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();

    drawTerrain(context, [layer], terrainStyleForFrame, 0);

    expect(calls).toEqual([
      ["set:fillStyle", "#4d5361"],
      ["fillRect", 0, 0, 50, 50],
    ]);
  });

  it("keeps edges whose 2px stroke still reaches into the view", () => {
    // The edge at x=100 sits outside a view starting at x=100.5, but its
    // centered 2px stroke paints [99, 101] — visible pixels must survive.
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:stone-floor",
      cells: [],
      edges: [{ orientation: "v", x1: 100, y1: 0, x2: 100, y2: 50 }],
    };
    const { context, calls } = createRecordingContext();

    drawTerrain(context, [layer], terrainStyleForFrame, 0, {
      x: 100.5,
      y: 0,
      width: 50,
      height: 50,
    });

    expect(calls).toContainEqual(["moveTo", 100, 0]);
    expect(calls).toContainEqual(["lineTo", 100, 50]);
  });
});

describe("parseGridPatternPath", () => {
  it("parses the square pattern's implicit lineto continuation", () => {
    expect(parseGridPatternPath(getGridGeometry("square", 50).path)).toEqual([
      {
        points: [
          { x: 50, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 50 },
        ],
        closed: false,
      },
    ]);
  });

  it("parses the hex-row pattern into a closed cell plus an open seam", () => {
    const height = Math.sqrt(3) * 50;
    expect(parseGridPatternPath(getGridGeometry("hex-row", 50).path)).toEqual([
      {
        points: [
          { x: 0, y: height / 2 },
          { x: 25, y: 0 },
          { x: 75, y: 0 },
          { x: 100, y: height / 2 },
          { x: 75, y: height },
          { x: 25, y: height },
        ],
        closed: true,
      },
      {
        points: [
          { x: 100, y: height / 2 },
          { x: 125, y: 0 },
          { x: 150, y: 0 },
        ],
        closed: false,
      },
    ]);
  });
});

describe("drawGrid", () => {
  const SQUARE = { ...getGridGeometry("square", 50), offsetX: 0, offsetY: 0 };

  it("tiles the square pattern across the visible view at half width (SVG pattern clipping)", () => {
    const { context, calls } = createRecordingContext();

    drawGrid(context, SQUARE, { x: 0, y: 0, width: 50, height: 50 });

    // Both square-lattice segments lie on the pattern tile's border, where
    // SVG clips half the stroke band away — the canvas halves the width.
    expect(calls).toEqual([
      ["save"],
      ["set:strokeStyle", "#ffffff"],
      ["set:globalAlpha", 0.16],
      ["set:lineWidth", 0.5],
      ["beginPath"],
      // Row-major tiles; the col/row at the far view edge is included so
      // the right/bottom border lines land exactly like the SVG pattern.
      ["moveTo", 50, 0],
      ["lineTo", 0, 0],
      ["moveTo", 0, 0],
      ["lineTo", 0, 50],
      ["moveTo", 100, 0],
      ["lineTo", 50, 0],
      ["moveTo", 50, 0],
      ["lineTo", 50, 50],
      ["moveTo", 50, 50],
      ["lineTo", 0, 50],
      ["moveTo", 0, 50],
      ["lineTo", 0, 100],
      ["moveTo", 100, 50],
      ["lineTo", 50, 50],
      ["moveTo", 50, 50],
      ["lineTo", 50, 100],
      ["stroke"],
      ["restore"],
    ]);
  });

  it("covers negative view origins with the offset lattice", () => {
    const { context, calls } = createRecordingContext();

    drawGrid(
      context,
      { ...SQUARE, offsetX: 10, offsetY: 20 },
      { x: -60, y: -50, width: 50, height: 50 },
    );

    const moves = calls.filter(([op]) => op === "moveTo");
    // Columns floor((-60-10)/50)=-2 .. floor((-10-10)/50)=-1; rows -2..-1.
    // Two segments per tile: moveTo (origin+50, origin) then (origin, origin).
    expect(moves).toEqual([
      ["moveTo", -40, -80],
      ["moveTo", -90, -80],
      ["moveTo", 10, -80],
      ["moveTo", -40, -80],
      ["moveTo", -40, -30],
      ["moveTo", -90, -30],
      ["moveTo", 10, -30],
      ["moveTo", -40, -30],
    ]);
  });

  it("splits the hex pattern into full-width interior and half-width border segments", () => {
    const pattern = { ...getGridGeometry("hex-row", 50), offsetX: 0, offsetY: 0 };
    const height = Math.sqrt(3) * 50;
    const { context, calls } = createRecordingContext();

    drawGrid(context, pattern, { x: 0, y: 0, width: 1, height: 1 });

    expect(calls).toEqual([
      ["save"],
      ["set:strokeStyle", "#ffffff"],
      ["set:globalAlpha", 0.16],
      // Interior pass: hex diagonals plus the closed outline's return leg.
      ["set:lineWidth", 1],
      ["beginPath"],
      ["moveTo", 0, height / 2],
      ["lineTo", 25, 0],
      ["moveTo", 75, 0],
      ["lineTo", 100, height / 2],
      ["moveTo", 100, height / 2],
      ["lineTo", 75, height],
      ["moveTo", 25, height],
      ["lineTo", 0, height / 2],
      ["moveTo", 100, height / 2],
      ["lineTo", 125, 0],
      ["stroke"],
      // Border pass: segments on the tile's top/bottom edges at half width.
      ["set:lineWidth", 0.5],
      ["beginPath"],
      ["moveTo", 25, 0],
      ["lineTo", 75, 0],
      ["moveTo", 75, height],
      ["lineTo", 25, height],
      ["moveTo", 125, 0],
      ["lineTo", 150, 0],
      ["stroke"],
      ["restore"],
    ]);
  });

  it("draws nothing for a degenerate pattern", () => {
    const { context, calls } = createRecordingContext();

    drawGrid(
      context,
      { width: 0, height: 0, path: "", offsetX: 0, offsetY: 0 },
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
    );

    expect(calls).toEqual([]);
  });
});
