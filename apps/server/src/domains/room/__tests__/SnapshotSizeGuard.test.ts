// ============================================================================
// SNAPSHOT SIZE GUARD
// ============================================================================
// These measure RAW utf8 bytes, because that is what the runtime guard measures
// (`Buffer.byteLength(payload, "utf8")` in service.ts) and what actually goes
// out on the wire.
//
// They used to assert gzip/brotli sizes instead — an assumption that the socket
// compressed, which it does not: `perMessageDeflate` is configured nowhere, and
// the `ws` default is false. Nothing on this wire is ever compressed. That made
// the whole file ~5x too permissive on small payloads and ~58x on large ones
// (a 116k-cell painted map ships 936kb raw while gzipping to 16kb — the old
// assertion saw 2% of the limit for a snapshot that was 125% of it). A test
// asserting a number nobody enforces is worse than no test: it reports safety
// it never checked. If the wire ever does enable compression, change the
// RUNTIME guard first and let these follow it.

import { describe, it, expect } from "vitest";
import {
  compileScene,
  createTerrainMap,
  setTerrainCells,
  type CompiledScene,
  type MapElementsSnapshot,
  type RenderableMapElement,
} from "@herobyte/shared";
import { RoomService, SNAPSHOT_SIZE_LIMIT_BYTES } from "../service.js";
import { dungeonRecipe } from "../../generation/dungeonRecipe.js";

/** Exactly what service.ts weighs before it warns. */
function wireBytes(snapshot: unknown): number {
  return Buffer.byteLength(JSON.stringify(snapshot), "utf8");
}

