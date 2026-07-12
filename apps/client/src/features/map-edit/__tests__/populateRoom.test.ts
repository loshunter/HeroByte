import { describe, it, expect } from "vitest";
import type { MapDocument, MapGridSettings } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { buildPopulateDrafts, doorSegmentsWithin, populateSeedFromBounds } from "../populateRoom";
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
const inset = grid.size * 0.5;

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

  it("keeps a half-cell margin off the walls (no stamp breaches the inset region)", () => {
    const drafts = buildPopulateDrafts(bounds, grid, [crate], "high", 7, "objects", []);
    for (const d of drafts) {
      expect(d.x).toBeGreaterThanOrEqual(bounds.x + inset);
      expect(d.y).toBeGreaterThanOrEqual(bounds.y + inset);
      expect(d.x + d.width).toBeLessThanOrEqual(bounds.x + bounds.width - inset);
      expect(d.y + d.height).toBeLessThanOrEqual(bounds.y + bounds.height - inset);
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
