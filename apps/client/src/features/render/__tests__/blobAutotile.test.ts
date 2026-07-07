import { describe, expect, it } from "vitest";
import { NEIGHBOR_BITS, quarterTileVariant, type QuarterCorner } from "../blobAutotile";

// Reference bit order (clockwise from north) — must match blobAutotile's
// documented NEIGHBOR_BITS. Duplicated here so the reduction below is an
// INDEPENDENT check, not the same table under test.
const N = 1;
const NE = 2;
const E = 4;
const SE = 8;
const S = 16;
const SW = 32;
const W = 64;
const NW = 128;

const CORNERS: QuarterCorner[] = ["tl", "tr", "bl", "br"];

/**
 * Independent reference for the classic "blob" (47-tile) reduction: every
 * edge bit is significant, but a diagonal bit only matters when BOTH of its
 * adjacent edges are present. Canonicalizing away the irrelevant diagonals
 * collapses the 256 neighbor configurations to the 47 distinct classes.
 * Reference: the 2-corner / "blob" autotiling method (cr31 terrain-transition
 * writeups); 47 = Σ over the 16 edge subsets of 2^(corners with both edges).
 */
function canonicalBlobMask(mask: number): number {
  let canon = mask & (N | E | S | W); // edges are always significant
  if (mask & N && mask & E) canon |= mask & NE;
  if (mask & S && mask & E) canon |= mask & SE;
  if (mask & S && mask & W) canon |= mask & SW;
  if (mask & N && mask & W) canon |= mask & NW;
  return canon;
}

function tupleFor(mask: number): [number, number, number, number] {
  return [
    quarterTileVariant(mask, "tl"),
    quarterTileVariant(mask, "tr"),
    quarterTileVariant(mask, "bl"),
    quarterTileVariant(mask, "br"),
  ];
}

// The diagonal bit for each corner (present between its two orthogonal edges).
const CORNER_DIAGONAL: Record<QuarterCorner, number> = {
  tl: NW,
  tr: NE,
  bl: SW,
  br: SE,
};
// The two orthogonal edge bits meeting at each corner.
const CORNER_EDGES: Record<QuarterCorner, [number, number]> = {
  tl: [N, W],
  tr: [N, E],
  bl: [S, W],
  br: [S, E],
};

describe("NEIGHBOR_BITS", () => {
  it("packs the 8 neighbors clockwise from north", () => {
    expect(NEIGHBOR_BITS).toEqual({ N, NE, E, SE, S, SW, W, NW });
  });
});

describe("quarterTileVariant", () => {
  it("returns a variant in 0..4 for every mask and corner", () => {
    for (let mask = 0; mask < 256; mask += 1) {
      for (const corner of CORNERS) {
        const variant = quarterTileVariant(mask, corner);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThanOrEqual(4);
      }
    }
  });

  it("reduces all 256 masks × 4 corners to exactly the 47 canonical blob classes", () => {
    // The set of distinct (tl,tr,bl,br) tuples must be in 1:1 correspondence
    // with the independent canonical-mask classes — and there must be 47.
    const tupleToCanon = new Map<string, number>();
    const canonToTuple = new Map<number, string>();
    for (let mask = 0; mask < 256; mask += 1) {
      const tupleKey = JSON.stringify(tupleFor(mask));
      const canon = canonicalBlobMask(mask);
      if (tupleToCanon.has(tupleKey)) {
        expect(tupleToCanon.get(tupleKey)).toBe(canon);
      } else {
        tupleToCanon.set(tupleKey, canon);
      }
      if (canonToTuple.has(canon)) {
        expect(canonToTuple.get(canon)).toBe(tupleKey);
      } else {
        canonToTuple.set(canon, tupleKey);
      }
    }
    expect(tupleToCanon.size).toBe(47);
    expect(canonToTuple.size).toBe(47);
  });

  it("consults a corner's diagonal only when both its orthogonal edges are present", () => {
    for (let mask = 0; mask < 256; mask += 1) {
      for (const corner of CORNERS) {
        const [edgeA, edgeB] = CORNER_EDGES[corner];
        const bothEdges = Boolean(mask & edgeA) && Boolean(mask & edgeB);
        const flipped = mask ^ CORNER_DIAGONAL[corner];
        if (bothEdges) {
          // Diagonal present → fill (4); absent → inner corner (3).
          expect(quarterTileVariant(mask, corner)).not.toBe(quarterTileVariant(flipped, corner));
        } else {
          // Diagonal is irrelevant — flipping it must not change the variant.
          expect(quarterTileVariant(mask, corner)).toBe(quarterTileVariant(flipped, corner));
        }
      }
    }
  });

  it("maps the five canonical corner states to distinct variants", () => {
    // tl corner: N is its vertical edge, W its horizontal edge, NW its diagonal.
    expect(quarterTileVariant(0, "tl")).toBe(0); // neither edge → outer corner
    expect(quarterTileVariant(W, "tl")).toBe(1); // horizontal edge only
    expect(quarterTileVariant(N, "tl")).toBe(2); // vertical edge only
    expect(quarterTileVariant(N | W, "tl")).toBe(3); // both edges, no diagonal → inner corner
    expect(quarterTileVariant(N | W | NW, "tl")).toBe(4); // both edges + diagonal → fill
  });

  it("keeps corners independent within one mask", () => {
    // Only N present: the two north corners see a vertical edge, south corners nothing.
    expect(tupleFor(N)).toEqual([2, 2, 0, 0]);
    // Only E present: the two east corners see a horizontal edge.
    expect(tupleFor(E)).toEqual([0, 1, 0, 1]);
    // Fully surrounded → every corner fills.
    expect(tupleFor(255)).toEqual([4, 4, 4, 4]);
    // Fully isolated → every corner is an outer corner.
    expect(tupleFor(0)).toEqual([0, 0, 0, 0]);
  });
});