describe("Snapshot size guard", () => {
  it("keeps a background + drawings payload below the guard", () => {
    const service = new RoomService();
    service.setState({
      mapBackground: "#".repeat(25_000),
      drawings: [
        {
          id: "drawing-1",
          type: "freehand",
          points: Array.from({ length: 50 }, (_, idx) => ({ x: idx, y: idx * 2 })),
          color: "#fff",
          width: 2,
          opacity: 1,
        },
      ],
    });

    expect(wireBytes(service.createSnapshot())).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });

  it("keeps a live-bound scene (200 walls + 40 doors + 2000 terrain cells) under the guard", () => {
    const compiledScene: CompiledScene = {
      schemaVersion: 1,
      sourceDocumentId: "live-doc",
      sourceRevision: 12,
      compiledAt: 1,
      width: 4096,
      height: 4096,
      walls: Array.from({ length: 200 }, (_, i) => ({
        id: `wall-${i}#0`,
        x1: i * 3,
        y1: 0,
        x2: i * 3 + 50,
        y2: 0,
        blocksMovement: true,
        blocksVision: true,
      })),
      doors: Array.from({ length: 40 }, (_, i) => ({
        id: `door-${i}`,
        x1: i * 5,
        y1: 100,
        x2: i * 5 + 40,
        y2: 100,
        state: "closed" as const,
        blocksMovement: true,
        blocksVision: true,
      })),
      lights: [],
    };

    let terrain = createTerrainMap();
    terrain = setTerrainCells(
      terrain,
      Array.from({ length: 2000 }, (_, i) => ({
        x: i % 64,
        y: Math.floor(i / 64),
        assetId: i % 2 === 0 ? "terrain:grass" : "terrain:dirt",
      })),
    );

    const service = new RoomService();
    service.setState({
      liveMapDocumentId: "live-doc",
      compiledScene,
      mapTerrain: { terrain, grid: { size: 50, offsetX: 0, offsetY: 0 }, opacity: 1 },
    });

    expect(wireBytes(service.createSnapshot())).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });

  it("keeps a MAXED generated dungeon (128x128 cells, high density) under the guard", () => {
    // The biggest thing one generate can produce: the 16384-cell region cap at
    // the densest setting. Built by the REAL recipe, not a synthetic stand-in,
    // so this tracks the generator rather than a guess about it.
    const bounds = { x: 0, y: 0, cols: 128, rows: 128 };
    const grid = {
      type: "square" as const,
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    };
    const output = dungeonRecipe(
      1,
      bounds,
      { theme: "stone", density: "high" },
      {
        grid,
        layerIds: { walls: "walls", lighting: "lighting", notes: "notes", objects: "objects" },
        idPrefix: "budget",
      },
    );

    let terrain = createTerrainMap();
    terrain = setTerrainCells(terrain, output.cells);
    const compiledScene = compileScene(
      {
        schemaVersion: 1,
        id: "live-doc",
        name: "doc",
        width: 8192,
        height: 8192,
        grid,
        layers: [
          {
            id: "walls",
            name: "w",
            kind: "walls",
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 0,
          },
          {
            id: "lighting",
            name: "l",
            kind: "lighting",
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 1,
          },
          {
            id: "notes",
            name: "n",
            kind: "notes",
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 2,
          },
          {
            id: "objects",
            name: "o",
            kind: "objects",
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 3,
          },
        ],
        elements: output.elements,
        revision: 1,
        createdAt: 0,
        updatedAt: 0,
      },
      1,
    );

    const service = new RoomService();
    service.setState({
      liveMapDocumentId: "live-doc",
      compiledScene,
      mapTerrain: { terrain, grid: { size: 50, offsetX: 0, offsetY: 0 }, opacity: 1 },
    });

    expect(wireBytes(service.createSnapshot())).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });

  it("keeps 500 mixed live-authored elements (tiles/stamps/shapes/text) under the guard", () => {
    const elements: RenderableMapElement[] = Array.from({ length: 500 }, (_, i) => {
      const transform = { x: i * 3, y: i * 2, scaleX: 1, scaleY: 1, rotation: 0 };
      switch (i % 4) {
        case 0:
          return {
            id: `t-${i}`,
            type: "tile",
            transform,
            data: { assetId: "tile:crate", columns: 1, rows: 1 },
          };
        case 1:
          return {
            id: `s-${i}`,
            type: "stamp",
            transform,
            data: { assetId: `upload:${i}`, width: 64, height: 64 },
          };
        case 2:
          return {
            id: `sh-${i}`,
            type: "shape",
            transform,
            data: {
              shape: "rectangle",
              points: [
                { x: 0, y: 0 },
                { x: 30, y: 30 },
              ],
              stroke: "#ffffff",
              strokeWidth: 2,
              opacity: 1,
            },
          };
        default:
          return {
            id: `x-${i}`,
            type: "text",
            transform,
            data: { text: `Label ${i}`, color: "#ffffff", fontSize: 16 },
          };
      }
    });
    const mapElements: MapElementsSnapshot = {
      grid: { size: 50, offsetX: 0, offsetY: 0 },
      layers: [{ opacity: 1, elements }],
    };

    const service = new RoomService();
    service.setState({ liveMapDocumentId: "live-doc", mapElements });

    expect(wireBytes(service.createSnapshot())).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });

  it("records where painted terrain actually crosses the guard", () => {
    // The headroom the gzip assertions were hiding. Terrain dominates a
    // snapshot's size, and one generate is capped at 16384 cells — but a DM can
    // run many, and nothing caps the TOTAL below MAX_TERRAIN_CHUNKS' ~4.2M.
    // ~35k painted cells is comfortable; ~116k ships 936kb and blows the 750KB
    // guard. That guard only WARNS (service.ts) — it never drops a frame — so
    // this documents a real ceiling rather than asserting a bound the runtime
    // would enforce for us. If terrain ever needs to scale past this, the fix
    // is chunked/delta terrain, not a bigger limit.
    const paint = (side: number) => {
      const cells = [];
      for (let x = 0; x < side; x++) {
        for (let y = 0; y < side; y++) {
          if ((x * 7 + y * 13) % 9 < 2) {
            cells.push({
              x,
              y,
              assetId: (x + y) % 2 ? "terrain:stone-floor" : "terrain:wood-floor",
            });
          }
        }
      }
      const service = new RoomService();
      service.setState({
        mapTerrain: {
          terrain: setTerrainCells(createTerrainMap(), cells),
          grid: { size: 50, offsetX: 0, offsetY: 0 },
          opacity: 1,
        },
      });
      return { cells: cells.length, bytes: wireBytes(service.createSnapshot()) };
    };

    const roomy = paint(384);
    expect(roomy.bytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);

    // The ceiling is real, and the old gzip assertion would have called this
    // snapshot 2% of the limit.
    const huge = paint(724);
    expect(huge.bytes).toBeGreaterThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });
});
