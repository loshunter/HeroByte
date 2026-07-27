// Tilled farm furrows — the `furrow` floor kind (island benchmark arc).
// Pins: rows default horizontal so a square plot ploughs one way edge to
// edge, a clearly vertical 1-wide strip turns them vertical, crop ticks ride
// the ridges, the painter keeps the fillRect-only contract, the family joins
// the ring-protection set, and it is wired through the floor lists.

import { describe, expect, it } from "vitest";
import { NEIGHBOR_BITS } from "../blobAutotile";
import { paintFloorDetail } from "../terrainFloorDetail";
import { FURROW_DETAIL } from "../terrainMaterialPalettes";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import { INTERIOR_FLOOR_ASSET_IDS, floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTileAssets";
import type { FloorDetail } from "../terrainPalette";
import type { TerrainCellRect, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

const SIZE = 50;
const FURROW: FloorDetail = { kind: "furrow", palette: FURROW_DETAIL };

const ctxOf = (r: ReturnType<typeof createRecordingContext>) =>
  r.context as unknown as TileRenderContext2D;

const cellWith = (mask: number, cellX = 3, cellY = 5): TerrainCellRect => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
  neighborMask: mask,
});

const fillRects = (calls: RecordedCall[]) =>
  calls.filter(([op]) => op === "fillRect") as [string, number, number, number, number][];

/** The colour set at the time of each fillRect (recording contexts interleave
 * set:fillStyle and fillRect calls in order). */
function rectsWithStyle(calls: RecordedCall[]): [string, number, number, number, number][] {
  let style = "";
  const out: [string, number, number, number, number][] = [];
  for (const call of calls) {
    if (call[0] === "set:fillStyle") style = call[1] as string;
    else if (call[0] === "fillRect")
      out.push([style, call[1] as number, call[2] as number, call[3] as number, call[4] as number]);
  }
  return out;
}

describe("furrow painter", () => {
  it("ploughs a square plot's interior horizontally, edge to edge", () => {
    // Interior cell (all 4 neighbours) — ambiguous mask defaults horizontal.
    const r = createRecordingContext();
    paintFloorDetail(
      ctxOf(r),
      cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.E | NEIGHBOR_BITS.S | NEIGHBOR_BITS.W),
      FURROW,
    );
    const trenches = fillRects(r.calls).filter(([, , , w2, h]) => w2 === SIZE && h < SIZE * 0.1);
    expect(trenches.length).toBeGreaterThanOrEqual(3);
  });

  it("turns the rows vertical on a 1-wide vertical strip", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellWith(NEIGHBOR_BITS.N | NEIGHBOR_BITS.S), FURROW);
    const trenches = fillRects(r.calls).filter(([, , , w2, h]) => h === SIZE && w2 < SIZE * 0.1);
    expect(trenches.length).toBeGreaterThanOrEqual(3);
  });

  it("grows crop ticks on the ridges", () => {
    const r = createRecordingContext();
    paintFloorDetail(ctxOf(r), cellWith(0), FURROW);
    const crops = rectsWithStyle(r.calls).filter(([style]) => style === FURROW_DETAIL.light);
    expect(crops.length).toBeGreaterThan(0);
  });

  it("keeps the fillRect-only contract and stays deterministic", () => {
    const a = createRecordingContext();
    const b = createRecordingContext();
    paintFloorDetail(ctxOf(a), cellWith(0), FURROW);
    paintFloorDetail(ctxOf(b), cellWith(0), FURROW);
    expect(a.calls).toEqual(b.calls);
    const ops = new Set(a.calls.map(([op]) => op));
    ops.delete("fillRect");
    ops.delete("set:fillStyle");
    expect([...ops]).toEqual([]);
  });

  it("joins the ring-protection set and the floor lists", () => {
    expect(INTERIOR_FLOOR_ASSET_IDS.has("terrain:farm-furrow")).toBe(true);
    expect(floorFamilyFromAssetId("terrain:farm-furrow")).toBe("farm-furrow");
    const asset = MAP_STUDIO_TILE_ASSETS.find((a2) => a2.id === "terrain:farm-furrow");
    expect(asset?.fill).toBe(VILLAGE_TERRAIN["terrain:farm-furrow"]!.base);
  });
});
