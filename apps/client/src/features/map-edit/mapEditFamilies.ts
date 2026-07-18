// Maps an asset id back to a paint family, so the eyedropper can re-arm the
// floor/wall picker when it samples a terrain tile (e.g. "terrain:grass" →
// "grass"), plus the family groupings the Room wall ring needs.

import type { MapEditFloorFamily, MapEditRoofFamily, MapEditWallFamily } from "./mapEditTypes";

/** The wall paint families, in toolbar order. */
export const WALL_FAMILIES: MapEditWallFamily[] = [
  "wall-stone",
  "wall-brick",
  "wall-timber",
  "wall-dark",
];

/** The roof paint families, in toolbar order. */
export const ROOF_FAMILIES: MapEditRoofFamily[] = ["roof-shingle", "roof-thatch"];

const FLOOR_FAMILIES: MapEditFloorFamily[] = [
  "grass",
  "dirt",
  "path",
  "water",
  "stone-floor",
  "wood-floor",
  "stone-cobble",
  "stone-sandstone",
  "wood-walnut",
  "wood-grey",
  "stairs-stone",
  ...WALL_FAMILIES,
  ...ROOF_FAMILIES,
];

/**
 * The laid interior surfaces a Room/Hallway wall band must never overwrite —
 * an adjacent room's floor or a staircase. Natural ground (grass/dirt/path),
 * walls and roofs are fair game: walls stand on lawns, ring-over-ring is how
 * neighbouring rooms share one band, and a roof covers whatever it likes.
 * Pinned to the palette (families with a floor or stairs painter) by
 * wallVariants.test.
 */
export const INTERIOR_FLOOR_ASSET_IDS: ReadonlySet<string> = new Set([
  "terrain:stone-floor",
  "terrain:wood-floor",
  "terrain:stone-cobble",
  "terrain:stone-sandstone",
  "terrain:wood-walnut",
  "terrain:wood-grey",
  "terrain:stairs-stone",
]);

/** The paint family an asset id names (terrain:<family>), or null. */
export function floorFamilyFromAssetId(assetId: string): MapEditFloorFamily | null {
  const family = assetId.startsWith("terrain:") ? assetId.slice("terrain:".length) : "";
  return (FLOOR_FAMILIES as string[]).includes(family) ? (family as MapEditFloorFamily) : null;
}

export function isFloorFamilyAssetId(assetId: string): boolean {
  return floorFamilyFromAssetId(assetId) !== null;
}
