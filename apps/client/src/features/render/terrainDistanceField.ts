// Shore-distance transform — the input to depth-banded water (Czepeku study
// catalog #2). For one family's painted cells, the Chebyshev (8-way) BFS
// distance to the nearest cell that is NOT that family: shore-adjacent water
// is 1, deepening inward. Empty/unpainted cells count as shore, so a lone pool
// reads shallow all around its edge. Pure and allocation-light; the surface
// computes it once per bake alongside the cell occupancy it already builds.

import type { TerrainFamilyPalette } from "./terrainPaletteTypes";

/** `"x,y"` cell key, matching the field config's familyByCell keys. */
const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Every depth registration the field config needs, in one place (extracted
 * from proceduralTerrainSurface at its 350 cap): the combined water∪sunken
 * body, the combined canopy crown mass, and — new for the interleave
 * (catalog rank 12) — each pair MEMBER as its OWN body, so a family's
 * self-distance gates how far echo islands reach. One depthOf slot per
 * assetId: a family cannot be water-banded AND a canopy AND an interleave
 * member at once (the last registration would win; keep the roles disjoint).
 */
export function computeFieldDepths(
  familyByCell: ReadonlyMap<string, string>,
  ids: readonly string[],
  palette: Record<string, TerrainFamilyPalette>,
): Map<string, Map<string, number>> {
  const depths = computeBodyDepths(
    familyByCell,
    ids.filter((id) => (palette[id]!.depthBands?.length ?? 0) > 0 || palette[id]!.sunken),
  );
  const crownIds = ids.filter((id) => palette[id]!.canopy);
  for (const [id, map] of computeBodyDepths(familyByCell, crownIds)) depths.set(id, map);
  const pairIds = new Set<string>();
  for (const id of ids) {
    const interleave = palette[id]!.interleave;
    if (!interleave) continue;
    pairIds.add(id);
    if (palette[interleave.with]) pairIds.add(interleave.with);
  }
  for (const id of pairIds) {
    for (const [k, map] of computeBodyDepths(familyByCell, [id])) depths.set(k, map);
  }
  return depths;
}

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
 * ONE shore-distance transform for a whole water BODY — the depth-banded
 * water family plus every drowned (sunken) family — registered under EACH
 * member id. Drowned architecture is part of the body, so the bathymetry
 * flows continuously across it instead of reading it as shore, and a sunken
 * family's own depth (its drowning strength) is its distance from true land
 * in that same body. With no sunken cells painted this is exactly the
 * water's own BFS, bit for bit (pinned by sunkenStructures.test).
 */
export function computeBodyDepths(
  familyByCell: ReadonlyMap<string, string>,
  bodyIds: readonly string[],
): Map<string, Map<string, number>> {
  const depths = new Map<string, Map<string, number>>();
  if (bodyIds.length === 0) return depths;
  const body = new Set<string>();
  for (const [cellKey, id] of familyByCell) {
    if (bodyIds.includes(id)) body.add(cellKey);
  }
  const combined = computeShoreDistances(body);
  for (const id of bodyIds) depths.set(id, combined);
  return depths;
}

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
