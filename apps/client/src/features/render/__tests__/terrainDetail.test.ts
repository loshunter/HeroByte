import { describe, expect, it } from "vitest";
import { paintTerrainDetail } from "../terrainDetail";
import type { TerrainCellRect, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext } from "./recordingContext";

const ctxOf = (r: ReturnType<typeof createRecordingContext>) =>
  r.context as unknown as TileRenderContext2D;
const grassCell = (cellX: number, cellY: number): TerrainCellRect => ({
  x: cellX * 64,
  y: cellY * 64,
  size: 64,
  cellX,
  cellY,
});

describe("paintTerrainDetail", () => {
  it("paints grass decoration as fillRects", () => {
    const r = createRecordingContext();
    paintTerrainDetail(ctxOf(r), grassCell(3, 4), "terrain:grass");
    expect(r.calls.filter(([op]) => op === "fillRect").length).toBeGreaterThan(0);
  });

  it("does nothing for families without detail", () => {
    const r = createRecordingContext();
    paintTerrainDetail(ctxOf(r), grassCell(3, 4), "terrain:water");
    expect(r.calls).toEqual([]);
  });

  it("is deterministic for a given cell", () => {
    const a = createRecordingContext();
    const b = createRecordingContext();
    paintTerrainDetail(ctxOf(a), grassCell(5, 6), "terrain:grass");
    paintTerrainDetail(ctxOf(b), grassCell(5, 6), "terrain:grass");
    expect(a.calls).toEqual(b.calls);
  });

  it("varies by cell position — coherent noise, not one repeating tile", () => {
    // Scan a region; the decoration must differ across cells (blob density
    // field) rather than being identical everywhere.
    const signatures = new Set<string>();
    for (let x = 0; x < 12; x += 1) {
      for (let y = 0; y < 12; y += 1) {
        const r = createRecordingContext();
        paintTerrainDetail(ctxOf(r), grassCell(x, y), "terrain:grass");
        signatures.add(JSON.stringify(r.calls));
      }
    }
    expect(signatures.size).toBeGreaterThan(10);
  });

  it("keeps all decoration inside the cell bounds", () => {
    const r = createRecordingContext();
    const cell = grassCell(2, 2);
    paintTerrainDetail(ctxOf(r), cell, "terrain:grass");
    for (const call of r.calls) {
      if (call[0] !== "fillRect") continue;
      const [, x, y, w, h] = call as [string, number, number, number, number];
      expect(x).toBeGreaterThanOrEqual(cell.x);
      expect(x + w).toBeLessThanOrEqual(cell.x + cell.size);
      expect(y).toBeGreaterThanOrEqual(cell.y);
      expect(y + h).toBeLessThanOrEqual(cell.y + cell.size);
    }
  });

  it("scales decoration with cell size", () => {
    const small = createRecordingContext();
    const big = createRecordingContext();
    paintTerrainDetail(ctxOf(small), { x: 0, y: 0, size: 32, cellX: 3, cellY: 4 }, "terrain:grass");
    paintTerrainDetail(ctxOf(big), { x: 0, y: 0, size: 128, cellX: 3, cellY: 4 }, "terrain:grass");
    const maxX = (calls: typeof small.calls) =>
      Math.max(...calls.filter(([op]) => op === "fillRect").map((c) => c[1] as number));
    expect(maxX(big.calls)).toBeGreaterThan(maxX(small.calls) * 2);
  });
});
