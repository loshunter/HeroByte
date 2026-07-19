// Terrain palettes as DATA — the per-family colours the procedural terrain
// renderer and the interior-detail painters read. Keeping colour out of the
// draw code means a map's "mood" (warm village, cool cave/swamp, or a
// user-chosen fantasy palette — purple grass, say) is a config swap, not a
// code change. See features/render/terrainDetail (the painters that consume
// these), terrainMaterialPalettes (all the material shade sets),
// terrainPaletteTypes (the palette type shapes, re-exported below), and
// temp/_dirt_path_proto (the validated prototypes).

import {
  BONE_WALL_DETAIL,
  BRICK_WALL_DETAIL,
  COBBLE_FLOOR_DETAIL,
  DARK_WALL_DETAIL,
  DIRT_DETAIL,
  GREY_PLANK_DETAIL,
  PATH_DETAIL,
  SANDSTONE_FLOOR_DETAIL,
  SHINGLE_ROOF_DETAIL,
  STONE_FLOOR_DETAIL,
  STONE_STAIRS_DETAIL,
  THATCH_ROOF_DETAIL,
  TIMBER_WALL_DETAIL,
  WALNUT_FLOOR_DETAIL,
  WOOD_FLOOR_DETAIL,
} from "./terrainMaterialPalettes";
import type { TerrainFamilyPalette } from "./terrainPaletteTypes";

export type {
  FloorDetail,
  FloorDetailKind,
  KeyClusterPalette,
  TerrainFamilyPalette,
  WallDetail,
  WaterDetail,
} from "./terrainPaletteTypes";

/** Shared wall field tuning: a thin inked rim (≈3px at the 50px grid), a
 * darker-than-default cast shadow whose band length scales with height (walls
 * throw 0.3, roofs 0.5 — catalog #11), and a thin omnidirectional contact/AO
 * band seating the mass on the ground (catalog #4). */
const WALL_RIM = 0.055;
const WALL_SHADOW = { band: 0.3, strength: 0.3 };
const ROOF_SHADOW = { band: 0.5, strength: 0.38 };
const WALL_CONTACT = { reach: 0.1, strength: 0.16 };
const ROOF_CONTACT = { reach: 0.12, strength: 0.18 };

/**
 * The default "village" mood — warm and saturated. A map's mood (cool
 * cave/swamp, purple-grass fantasy) is the same shape with different values,
 * so re-skinning terrain is a data swap, never a code change. Keyed by the
 * terrain assetId. See temp/_dirt_path_proto for the validated mood set.
 */
