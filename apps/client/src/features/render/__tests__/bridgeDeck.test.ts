// Log-rib bridge deck — the `bridge` floor kind (structure treatments: dock
// and bridge ribbons). Pins: boards lie PERPENDICULAR to the neighbour-mask
// run, sliver gaps leave the dark base showing between boards, stringers rail
// only edges facing open air, run ends grow post blocks, the painter stays
// inside the fillRect-only contract, and the family is wired through the
// map-edit floor lists + starter tiles.

import { describe, expect, it } from "vitest";
import { NEIGHBOR_BITS } from "../blobAutotile";
import { paintFloorDetail } from "../terrainFloorDetail";
import { BRIDGE_PLANK_DETAIL } from "../terrainMaterialPalettes";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import { floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTileAssets";
import type { FloorDetail } from "../terrainPalette";
import type { TerrainCellRect, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

const SIZE = 50;
const BRIDGE: FloorDetail = { kind: "bridge", palette: BRIDGE_PLANK_DETAIL };

const ctxOf = (r: ReturnType<typeof createRecordingContext>) =>
  r.context as unknown as TileRenderContext2D;

const cellWith = (mask: number, cellX = 4, cellY = 7): TerrainCellRect => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
  neighborMask: mask,
});

const fillRects = (calls: RecordedCall[]) =>
  calls.filter(([op]) => op === "fillRect") as [string, number, number, number, number][];

describe("bridge deck painter", () => {
  it("lays boards perpendicular to the run (vertical run ⇒ wide boards)", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), BRIDGE);
    // Full-width board rects (w === SIZE) must exist; no full-height ones.
    const rects = fillRects(r.calls);
    expect(rects.some(([, , , w, h]) => w === SIZE && h < SIZE)).toBe(true);
    expect(rects.some(([, , , w, h]) => h === SIZE && w < SIZE && w > SIZE * 0.1)).toBe(false);
  });

  it("lays boards the other way on a horizontal run", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellWith(NEIGHBOR_BITS.E | NEIGHBOR_BITS.W), BRIDGE);
    const rects = fillRects(r.calls);
    expect(rects.some(([, , , w, h]) => h === SIZE && w < SIZE)).toBe(true);
  });

  it("leaves sliver gaps: boards never tile the full run axis", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), BRIDGE);
    const boards = fillRects(r.calls).filter(([, , , w]) => w === SIZE);
    const covered = boards.reduce((sum, [, , , , h]) => sum + h, 0);
    expect(covered).toBeLessThan(SIZE * 0.95);
  });

  it("rails only the edges that face open air", () => {
    // Vertical run with an E neighbour (a 2-wide deck's left column): stringer
    // on the W edge only.
    const r = createRecordingContext();
    paintFloorDetail(
      ctxOf(r),
      cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S | NEIGHBOR_BITS.E),
      BRIDGE,
    );
    const rails = fillRects(r.calls).filter(([, , , w, h]) => h === SIZE && w < SIZE * 0.1);
    expect(rails.length).toBe(1);
    expect(rails[0]![1]).toBe(4 * SIZE); // flush with the cell's W edge
  });

  it("grows post blocks on the open end of a run", () => {
    const withEnd = createRecordingContext();
    paintFloorDetail(ctxOf(withEnd), cellWith(NEIGHBOR_BITS.N), BRIDGE); // S end open
    const mid = createRecordingContext();
    paintFloorDetail(ctxOf(mid), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), BRIDGE);
    const posts = (calls: RecordedCall[]) =>
      fillRects(calls).filter(([, , , w, h]) => w === h && w === SIZE * 0.14);
    expect(posts(withEnd.calls).length).toBe(2);
    expect(posts(mid.calls).length).toBe(0);
  });

  it("keeps the fillRect-only contract and stays deterministic", () => {
    const a = createRecordingContext();
    const b = createRecordingContext();
    paintFloorDetail(ctxOf(a), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), BRIDGE);
    paintFloorDetail(ctxOf(b), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), BRIDGE);
    expect(a.calls).toEqual(b.calls);
    const ops = new Set(a.calls.map(([op]) => op));
    ops.delete("fillRect");
    ops.delete("set:fillStyle");
    expect([...ops]).toEqual([]);
  });

  it("is reachable from the map-edit floor lists and the starter tiles", () => {
    expect(floorFamilyFromAssetId("terrain:bridge-plank")).toBe("bridge-plank");
    const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === "terrain:bridge-plank");
    expect(asset?.fill).toBe(VILLAGE_TERRAIN["terrain:bridge-plank"]!.base);
  });
});
