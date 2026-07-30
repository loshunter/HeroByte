// Interior-detail ROUTING — which painter a family's cells draw with, and which
// lower neighbour decorates an exposed transition band. Split from
// proceduralTerrainSurface at its 350-LOC cap; the routing ladder and the
// tie-breaking order are behaviour contracts (they decide which art appears at
// every seam), so both moved verbatim.

import { makeTintCtx } from "./terrainDetailCtx";
import { drownHex, waterBandsFor } from "./terrainFieldColor";
import { paintCanopyDetail } from "./terrainCanopyDetail";
import { paintKeyClusterDetail, paintTerrainDetail } from "./terrainDetail";
import { paintFloorDetail } from "./terrainFloorDetail";
import { paintRoofDetail, paintStairsDetail } from "./terrainRoofDetail";
import { ALGAE_MAX_DEPTH, paintAlgaeTicks, paintWaterDetail } from "./terrainWaterDetail";
import { paintWallDetail } from "./terrainWallDetail";
import type { TerrainFamilyPalette } from "./terrainPalette";
import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";

/** Per-family palette keyed by terrain assetId (e.g. VILLAGE_TERRAIN). */
export type TerrainPalette = Record<string, TerrainFamilyPalette>;

/** Sunken detail stops past this water-body depth (whisper contrast). */
const SUNKEN_DETAIL_MAX_DEPTH = 3;

/** A drowned family's detail: its dry sibling's painters through the drown
 * tint (skipped entirely past the deep band), plus the shallow algae ticks.
 * A sunken entry must reference a NON-sunken sibling — chains don't render. */
function paintSunkenDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  sunken: NonNullable<TerrainFamilyPalette["sunken"]>,
  palette: TerrainPalette,
  depth: number,
): void {
  const sibling = palette[sunken.of];
  if (sibling && sibling.sunken === undefined && depth <= SUNKEN_DETAIL_MAX_DEPTH) {
    const bands = waterBandsFor(palette);
    const tinted = bands ? makeTintCtx(ctx, (hex) => drownHex(hex, depth, bands)) : ctx;
    paintFamilyDetail(tinted, cell, sunken.of, palette, 0);
  }
  if (sunken.algae && depth <= ALGAE_MAX_DEPTH) paintAlgaeTicks(ctx, cell, sunken.algae);
}

/** The painter ladder: first matching knob wins. Order is a contract — a
 * drowned family must drown before its sibling's material paints, and the
 * key-cluster/grass fallback is last. */
export function paintFamilyDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  assetId: string,
  palette: TerrainPalette,
  depth = 0,
): void {
  const fam = palette[assetId];
  if (fam?.sunken) paintSunkenDetail(ctx, cell, fam.sunken, palette, depth);
  else if (fam?.wall) paintWallDetail(ctx, cell, fam.wall);
  else if (fam?.roof) paintRoofDetail(ctx, cell, fam.roof);
  else if (fam?.stairs) paintStairsDetail(ctx, cell, fam.stairs);
  else if (fam?.floor) paintFloorDetail(ctx, cell, fam.floor);
  else if (fam?.water) paintWaterDetail(ctx, cell, fam.water, depth);
  else if (fam?.canopy) paintCanopyDetail(ctx, cell, fam.canopy, depth);
  else if (fam?.keyCluster) paintKeyClusterDetail(ctx, cell, fam.keyCluster);
  else paintTerrainDetail(ctx, cell, assetId, fam?.grass);
}

/** The most common lower-priority von-Neumann neighbour of a cell, or null. */
export function dominantLowerNeighbour(
  familyAt: (cx: number, cy: number) => string | null,
  cellX: number,
  cellY: number,
  priority: number,
  palette: TerrainPalette,
): string | null {
  const lower = [
    familyAt(cellX, cellY - 1),
    familyAt(cellX + 1, cellY),
    familyAt(cellX, cellY + 1),
    familyAt(cellX - 1, cellY),
  ].filter((id): id is string => id !== null && (palette[id]?.priority ?? 0) < priority);
  if (lower.length === 0) return null;
  let best = lower[0]!;
  let bestCount = 0;
  // `>=` breaks ties toward the LAST neighbour in [N, E, S, W] order, matching
  // the validated prototype (an ascending stable sort + `.pop()`), so the same
  // seam gets decorated as the reference render.
  for (const id of lower) {
    const count = lower.filter((z) => z === id).length;
    if (count >= bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}
