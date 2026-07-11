import { describe, it, expect } from "vitest";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { createTerrainMap, setTerrainCells, type CompiledScene } from "@herobyte/shared";
import { RoomService, SNAPSHOT_SIZE_LIMIT_BYTES } from "../service.js";

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
});
