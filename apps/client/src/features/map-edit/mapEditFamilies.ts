// Paint-family knowledge DERIVED from the two data sources — the bundled
// asset shelf (starterTiles) and the village palette (VILLAGE_TERRAIN). A
// family is paintable iff it appears in BOTH; its deck material comes from
// the asset's authored `material` (palette-routing fallback below). This
// replaces the old hand-kept floor/wall/roof lists and type union: adding a
// family to the data is now the only step — there is no toolbar list to
// forget (the three-list swatch trap is dead). brushDeck.test pins the
// derivation; wallVariants.test pins the ring-protection semantic.

import {
  MAP_STUDIO_TILE_ASSETS,
  type TileMaterial,
  type MapStudioTileAsset,
} from "../map-studio/starterTiles";
import { VILLAGE_TERRAIN, type TerrainFamilyPalette } from "../render/terrainPalette";
import type { MapEditFloorFamily, MapEditRoofFamily, MapEditWallFamily } from "./mapEditTypes";

/** One paintable family, joined across asset shelf + palette. */
export interface PaintFamilyEntry {
  /** Bare family name the palette state carries (e.g. "grass"). */
  family: MapEditFloorFamily;
  /** The terrain asset id painted into cells (e.g. "terrain:grass"). */
  assetId: string;
  name: string;
  fill: string;
  stroke: string;
  accent?: string;
  material: TileMaterial;
  note?: string;
  /** Palette stacking priority — the deck's within-shelf sort key. */
  priority: number;
}

/**
 * Palette-routing fallback for an asset that doesn't author `material`.
 * Coarse on purpose (wall-timber would land in "stone" here — its asset
 * declares "wood"): it only has to keep an unauthored family browsable.
 */
function inferMaterial(fam: TerrainFamilyPalette): TileMaterial {
  // A molten family declares its own body, so it never lands on the water
  // shelf despite riding the water machinery (lava cavern study).
  if (fam.body !== undefined && fam.body !== "water") return "molten";
  if (fam.water || fam.sunken) return "water";
  if (fam.canopy) return "canopy";
  // Round roofs are polar landmarks in the 20+ architectural block; the dais
  // is polar too but ground-level, so the priority gate keeps it out.
  if (fam.roof || (fam.polar && fam.priority >= 20)) return "roof";
  if (fam.floor?.kind === "plank" || fam.floor?.kind === "bridge") return "wood";
  if (fam.floor?.kind === "furrow") return "ground";
  if (fam.wall || fam.stairs || fam.ledges || fam.polar || fam.floor) return "stone";
  return "ground";
}

function toEntry(asset: MapStudioTileAsset, fam: TerrainFamilyPalette): PaintFamilyEntry {
  return {
    family: asset.id.slice("terrain:".length),
    assetId: asset.id,
    name: asset.name,
    fill: asset.fill,
    stroke: asset.stroke,
    accent: asset.accent,
    material: asset.material ?? inferMaterial(fam),
    note: asset.brushNote,
    priority: fam.priority,
  };
}

/** Every paintable family, in asset-shelf order. */
export const PAINT_FAMILIES: readonly PaintFamilyEntry[] = MAP_STUDIO_TILE_ASSETS.filter(
  (asset) => asset.id.startsWith("terrain:") && VILLAGE_TERRAIN[asset.id] !== undefined,
).map((asset) => toEntry(asset, VILLAGE_TERRAIN[asset.id]!));

const byPriority = (a: PaintFamilyEntry, b: PaintFamilyEntry) => a.priority - b.priority;

/** The wall paint families (palette `wall` routing), lowest priority first. */
export const WALL_FAMILIES: MapEditWallFamily[] = PAINT_FAMILIES.filter(
  (entry) => VILLAGE_TERRAIN[entry.assetId]!.wall !== undefined,
)
  .sort(byPriority)
  .map((entry) => entry.family);

/** The roof paint families (material "roof"), lowest priority first. */
export const ROOF_FAMILIES: MapEditRoofFamily[] = PAINT_FAMILIES.filter(
  (entry) => entry.material === "roof",
)
  .sort(byPriority)
  .map((entry) => entry.family);

/**
 * The laid interior surfaces a Room/Hallway wall band must never overwrite —
 * an adjacent room's floor, a staircase, or the DROWNED sibling of either
 * (authored sunken architecture would otherwise be silently stamped out while
 * its dry twin one tile away is skipped). Natural ground (grass/dirt/path),
 * water, walls and roofs are fair game: walls stand on lawns and in lakes,
 * ring-over-ring is how neighbouring rooms share one band, and a roof covers
 * whatever it likes. Derived: every GROUND-level family (priority below the
 * 20+ wall/roof blocks) with a floor, stairs, sunken or polar painter
 * routing. wallVariants.test pins the semantic with literal ids.
 */
export const INTERIOR_FLOOR_ASSET_IDS: ReadonlySet<string> = new Set(
  Object.entries(VILLAGE_TERRAIN)
    .filter(
      ([, fam]) =>
        fam.priority < 20 &&
        (fam.floor !== undefined ||
          fam.stairs !== undefined ||
          fam.sunken !== undefined ||
          fam.polar !== undefined),
    )
    .map(([id]) => id),
);

const PAINTABLE_ASSET_IDS: ReadonlySet<string> = new Set(
  PAINT_FAMILIES.map((entry) => entry.assetId),
);

/** The paint family an asset id names (terrain:<family>), or null. */
export function floorFamilyFromAssetId(assetId: string): MapEditFloorFamily | null {
  return PAINTABLE_ASSET_IDS.has(assetId) ? assetId.slice("terrain:".length) : null;
}

export function isFloorFamilyAssetId(assetId: string): boolean {
  return floorFamilyFromAssetId(assetId) !== null;
}
