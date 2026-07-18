// Maps an asset id back to a paint family, so the eyedropper can re-arm the
// floor/wall picker when it samples a terrain tile (e.g. "terrain:grass" →
// "grass"), plus the family groupings the Room wall ring needs.

import type { MapEditFloorFamily, MapEditWallFamily } from "./mapEditTypes";

/** The wall paint families, in toolbar order. */
export const WALL_FAMILIES: MapEditWallFamily[] = [
  "wall-stone",
  "wall-brick",
  "wall-timber",
  "wall-dark",
];

const FLOOR_FAMILIES: MapEditFloorFamily[] = [
  "grass",
  "dirt",
  "path",
  "stone-floor",
  "wood-floor",
  "stone-cobble",
  "stone-sandstone",
  "wood-walnut",
  "wood-grey",
  ...WALL_FAMILIES,
];

/**
 * The architectural interior floors a Room's wall ring must never overwrite —
 * an adjacent room's laid floor. Natural ground (grass/dirt/path) and walls
 * are fair game: walls stand on lawns, and ring-over-ring is how neighbouring
 * rooms share one wall band.
 */
export const INTERIOR_FLOOR_ASSET_IDS: ReadonlySet<string> = new Set([
  "terrain:stone-floor",
  "terrain:wood-floor",
  "terrain:stone-cobble",
  "terrain:stone-sandstone",
  "terrain:wood-walnut",
  "terrain:wood-grey",
]);

/** The paint family an asset id names (terrain:<family>), or null. */
export function floorFamilyFromAssetId(assetId: string): MapEditFloorFamily | null {
  const family = assetId.startsWith("terrain:") ? assetId.slice("terrain:".length) : "";
  return (FLOOR_FAMILIES as string[]).includes(family) ? (family as MapEditFloorFamily) : null;
}

export function isFloorFamilyAssetId(assetId: string): boolean {
  return floorFamilyFromAssetId(assetId) !== null;
}
