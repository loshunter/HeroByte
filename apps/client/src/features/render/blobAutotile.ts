// Blob ("47-tile") quarter-tile autotiling math — pure, dependency-free.
//
// Each terrain cell is drawn as four quarter-tiles (tl, tr, bl, br). A
// quarter's appearance depends only on its three touching same-family
// neighbors: the two orthogonal edges meeting at that corner and the diagonal
// between them. The eight neighbors are packed into an 8-bit mask; a bit is
// SET when that neighbor is the SAME family — the inverse of the boundary
// `differs` test in map-studio/terrainRender's buildStructuredTerrainLayers.
//
// Bit order (clockwise from north):
//   N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128
//
// Per corner we reduce its (horizontal edge, vertical edge, diagonal) presence
// to five canonical quarter states:
//   0 — outer / convex corner  (neither orthogonal edge present)
//   1 — horizontal edge only   (the E/W edge present, the N/S edge absent)
//   2 — vertical edge only      (the N/S edge present, the E/W edge absent)
//   3 — inner / concave corner  (both edges present, the diagonal absent)
//   4 — interior fill           (both edges and the diagonal present)
//
// The diagonal is consulted ONLY when both orthogonal edges are present, so
// the 256 neighbor configurations collapse to exactly 47 distinct
// (tl,tr,bl,br) quarter-tuples — the classic "blob" / 47-tile set. Reference:
// the 2-corner ("blob") autotiling method (cr31 terrain-transition writeups);
// 47 = Σ over the 16 edge subsets of 2^(corners whose two edges are both set).

/** 8-neighbor bit values, clockwise from north. The single source of the mask
 * bit order — buildStructuredTerrainLayers composes masks from these. */
export const NEIGHBOR_BITS = {
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128,
} as const;

export type QuarterCorner = "tl" | "tr" | "bl" | "br";
export type QuarterVariant = 0 | 1 | 2 | 3 | 4;

/** Each corner's horizontal edge, vertical edge, and diagonal neighbor bits. */
const CORNER_NEIGHBORS: Record<QuarterCorner, { h: number; v: number; d: number }> = {
  tl: { h: NEIGHBOR_BITS.W, v: NEIGHBOR_BITS.N, d: NEIGHBOR_BITS.NW },
  tr: { h: NEIGHBOR_BITS.E, v: NEIGHBOR_BITS.N, d: NEIGHBOR_BITS.NE },
  bl: { h: NEIGHBOR_BITS.W, v: NEIGHBOR_BITS.S, d: NEIGHBOR_BITS.SW },
  br: { h: NEIGHBOR_BITS.E, v: NEIGHBOR_BITS.S, d: NEIGHBOR_BITS.SE },
};

/**
 * The quarter-tile state (0..4) for one corner of a cell, given its 8-neighbor
 * same-family bitmask. See the file header for the bit order and the five
 * canonical states.
 */
export function quarterTileVariant(neighborMask: number, corner: QuarterCorner): QuarterVariant {
  const { h, v, d } = CORNER_NEIGHBORS[corner];
  const hasH = (neighborMask & h) !== 0;
  const hasV = (neighborMask & v) !== 0;
  if (!hasH && !hasV) return 0; // outer / convex corner
  if (hasH && !hasV) return 1; // horizontal edge only
  if (!hasH && hasV) return 2; // vertical edge only
  // Both orthogonal edges present — the diagonal decides inner corner vs fill.
  return (neighborMask & d) !== 0 ? 4 : 3;
}
