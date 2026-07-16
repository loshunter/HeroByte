import { describe, expect, it } from "vitest";
import { paintFloorDetail } from "../terrainFloorDetail";
import type { FloorDetail } from "../terrainPalette";
import type { TerrainCellRect, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

const ctxOf = (r: ReturnType<typeof createRecordingContext>) =>
  r.context as unknown as TileRenderContext2D;
const cellAt = (cellX: number, cellY: number, size = 64): TerrainCellRect => ({
  x: cellX * size,
  y: cellY * size,
  size,
  cellX,
  cellY,
});

const PLANK: FloorDetail = {
  kind: "plank",
  palette: { crev: "#4c3722", dark: "#6a4b31", mid: "#7a583a", light: "#886443" },
};
const FLAGSTONE: FloorDetail = {
  kind: "flagstone",
  palette: { crev: "#3a3f4a", dark: "#474d5a", mid: "#535a69", light: "#5f6675" },
};

const fillRects = (calls: RecordedCall[]) => calls.filter(([op]) => op === "fillRect");

function assertPainterContract(floor: FloorDetail) {
  it("paints detail as fillRects only (the bake's clip ctx forwards nothing else)", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellAt(3, 4), floor);
    expect(fillRects(r.calls).length).toBeGreaterThan(0);
    const ops = new Set(r.calls.map(([op]) => op));
    ops.delete("fillRect");
    ops.delete("set:fillStyle");
    expect([...ops]).toEqual([]);
  });

  it("is deterministic for a given cell", () => {
    const a = createRecordingContext();
    const b = createRecordingContext();
    paintFloorDetail(ctxOf(a), cellAt(7, 2), floor);
    paintFloorDetail(ctxOf(b), cellAt(7, 2), floor);
    expect(a.calls).toEqual(b.calls);
  });

  it("varies by cell position — coherent variation, not one repeating tile", () => {
    const signatures = new Set<string>();
    for (let x = 0; x < 12; x += 1) {
      for (let y = 0; y < 12; y += 1) {
        const r = createRecordingContext();
        paintFloorDetail(ctxOf(r), cellAt(x, y), floor);
        signatures.add(JSON.stringify(r.calls));
      }
    }
    expect(signatures.size).toBeGreaterThan(10);
  });

  it("keeps every rect inside the cell bounds", () => {
    const r = createRecordingContext();
    const cell = cellAt(2, 2);
    paintFloorDetail(ctxOf(r), cell, floor);
    for (const call of fillRects(r.calls)) {
      const [, x, y, w, h] = call as [string, number, number, number, number];
      expect(x).toBeGreaterThanOrEqual(cell.x);
      expect(x + w).toBeLessThanOrEqual(cell.x + cell.size);
      expect(y).toBeGreaterThanOrEqual(cell.y);
      expect(y + h).toBeLessThanOrEqual(cell.y + cell.size);
    }
  });

  it("draws only palette colors — nothing hardcoded (palette is data)", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellAt(5, 5), floor);
    const palette = new Set<string>(Object.values(floor.palette));
    const used = r.calls.filter(([op]) => op === "set:fillStyle").map((c) => c[1] as string);
    expect(used.length).toBeGreaterThan(0);
    for (const color of used) expect(palette.has(color)).toBe(true);
  });

  it("scales with cell size", () => {
    const small = createRecordingContext();
    const big = createRecordingContext();
    paintFloorDetail(ctxOf(small), { x: 0, y: 0, size: 32, cellX: 3, cellY: 4 }, floor);
    paintFloorDetail(ctxOf(big), { x: 0, y: 0, size: 128, cellX: 3, cellY: 4 }, floor);
    const maxX = (calls: RecordedCall[]) =>
      Math.max(...fillRects(calls).map((c) => c[1] as number));
    expect(maxX(big.calls)).toBeGreaterThan(maxX(small.calls) * 2);
  });
}

describe("paintFloorDetail — plank (wood grain)", () => {
  assertPainterContract(PLANK);

  it("plank seam rows continue across horizontally adjacent cells", () => {
    // Planks are architectural: the horizontal board seams must line up from
    // cell to cell or the floor reads as per-tile stickers. Compare the seam
    // rows (full-cell-width crev rects) of two neighbours on the same row.
    const seamRowsOf = (cellX: number) => {
      const r = createRecordingContext();
      const cell = cellAt(cellX, 3);
      paintFloorDetail(ctxOf(r), cell, PLANK);
      const rows = new Set<number>();
      let style = "";
      for (const call of r.calls) {
        if (call[0] === "set:fillStyle") style = call[1] as string;
        if (call[0] !== "fillRect") continue;
        const [, , y, w] = call as [string, number, number, number, number];
        if (style === PLANK.palette.crev && w === cell.size) rows.add(y - cell.y);
      }
      return rows;
    };
    const left = seamRowsOf(4);
    const right = seamRowsOf(5);
    expect(left.size).toBeGreaterThan(0);
    expect([...left].sort()).toEqual([...right].sort());
  });
});

describe("paintFloorDetail — flagstone (slab seams)", () => {
  assertPainterContract(FLAGSTONE);

  it("a smaller scale yields more, smaller slabs (cobblestone reuses the painter)", () => {
    const coarse = createRecordingContext();
    const fine = createRecordingContext();
    paintFloorDetail(ctxOf(coarse), cellAt(3, 3), FLAGSTONE);
    paintFloorDetail(ctxOf(fine), cellAt(3, 3), { ...FLAGSTONE, scale: 0.5 });
    expect(fillRects(fine.calls).length).toBeGreaterThan(fillRects(coarse.calls).length);
  });
});