export const VILLAGE_TERRAIN: Record<string, TerrainFamilyPalette> = {
  // Water sits ABOVE the natural ground and BELOW the architectural floors:
  // its organic edge laps onto grass/dirt with the thin near-white waterline
  // rim as the contact line, docks and floors deck over it, and its colour is
  // shore-distance bathymetry (bright turquoise shallows deepening to navy).
  // Two guards keep it honest (pinned by the water-containment tests):
  // `underfill: false` — its region is exactly its painted cells with
  // extend-only bumps, or every distant building would grow a phantom water
  // fringe and docks would open seam gaps — and it must NOT be the globally
  // lowest family, or the field would underfill it beneath the whole painted
  // region and leak slivers at land↔empty edges. The 4-frame shimmer survives
  // as a translucent animated overlay (terrainBake drawWaterShimmer); the flat
  // swatch/SVG fill (#24516b) matches the mid band so fallbacks stay in-family.
  // Water II layers the shore grammar on top: a saturated sunlit first band,
  // the foam lace collar at every land contact, and the caustic web fading
  // off-shore (all per-pixel terms in terrainFieldColor).
  "terrain:water": {
    base: "#24516b",
    rim: "#a7e3da",
    priority: 3.5,
    edgeAmp: 0.8,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.05, scale: 5, cool: 0.4 },
    depthBands: [
      { maxCells: 1.2, base: "#4fbfae" },
      { maxCells: 2.8, base: "#33718a" },
      { maxCells: 5, base: "#24516b" },
      { maxCells: 6, base: "#1b3f58" },
    ],
    foam: { color: "#d9ebf3", reach: 0.8 },
    caustics: { color: "#bfe9e0", reach: 3, strength: 0.4 },
    water: { dash: "#142f43" },
  },
  // Sunken architecture (Water II): drowned siblings of the dry stone floors
  // and stairs, painted INTO a water body. Each renders its sibling's painters
  // through the drown tint while the field pulls its pixels toward the water
  // bathymetry with depth. base/rim are the sibling's colours pre-mixed 40 %
  // toward the water mid tone (#24516b) and double as the swatch/SVG fills.
  // Priorities sit BETWEEN water (3.5) and the dry floors (4+); underfill
  // false for the same reason water needs it — with the union indicator every
  // dry floor region would grow a phantom drowned fringe (pinned by tests).
  "terrain:sunken-flagstone": {
    base: "#3d5265",
    rim: "#33485a",
    priority: 3.6,
    edgeAmp: 0,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.05, scale: 3.5, cool: 0.5 },
    sunken: { of: "terrain:stone-floor", algae: "#6a7a34" },
  },
  "terrain:sunken-stairs": {
    base: "#506578",
    rim: "#344959",
    priority: 3.7,
    edgeAmp: 0,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.03, scale: 3, cool: 0.4 },
    sunken: { of: "terrain:stairs-stone", algae: "#6a7a34" },
  },
  "terrain:grass": {
    base: "#7cb04a",
    rim: "#4a764e",
    priority: 3,
    mottle: { amp: 0.06, scale: 4, cool: 0.3 },
  },
  "terrain:dirt": {
    base: "#60482e",
    rim: "#4a3420",
    priority: 2,
    keyCluster: DIRT_DETAIL,
    mottle: { amp: 0.05, scale: 4, cool: 0.25 },
  },
  "terrain:path": {
    base: "#565338",
    rim: "#3f3d28",
    priority: 1,
    keyCluster: PATH_DETAIL,
    mottle: { amp: 0.04, scale: 4, cool: 0.25 },
  },
  // Architectural floors: crisp (edgeAmp 0) grid-aligned edges, and a priority
  // ABOVE the natural families so a floor region reads as laid OVER grass/dirt/
  // path. Base colours match the starterTiles fills (#4d5361 / #725236, kept
  // frozen) so the field bake and the flat fallback agree. Interior detail is
  // the dedicated material painters (terrainFloorDetail): flagstone slab seams
  // for stone, plank grain for wood.
  "terrain:stone-floor": {
    base: "#4d5361",
    rim: "#3d424e",
    priority: 4,
    edgeAmp: 0,
    mottle: { amp: 0.05, scale: 3.5, cool: 0.5 },
    floor: { kind: "flagstone", palette: STONE_FLOOR_DETAIL },
  },
  "terrain:wood-floor": {
    base: "#725236",
    rim: "#553b27",
    priority: 5,
    edgeAmp: 0,
    mottle: { amp: 0.03, scale: 5, cool: 0.1 },
    floor: { kind: "plank", palette: WOOD_FLOOR_DETAIL },
  },
  // Variant floors (Slice 3): pure data over the same two painters. Priorities
  // stay above the naturals and distinct from each other so any floor-vs-floor
  // boundary has a deterministic rim winner. Bases match their starterTiles
  // swatch fills (pinned by floorVariants.test).
  "terrain:stone-cobble": {
    base: "#5e5b50",
    rim: "#46443c",
    priority: 6,
    edgeAmp: 0,
    mottle: { amp: 0.05, scale: 3.5, cool: 0.5 },
    floor: { kind: "flagstone", palette: COBBLE_FLOOR_DETAIL, scale: 0.5 },
  },
  "terrain:stone-sandstone": {
    base: "#8a7454",
    rim: "#6a583f",
    priority: 7,
    edgeAmp: 0,
    mottle: { amp: 0.05, scale: 4, cool: -0.2 },
    floor: { kind: "flagstone", palette: SANDSTONE_FLOOR_DETAIL },
  },
  "terrain:wood-walnut": {
    base: "#4f3526",
    rim: "#3a2719",
    priority: 8,
    edgeAmp: 0,
    mottle: { amp: 0.03, scale: 5, cool: 0.1 },
    floor: { kind: "plank", palette: WALNUT_FLOOR_DETAIL },
  },
  "terrain:wood-grey": {
    base: "#6a675e",
    rim: "#4f4d45",
    priority: 9,
    edgeAmp: 0,
    mottle: { amp: 0.04, scale: 5, cool: 0.2 },
    floor: { kind: "plank", palette: GREY_PLANK_DETAIL },
  },
  // Walls (Czepeku study, docs/planning): the wall TOP is the lightest surface
  // on the map — brighter than every floor — with a thin dark rim (inked
  // outline) and a deep directional shadow cast onto whatever it borders, so a
  // one-cell band reads as a tall standing wall, not a stripe of floor.
  // Priorities sit in their own 20+ block above all floors; bases match the
  // starterTiles swatch fills (pinned by wallVariants.test).
  "terrain:wall-stone": {
    base: "#b3a687",
    rim: "#4e4638",
    priority: 20,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    contact: WALL_CONTACT,
    mottle: { amp: 0.03, scale: 3, cool: 0.3 },
    wall: { palette: BONE_WALL_DETAIL },
  },
  "terrain:wall-brick": {
    base: "#9d6b52",
    rim: "#452e22",
    priority: 21,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    contact: WALL_CONTACT,
    mottle: { amp: 0.03, scale: 3, cool: 0.3 },
    wall: { palette: BRICK_WALL_DETAIL },
  },
  "terrain:wall-timber": {
    base: "#84613e",
    rim: "#33241a",
    priority: 22,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    contact: WALL_CONTACT,
    mottle: { amp: 0.03, scale: 3, cool: 0.2 },
    wall: { palette: TIMBER_WALL_DETAIL },
  },
  "terrain:wall-dark": {
    base: "#5d5f6c",
    rim: "#26272e",
    priority: 23,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    contact: WALL_CONTACT,
    mottle: { amp: 0.03, scale: 3, cool: 0.4 },
    wall: { palette: DARK_WALL_DETAIL },
  },
  // Stairs: floor-height treads (priority between floors and walls, default
  // shadow) — the painter's riser/nosing bars do the reading, not the field.
  "terrain:stairs-stone": {
    base: "#6d7280",
    rim: "#3f434d",
    priority: 10,
    edgeAmp: 0,
    mottle: { amp: 0.03, scale: 3, cool: 0.4 },
    stairs: { palette: STONE_STAIRS_DETAIL },
  },
  // Roofs: the TALLEST level (priority above walls, hardest shadow), and the
  // rim is a LIGHT fascia trim rather than an inked outline — an eave catches
  // sun, it isn't inked (Czepeku roofed-variant study). One-cell overlaps with
  // wall bands read as eaves poking past the wall line.
  "terrain:roof-shingle": {
    base: "#7d7787",
    rim: "#b7ad92",
    priority: 30,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: ROOF_SHADOW,
    contact: ROOF_CONTACT,
    mottle: { amp: 0.04, scale: 4, cool: 0.3 },
    roof: { palette: SHINGLE_ROOF_DETAIL },
  },
  "terrain:roof-thatch": {
    base: "#a08954",
    rim: "#c4b183",
    priority: 31,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: ROOF_SHADOW,
    contact: ROOF_CONTACT,
    mottle: { amp: 0.04, scale: 4, cool: -0.2 },
    roof: { palette: THATCH_ROOF_DETAIL },
  },
};
