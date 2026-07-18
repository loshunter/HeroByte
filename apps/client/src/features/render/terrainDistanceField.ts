// Shore-distance transform — the input to depth-banded water (Czepeku study
// catalog #2). For one family's painted cells, the Chebyshev (8-way) BFS
// distance to the nearest cell that is NOT that family: shore-adjacent water
// is 1, deepening inward. Empty/unpainted cells count as shore, so a lone pool
// reads shallow all around its edge. Pure and allocation-light; the surface
// computes it once per bake alongside the cell occupancy it already builds.

/** `"x,y"` cell key, matching the field config's familyByCell keys. */
const key = (x: number, y: number): string => `${x},${y}`;

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * Distance (in cells, Chebyshev) from each of `cells` to the nearest cell
 * outside the set. Cells not in the returned map are outside the family —
 * callers read them as 0 (shore).
 */
export function computeShoreDistances(cells: ReadonlySet<string>): Map<string, number> {
  const distances = new Map<string, number>();
  let ring: string[] = [];

  for (const cellKey of cells) {
    const [x, y] = cellKey.split(",").map(Number) as [number, number];
    const onShore = NEIGHBOURS.some(([dx, dy]) => !cells.has(key(x + dx, y + dy)));
    if (onShore) {
      distances.set(cellKey, 1);
      ring.push(cellKey);
    }
  }
  // A set with no shore cells is impossible for finite painted terrain, but
  // guard the loop anyway: everything unreachable stays at the deep default.
  let depth = 1;
  while (ring.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const cellKey of ring) {
      const [x, y] = cellKey.split(",").map(Number) as [number, number];
      for (const [dx, dy] of NEIGHBOURS) {
        const nk = key(x + dx, y + dy);
        if (cells.has(nk) && !distances.has(nk)) {
          distances.set(nk, depth);
          next.push(nk);
        }
      }
    }
    ring = next;
  }
  return distances;
}
