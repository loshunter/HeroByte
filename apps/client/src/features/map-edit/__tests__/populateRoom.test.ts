import { describe, it, expect } from "vitest";
import type { MapDocument, MapGridSettings } from "@herobyte/shared";
import { createMapDocument, paintTerrain } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import {
  buildPopulateDrafts,
  doorSegmentsWithin,
  populateSeedFromBounds,
  regionHasFloor,
} from "../populateRoom";
import type { RoomBounds } from "../roomBuilder";

const grid: MapGridSettings = {
  type: "square",
  size: 50,
  squareSize: 5,
  offsetX: 0,
  offsetY: 0,
  visible: true,
  snap: true,
};

const bounds: RoomBounds = { x: 0, y: 0, width: 500, height: 500 }; // 10×10 cells
const crate = getMapStudioTileAsset("objects:crate"); // 1×1

describe("buildPopulateDrafts", () => {
  it("is deterministic — identical inputs produce identical drafts", () => {
    const a = buildPopulateDrafts(bounds, grid, [crate], "high", 4242, "objects", []);
    const b = buildPopulateDrafts(bounds, grid, [crate], "high", 4242, "objects", []);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("varies with the seed", () => {
    const a = buildPopulateDrafts(bounds, grid, [crate], "high", 1, "objects", []);
    const b = buildPopulateDrafts(bounds, grid, [crate], "high", 2, "objects", []);
    expect(a).not.toEqual(b);
  });

  it("keeps every stamp's footprint inside the room walls (flush is allowed, spill is not)", () => {
    const drafts = buildPopulateDrafts(bounds, grid, [crate], "high", 7, "objects", []);
    for (const d of drafts) {
      expect(d.x).toBeGreaterThanOrEqual(bounds.x);
      expect(d.y).toBeGreaterThanOrEqual(bounds.y);
      expect(d.x + d.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(d.y + d.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it("populates a 2-cell-wide region — the default hallway width — instead of nothing", () => {
    // A width-2 corridor: the old half-cell inset rejected every cell, so no
    // density setting could ever place a stamp. Now edge cells are eligible.
    const hallway: RoomBounds = { x: 0, y: 0, width: 250, height: 100 }; // 5×2 cells
    for (const density of ["low", "medium", "high"] as const) {
      const drafts = buildPopulateDrafts(hallway, grid, [crate], density, 123, "objects", []);
      for (const d of drafts) {
        expect(d.x).toBeGreaterThanOrEqual(hallway.x);
        expect(d.y).toBeGreaterThanOrEqual(hallway.y);
        expect(d.x + d.width).toBeLessThanOrEqual(hallway.x + hallway.width);
        expect(d.y + d.height).toBeLessThanOrEqual(hallway.y + hallway.height);
      }
    }
    // At high density a 10-cell corridor reliably lands at least one stamp.
    expect(
      buildPopulateDrafts(hallway, grid, [crate], "high", 123, "objects", []).length,
    ).toBeGreaterThan(0);
  });

  it("keeps a ROTATED multi-cell stamp's footprint inside the walls (rotation-aware bounds)", () => {
    const table = getMapStudioTileAsset("objects:table"); // 2×1
    const drafts = buildPopulateDrafts(bounds, grid, [table], "high", 31, "objects", []);
    const rotatedCount = drafts.filter((d) => (d.rotation ?? 0) % 180 !== 0).length;
    expect(rotatedCount).toBeGreaterThan(0); // the seed exercises rotated placements
    for (const d of drafts) {
      const rotated = (d.rotation ?? 0) % 180 !== 0;
      const fw = rotated ? d.height : d.width;
      const fh = rotated ? d.width : d.height;
      const cx = d.x + d.width / 2;
      const cy = d.y + d.height / 2;
      // The rotated footprint (swapped w/h about the center) stays within bounds.
      expect(cx - fw / 2).toBeGreaterThanOrEqual(bounds.x);
      expect(cy - fh / 2).toBeGreaterThanOrEqual(bounds.y);
      expect(cx + fw / 2).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(cy + fh / 2).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it("never places a stamp within a cell of a door", () => {
    // Door segment across the room's middle row.
    const door = [{ x1: 100, y1: 275, x2: 200, y2: 275 }];
    const drafts = buildPopulateDrafts(bounds, grid, [crate], "high", 9, "objects", door);
    for (const d of drafts) {
      const cx = d.x + d.width / 2;
      const cy = d.y + d.height / 2;
      const dist = pointSeg(cx, cy, door[0]!);
      expect(dist).toBeGreaterThanOrEqual(grid.size);
    }
  });

  it("clears a MULTI-CELL stamp's whole footprint from doors (not just its center)", () => {
    const table = getMapStudioTileAsset("objects:table"); // 2×1
    const door = [{ x1: 200, y1: 200, x2: 250, y2: 200 }];
    const drafts = buildPopulateDrafts(bounds, grid, [table], "high", 11, "objects", door);
    const clearance = Math.hypot((2 * grid.size) / 2, grid.size / 2) + grid.size / 2;
    for (const d of drafts) {
      const cx = d.x + d.width / 2;
      const cy = d.y + d.height / 2;
      // The bounding-circle clearance guarantees the footprint can't straddle the door.
      expect(pointSeg(cx, cy, door[0]!)).toBeGreaterThanOrEqual(clearance);
    }
  });

  it("returns nothing when no assets are supplied", () => {
    expect(buildPopulateDrafts(bounds, grid, [], "high", 1, "objects", [])).toEqual([]);
  });

  it("scales with density (high places more than low)", () => {
    const low = buildPopulateDrafts(bounds, grid, [crate], "low", 3, "objects", []);
    const high = buildPopulateDrafts(bounds, grid, [crate], "high", 3, "objects", []);
    expect(high.length).toBeGreaterThan(low.length);
  });
});

describe("populateSeedFromBounds", () => {
  it("is stable per origin and a non-negative integer", () => {
    const seed = populateSeedFromBounds(bounds);
    expect(seed).toBe(populateSeedFromBounds({ ...bounds }));
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it("differs for regions at different origins", () => {
    expect(populateSeedFromBounds(bounds)).not.toBe(populateSeedFromBounds({ ...bounds, x: 400 }));
  });
});

describe("regionHasFloor", () => {
  it("is true when the region has painted terrain and false when it is empty", () => {
    let doc = createMapDocument({ id: "m", name: "M", timestamp: 1 });
    doc = paintTerrain(doc, [{ x: 2, y: 2, assetId: "terrain:grass" }], 2);
    expect(regionHasFloor(doc, bounds)).toBe(true); // bounds covers cells 0–9
    expect(regionHasFloor(doc, { x: 5000, y: 5000, width: 100, height: 100 })).toBe(false);
  });

  it("is false for a document with no terrain at all (room undone)", () => {
    const empty = createMapDocument({ id: "e", name: "E", timestamp: 1 });
    expect(regionHasFloor(empty, bounds)).toBe(false);
  });
});

describe("doorSegmentsWithin", () => {
  it("compiles door elements inside the region to segments", () => {
    const document = {
      elements: [
        {
          id: "d1",
          layerId: "walls",
          type: "door",
          locked: false,
          hidden: false,
          transform: { x: 100, y: 275, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { width: 100, state: "closed", blocksMovement: true, blocksVision: true },
        },
        {
          id: "d2",
          layerId: "walls",
          type: "door",
          locked: false,
          hidden: false,
          transform: { x: 9000, y: 9000, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { width: 100, state: "closed", blocksMovement: true, blocksVision: true },
        },
      ],
    } as unknown as MapDocument;
    const segments = doorSegmentsWithin(document, bounds);
    expect(segments).toHaveLength(1); // only the in-region door
    expect(segments[0]).toEqual({ x1: 100, y1: 275, x2: 200, y2: 275 });
  });
});

function pointSeg(px: number, py: number, seg: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - seg.x1) * dx + (py - seg.y1) * dy) / lenSq));
  return Math.hypot(px - (seg.x1 + t * dx), py - (seg.y1 + t * dy));
}
