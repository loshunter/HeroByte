import { describe, it, expect } from "vitest";
import { brotliCompressSync, gzipSync } from "node:zlib";
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

describe("Snapshot compression guard", () => {
  it("keeps gzip and brotli payloads below configured guard", () => {
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

    const snapshot = service.createSnapshot();
    const payload = Buffer.from(JSON.stringify(snapshot), "utf8");

    const gzipBytes = gzipSync(payload).length;
    const brotliBytes = brotliCompressSync(payload).length;

    expect(gzipBytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    expect(brotliBytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
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

    const payload = Buffer.from(JSON.stringify(service.createSnapshot()), "utf8");

    expect(gzipSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    expect(brotliCompressSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
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

    const payload = Buffer.from(JSON.stringify(service.createSnapshot()), "utf8");

    expect(gzipSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    expect(brotliCompressSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
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

    const payload = Buffer.from(JSON.stringify(service.createSnapshot()), "utf8");

    expect(gzipSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    expect(brotliCompressSync(payload).length).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });
});
