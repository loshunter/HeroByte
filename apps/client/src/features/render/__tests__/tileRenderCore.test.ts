import { describe, expect, it } from "vitest";
import { createMapDocument, paintTerrain } from "@herobyte/shared";
import { getGridGeometry } from "../../map-studio/gridGeometry";
import { buildStructuredTerrainLayers } from "../../map-studio/terrainRender";
import { buildTileOccupancy } from "../../map-studio/tileAutotiling";
import { terrainStyleForFrame } from "../../map-studio/starterTiles";
import { drawGrid, parseGridPatternPath } from "../gridRenderCore";
import {
  drawTerrain,
  type StructuredTerrainLayer,
  type TerrainAtlasSource,
  type TileRenderContext2D,
} from "../tileRenderCore";
import { createRecordingContext as createRawRecordingContext } from "./recordingContext";

function createRecordingContext() {
  const { context, calls } = createRawRecordingContext();
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
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();

    drawTerrain(context, [layer], terrainStyleForFrame, 0);

    expect(calls).toEqual([
      ["set:fillStyle", "#4d5361"],
      ["fillRect", 0, 0, 50, 50],
    ]);
  });

  it("draws atlas sub-rects for covered families, flat fills for the rest", () => {
    const layers = structuredLayers([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:water" },
    ]);
    const { context, calls } = createRecordingContext();
    const atlasImage = { width: 640 } as unknown as CanvasImageSource;
    const atlas = {
      image: atlasImage,
      // Stone maps to the atlas; water (animated) has no atlas art.
      tileForCell: (assetId: string, cellX: number, cellY: number) =>
        assetId === "terrain:stone-floor" ? { x: 128 * cellX, y: 384 + cellY, size: 128 } : null,
    };

    drawTerrain(context, layers, terrainStyleForFrame, 0, undefined, { atlas });

    // Stone cell (0,0) textures from its variant rect, scaled to the cell.
    expect(calls).toContainEqual(["drawImage", atlasImage, 0, 384, 128, 128, 0, 0, 50, 50]);
    // Water still flat-fills (and can animate via the frame parameter).
    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
    expect(calls).toContainEqual(["fillRect", 50, 0, 50, 50]);
    // Boundary strokes still draw for both families.
    expect(calls).toContainEqual(["moveTo", 100, 0]);
  });

  it("draws four quarter sub-images when the atlas provides quarter rects", () => {
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:grass",
      cells: [{ x: 0, y: 0, size: 50, cellX: 2, cellY: 3, neighborMask: 42 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();
    const atlasImage = { width: 640 } as unknown as CanvasImageSource;
    const receivedMasks: number[] = [];
    const atlas: TerrainAtlasSource = {
      image: atlasImage,
      // Whole-tile art also exists — the quarter path must take precedence.
      tileForCell: () => ({ x: 0, y: 0, size: 128 }),
      quarterRectsForCell: (assetId, _cellX, _cellY, neighborMask) => {
        receivedMasks.push(neighborMask);
        return assetId === "terrain:grass"
          ? [
              { x: 0, y: 0, size: 64 }, // tl
              { x: 64, y: 0, size: 64 }, // tr
              { x: 0, y: 64, size: 64 }, // bl
              { x: 64, y: 64, size: 64 }, // br
            ]
          : null;
      },
    };

    drawTerrain(context, [layer], terrainStyleForFrame, 0, undefined, { atlas });

    const draws = calls.filter(([op]) => op === "drawImage");
    // Each quarter blits its 64px source rect to its dest quarter (25×25).
    expect(draws).toEqual([
      ["drawImage", atlasImage, 0, 0, 64, 64, 0, 0, 25, 25], // tl
      ["drawImage", atlasImage, 64, 0, 64, 64, 25, 0, 25, 25], // tr
      ["drawImage", atlasImage, 0, 64, 64, 64, 0, 25, 25, 25], // bl
      ["drawImage", atlasImage, 64, 64, 64, 64, 25, 25, 25, 25], // br
    ]);
    // The whole-tile rect is never drawn — quarters win.
    expect(draws).not.toContainEqual(["drawImage", atlasImage, 0, 0, 128, 128, 0, 0, 50, 50]);
    // The cell's neighborMask is threaded through to the atlas (drawTerrain
    // also probes the family with mask 0 to detect blob47 art, hence toContain).
    expect(receivedMasks).toContain(42);
  });

  it("falls back to the whole-tile rect when the atlas returns no quarter rects", () => {
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:water",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();
    const atlasImage = { width: 640 } as unknown as CanvasImageSource;
    const atlas: TerrainAtlasSource = {
      image: atlasImage,
      tileForCell: () => ({ x: 5, y: 6, size: 128 }),
      quarterRectsForCell: () => null,
    };

    drawTerrain(context, [layer], terrainStyleForFrame, 0, undefined, { atlas });

    const draws = calls.filter(([op]) => op === "drawImage");
    expect(draws).toEqual([["drawImage", atlasImage, 5, 6, 128, 128, 0, 0, 50, 50]]);
  });

  it("snaps blob47 quarters to integer device pixels (kills atlas-bleed seams at fractional zoom)", () => {
    const transform = { a: 0.4, b: 0, c: 0, d: 0.4, e: 5.3, f: 5.7 };
    const { context, calls } = createRawRecordingContext(transform);
    const ctx = context as unknown as TileRenderContext2D;
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:grass",
      cells: [{ x: 90, y: 45, size: 50, cellX: 1, cellY: 1, neighborMask: 0 }],
      edges: [],
    };
    const atlas: TerrainAtlasSource = {
      image: {} as unknown as CanvasImageSource,
      tileForCell: () => null,
      quarterRectsForCell: () => [
        { x: 0, y: 0, size: 64 },
        { x: 64, y: 0, size: 64 },
        { x: 0, y: 64, size: 64 },
        { x: 64, y: 64, size: 64 },
      ],
    };

    drawTerrain(ctx, [layer], terrainStyleForFrame, 0, undefined, { atlas });

    const draws = calls.filter(([op]) => op === "drawImage");
    expect(draws).toHaveLength(4);
    // Every quarter's destination rect edges land on integer DEVICE pixels
    // (device = a*world + e), so the source sub-rects sample cleanly.
    for (const [, , , , , , dx, dy, dw, dh] of draws as [string, ...number[]][]) {
      for (const [v, s, t] of [
        [dx, transform.a, transform.e],
        [dy, transform.d, transform.f],
        [dx + dw, transform.a, transform.e],
        [dy + dh, transform.d, transform.f],
      ]) {
        const device = s * v + t;
        expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-6);
      }
    }
  });

  it("draws blob47 quarters with image smoothing off (crisp — no atlas bleed seams)", () => {
    const grass: StructuredTerrainLayer = {
      assetId: "terrain:grass",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0, neighborMask: 0 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();
    const atlas: TerrainAtlasSource = {
      image: { width: 640 } as unknown as CanvasImageSource,
      tileForCell: () => null,
      quarterRectsForCell: () => [
        { x: 0, y: 0, size: 64 },
        { x: 64, y: 0, size: 64 },
        { x: 0, y: 64, size: 64 },
        { x: 64, y: 64, size: 64 },
      ],
    };

    drawTerrain(context, [grass], terrainStyleForFrame, 0, undefined, { atlas });

    expect(calls).toContainEqual(["set:imageSmoothingEnabled", false]);
  });

  it("keeps image smoothing on for whole-tile atlas families", () => {
    const stone: StructuredTerrainLayer = {
      assetId: "terrain:stone-floor",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }],
      edges: [],
    };
    const { context, calls } = createRecordingContext();
    const atlas: TerrainAtlasSource = {
      image: {} as unknown as CanvasImageSource,
      tileForCell: () => ({ x: 0, y: 0, size: 128 }),
      quarterRectsForCell: () => null,
    };

    drawTerrain(context, [stone], terrainStyleForFrame, 0, undefined, { atlas });

    expect(calls).toContainEqual(["set:imageSmoothingEnabled", true]);
    expect(calls).not.toContainEqual(["set:imageSmoothingEnabled", false]);
  });

  it("suppresses the fused boundary stroke for families with quarter-tile art", () => {
    const grass: StructuredTerrainLayer = {
      assetId: "terrain:grass",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0, neighborMask: 0 }],
      edges: [{ orientation: "h", x1: 0, y1: 0, x2: 50, y2: 0 }],
    };
    const { context, calls } = createRecordingContext();
    const atlasImage = { width: 640 } as unknown as CanvasImageSource;
    const atlas: TerrainAtlasSource = {
      image: atlasImage,
      tileForCell: () => null,
      quarterRectsForCell: () => [
        { x: 0, y: 0, size: 64 },
        { x: 64, y: 0, size: 64 },
        { x: 0, y: 64, size: 64 },
        { x: 64, y: 64, size: 64 },
      ],
    };

    drawTerrain(context, [grass], terrainStyleForFrame, 0, undefined, { atlas });

    // The quarter art carries its own baked rim, so the straight fused stroke
    // is skipped entirely for this family.
    expect(calls.some(([op]) => op === "drawImage")).toBe(true);
    expect(calls.some(([op]) => op === "stroke")).toBe(false);
    expect(calls.some(([op]) => op === "set:strokeStyle")).toBe(false);
  });

  it("still strokes boundaries for atlas families without quarter-tile art", () => {
    const water: StructuredTerrainLayer = {
      assetId: "terrain:water",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }],
      edges: [{ orientation: "h", x1: 0, y1: 0, x2: 50, y2: 0 }],
    };
    const { context, calls } = createRecordingContext();
    const atlas: TerrainAtlasSource = {
      image: {} as unknown as CanvasImageSource,
      tileForCell: () => null,
      quarterRectsForCell: () => null,
    };

    drawTerrain(context, [water], terrainStyleForFrame, 0, undefined, { atlas });

    expect(calls.some(([op]) => op === "stroke")).toBe(true);
  });

  it("invokes the detail painter once per visible cell with its family id", () => {
    const layers = structuredLayers([
      { x: 0, y: 0, assetId: "terrain:grass" },
      { x: 1, y: 0, assetId: "terrain:grass" },
    ]);
    const { context } = createRecordingContext();
    const seen: Array<[number, number, string]> = [];
    drawTerrain(context, layers, terrainStyleForFrame, 0, undefined, {
      detail: (_ctx, cell, assetId) => seen.push([cell.cellX, cell.cellY, assetId]),
    });
    expect(seen).toEqual([
      [0, 0, "terrain:grass"],
      [1, 0, "terrain:grass"],
    ]);
  });

  it("honors a custom boundary width, including its cull margin", () => {
    const layer: StructuredTerrainLayer = {
      assetId: "terrain:stone-floor",
      cells: [],
      edges: [{ orientation: "v", x1: 100, y1: 0, x2: 100, y2: 50 }],
    };
    const { context, calls } = createRecordingContext();

    // Width 8 strokes reach 4px past the segment: an edge 3px outside the
    // view survives the cull and draws at the requested width.
    drawTerrain(
      context,
      [layer],
      terrainStyleForFrame,
      0,
      { x: 103, y: 0, width: 50, height: 50 },
      { boundaryWidth: 8 },
    );

    expect(calls).toContainEqual(["set:lineWidth", 8]);
    expect(calls).toContainEqual(["moveTo", 100, 0]);
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

  it("applies a custom style (the editor's cyan grid), halving border segments", () => {
    const { context, calls } = createRecordingContext();

    drawGrid(
      context,
      SQUARE,
      { x: 0, y: 0, width: 1, height: 1 },
      {
        color: "rgba(127,214,255,0.22)",
        alpha: 1,
        lineWidth: 2,
      },
    );

    expect(calls).toContainEqual(["set:strokeStyle", "rgba(127,214,255,0.22)"]);
    expect(calls).toContainEqual(["set:globalAlpha", 1]);
    expect(calls).toContainEqual(["set:lineWidth", 1]); // 2 halved on border segments
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
