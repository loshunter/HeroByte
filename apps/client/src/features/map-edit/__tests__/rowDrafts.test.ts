// Row placement (catalog rank 11): stamps repeated along a dragged segment
// as ONE add-elements command. Pins the gesture's contract — deterministic
// per endpoints, fixed 4-roll slots (a skip never shifts later stamps),
// interval from the footprint × per-asset rowSpacing, centre-on-the-line
// with bounded jitter, rotation following the segment angle.

import { describe, expect, it } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { buildRowDrafts, rowSeedFromDrag } from "../placementDrafts";
import { isDragTool } from "../mapEditToolKinds";

const document = createMapDocument({ id: "m", name: "M", timestamp: 1 }); // grid 50
const crate = getMapStudioTileAsset("objects:crate"); // 1×1, no rowSpacing
const lamp = getMapStudioTileAsset("objects:lamp"); // 1×1, rowSpacing 3
const A = { x: 100, y: 100 };
const B = { x: 700, y: 100 }; // 600px horizontal run

describe("buildRowDrafts", () => {
  it("is deterministic per drag and varies with the endpoints", () => {
    expect(buildRowDrafts(document, crate, A, B, "objects")).toEqual(
      buildRowDrafts(document, crate, A, B, "objects"),
    );
    expect(buildRowDrafts(document, crate, A, B, "objects")).not.toEqual(
      buildRowDrafts(document, crate, A, { x: 700, y: 150 }, "objects"),
    );
    expect(rowSeedFromDrag(A, B)).toBe(rowSeedFromDrag({ ...A }, { ...B }));
  });

  it("fills the run at the footprint interval, minus seeded skips", () => {
    const drafts = buildRowDrafts(document, crate, A, B, "objects");
    // 600px at 50px interval ⇒ 13 slots; skips may drop a few, never most.
    expect(drafts.length).toBeGreaterThanOrEqual(9);
    expect(drafts.length).toBeLessThanOrEqual(13);
    for (const d of drafts) {
      expect(d.layerId).toBe("objects");
      expect(d.assetId).toBe("objects:crate");
      expect(d.width).toBe(50);
      expect(d.height).toBe(50);
    }
  });

  it("honours the asset's rowSpacing (lamp posts every 3 cells)", () => {
    const lamps = buildRowDrafts(document, lamp, A, B, "objects");
    // 600px at 150px interval ⇒ 5 slots.
    expect(lamps.length).toBeGreaterThanOrEqual(4);
    expect(lamps.length).toBeLessThanOrEqual(5);
    // Consecutive kept lamps sit ~a multiple of 150px apart (± the 12% jitter).
    const xs = lamps.map((d) => d.x + d.width / 2).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      const gap = xs[i]! - xs[i - 1]!;
      const multiple = Math.round(gap / 150);
      expect(multiple).toBeGreaterThanOrEqual(1);
      expect(Math.abs(gap - multiple * 150)).toBeLessThanOrEqual(150 * 0.13 + 1);
    }
  });

  it("centres stamps on the line with bounded perpendicular wobble", () => {
    const drafts = buildRowDrafts(document, crate, A, B, "objects");
    for (const d of drafts) {
      const cy = d.y + d.height / 2;
      expect(Math.abs(cy - 100)).toBeLessThanOrEqual(50 * 0.06 + 1); // ±half the 12% band
    }
  });

  it("rotates each stamp to the segment angle plus a small jitter", () => {
    const diagonal = buildRowDrafts(document, crate, A, { x: 500, y: 500 }, "objects");
    expect(diagonal.length).toBeGreaterThan(4);
    for (const d of diagonal) {
      expect(Math.abs((d.rotation ?? 0) - 45)).toBeLessThanOrEqual(7.1);
    }
  });

  it("skips at least one slot on a long run (the lived-in gap)", () => {
    // 2000px ⇒ 41 slots at ~8% skip; the chance every slot survives is ~3%.
    // Deterministic seed — if this seed happens to keep all 41, pick another.
    const long = buildRowDrafts(document, crate, A, { x: 2100, y: 100 }, "objects");
    expect(long.length).toBeLessThan(41);
  });

  it("rejects a degenerate drag and caps a monster one", () => {
    expect(buildRowDrafts(document, crate, A, { x: 110, y: 100 }, "objects")).toEqual([]);
    const monster = buildRowDrafts(document, crate, A, { x: 100000, y: 100 }, "objects");
    expect(monster.length).toBeLessThanOrEqual(200);
  });
});

describe("row tool wiring", () => {
  it("row drives the drag machine", () => {
    expect(isDragTool("row")).toBe(true);
  });
});
