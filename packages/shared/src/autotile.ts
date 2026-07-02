// ============================================================================
// AUTOTILER — the Terrain Brush's pure core
// ============================================================================
// Classic bitmask autotiling: a cell's appearance is a pure function of which
// of its eight neighbors hold the same terrain. Corner neighbors only matter
// when both adjacent edges are present (a diagonal with no shared edge cannot
// influence the seam), which collapses the 256 raw neighborhoods into the
// canonical 47-blob tile set. quartersFor() additionally decomposes a cell
// into four sub-tiles (RPG Maker A2 style) so full blob sheets can be
// composed from quarter-tile art.
//
// Everything here is deterministic and side-effect free — the engine the
// vision's Terrain Brush, tileset packs, and generated maps all build on.

/** Neighbor bit layout, clockwise from north. */
export const NEIGHBOR = {
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128,
} as const;

export interface NeighborFlags {
  n: boolean;
  ne: boolean;
  e: boolean;
  se: boolean;
  s: boolean;
  sw: boolean;
  w: boolean;
  nw: boolean;
}

export function packNeighbors(flags: NeighborFlags): number {
  return (
    (flags.n ? NEIGHBOR.N : 0) |
    (flags.ne ? NEIGHBOR.NE : 0) |
    (flags.e ? NEIGHBOR.E : 0) |
    (flags.se ? NEIGHBOR.SE : 0) |
    (flags.s ? NEIGHBOR.S : 0) |
    (flags.sw ? NEIGHBOR.SW : 0) |
    (flags.w ? NEIGHBOR.W : 0) |
    (flags.nw ? NEIGHBOR.NW : 0)
  );
}

/**
 * Drop corner bits whose adjacent edges are not both present. The result is
 * one of the 47 canonical blob masks.
 */
export function suppressCorners(mask: number): number {
  let result = mask;
  if ((mask & (NEIGHBOR.N | NEIGHBOR.E)) !== (NEIGHBOR.N | NEIGHBOR.E)) {
    result &= ~NEIGHBOR.NE;
  }
  if ((mask & (NEIGHBOR.S | NEIGHBOR.E)) !== (NEIGHBOR.S | NEIGHBOR.E)) {
    result &= ~NEIGHBOR.SE;
  }
  if ((mask & (NEIGHBOR.S | NEIGHBOR.W)) !== (NEIGHBOR.S | NEIGHBOR.W)) {
    result &= ~NEIGHBOR.SW;
  }
  if ((mask & (NEIGHBOR.N | NEIGHBOR.W)) !== (NEIGHBOR.N | NEIGHBOR.W)) {
    result &= ~NEIGHBOR.NW;
  }
  return result;
}

/** The 47 canonical blob masks, ascending — the tile sheet's contract. */
export const BLOB_MASKS: readonly number[] = (() => {
  const masks = new Set<number>();
  for (let mask = 0; mask < 256; mask += 1) {
    masks.add(suppressCorners(mask));
  }
  return Object.freeze([...masks].sort((a, b) => a - b));
})();

const BLOB_INDEX = new Map(BLOB_MASKS.map((mask, index) => [mask, index]));

/** Stable 0..46 tile index for any raw 8-neighbor mask. */
export function blobIndex(mask: number): number {
  return BLOB_INDEX.get(suppressCorners(mask))!;
}

/**
 * One quarter of a cell, in RPG Maker A2 quarter-tile terms.
 * - edge-horizontal: the horizontal seam shows (no vertical neighbor)
 * - edge-vertical: the vertical seam shows (no horizontal neighbor)
 */
export type QuarterKind =
  | "interior"
  | "edge-horizontal"
  | "edge-vertical"
  | "outer-corner"
  | "inner-corner";

/**
 * Classify one corner quarter from its three relevant neighbors: the vertical
 * edge neighbor (N or S), the horizontal edge neighbor (E or W), and the
 * diagonal between them.
 */
export function quarterKind(
  hasVerticalNeighbor: boolean,
  hasHorizontalNeighbor: boolean,
  hasDiagonal: boolean,
): QuarterKind {
  if (hasVerticalNeighbor && hasHorizontalNeighbor) {
    return hasDiagonal ? "interior" : "inner-corner";
  }
  if (hasVerticalNeighbor) {
    // Connected vertically, open horizontally: the vertical seam shows.
    return "edge-vertical";
  }
  if (hasHorizontalNeighbor) {
    return "edge-horizontal";
  }
  return "outer-corner";
}

export interface QuarterKinds {
  nw: QuarterKind;
  ne: QuarterKind;
  sw: QuarterKind;
  se: QuarterKind;
}

/** Decompose a cell's neighborhood into its four quarter classifications. */
export function quartersFor(mask: number): QuarterKinds {
  const has = (bit: number) => (mask & bit) !== 0;
  return {
    nw: quarterKind(has(NEIGHBOR.N), has(NEIGHBOR.W), has(NEIGHBOR.NW)),
    ne: quarterKind(has(NEIGHBOR.N), has(NEIGHBOR.E), has(NEIGHBOR.NE)),
    sw: quarterKind(has(NEIGHBOR.S), has(NEIGHBOR.W), has(NEIGHBOR.SW)),
    se: quarterKind(has(NEIGHBOR.S), has(NEIGHBOR.E), has(NEIGHBOR.SE)),
  };
}
