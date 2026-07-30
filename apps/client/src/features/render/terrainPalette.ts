// Terrain palettes as DATA — the per-family colours the procedural terrain
// renderer and the interior-detail painters read. Keeping colour out of the
// draw code means a map's "mood" (warm village, cool cave/swamp, or a
// user-chosen fantasy palette — purple grass, say) is a config swap, not a
// code change. See features/render/terrainDetail (the painters that consume
// these), terrainMaterialPalettes (all the material shade sets),
// terrainPaletteTypes (the palette type shapes, re-exported below), and
// temp/_dirt_path_proto (the validated prototypes).

import {
  BLOSSOM_CANOPY_DETAIL,
  BRIDGE_PLANK_DETAIL,
  COBBLE_FLOOR_DETAIL,
  DIRT_DETAIL,
  FURROW_DETAIL,
  GRASS_DETAIL,
  GREY_PLANK_DETAIL,
  LEAF_CANOPY_DETAIL,
  PATH_DETAIL,
  SAND_DETAIL,
  SANDSTONE_FLOOR_DETAIL,
  STONE_FLOOR_DETAIL,
  WALNUT_FLOOR_DETAIL,
  WOOD_FLOOR_DETAIL,
} from "./terrainMaterialPalettes";
import { STRUCTURE_TERRAIN } from "./terrainPaletteStructures";
import type { TerrainFamilyPalette } from "./terrainPaletteTypes";

export type {
  CanopyDetail,
  FloorDetail,
  FloorDetailKind,
  GrassDetail,
  KeyClusterPalette,
  TerrainFamilyPalette,
  WallDetail,
  WaterDetail,
} from "./terrainPaletteTypes";

/** Canopy field tuning: trees are TALL — the throw sits with the cone roofs
 * on the [0.3, 0.5] height ladder (see terrainPaletteStructures) — and the
 * crown seats onto the ground with the same contact band as a roof. */
const CANOPY_SHADOW = { band: 0.48, strength: 0.38 };
const CANOPY_CONTACT = { reach: 0.12, strength: 0.18 };

/** The village mood's map-level shadow COLOUR (catalog rank 2): darkening terms
 * fall toward this dusky plum instead of grey-multiplying, so shadows hue-shift
 * cool and stay saturated. Both production bakes (terrainBake live,
 * rasterUnderlay export) pass it with VILLAGE_TERRAIN; per-map dial later. */
export const VILLAGE_SHADOW_TINT = "#3a2f45";

/** The default "village" mood — warm and saturated. A mood (cool cave/swamp,
 * purple-grass fantasy) is the same shape with different values, so re-skinning
 * terrain is a data swap, never a code change. Keyed by the terrain assetId.
 * See temp/_dirt_path_proto for the validated mood set. */
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
  // Sea-crag cliff (taxonomy family roster — DruidIslands/TempleOfTheOracle
  // grammar): the coastal rock band between grass cap and water, rendered as
  // stacked rim-within-rim ledges with ink contours. Priority ABOVE water so
  // the crag's toes bump over the foam line and its long throw lands on the
  // sea, BELOW the floors/stairs so a cut path or stair run breaks the ring.
  // Grass (lower) underfills it, and the detail pass paints the grass-cap
  // blade fringe into the crag's receded top seam for free.
  "terrain:cliff": {
    base: "#565e62",
    rim: "#26282a",
    priority: 3.8,
    edgeAmp: 1.05,
    rimWidth: 0.05,
    shadow: { band: 0.34, strength: 0.28 },
    contact: { reach: 0.1, strength: 0.14 },
    mottle: { amp: 0.04, scale: 3, cool: 0.35 },
    speckle: { amp: 0.1, chance: 0.05 },
    ledges: {
      colors: ["#2b4152", "#3c4a54", "#4c565c", "#565e62"],
      contour: "#26282a",
    },
  },
  // Grass↔dirt is the interleaved open-country pair (catalog rank 12): the
  // seam interpenetrates and each family spawns echo islands inside the
  // other — what makes the boundary read hand-painted, not thresholded.
  "terrain:grass": {
    base: "#7cb04a",
    rim: "#4a764e",
    priority: 3,
    mottle: { amp: 0.06, scale: 4, cool: 0.3 },
    grass: GRASS_DETAIL,
    interleave: { with: "terrain:dirt" },
  },
  // Warm coastal sand (island benchmark arc) — the SECOND interleave pair.
  // The contract puts the declaration on the pair's HIGHER member and grass
  // already declares dirt, so sand sits at 3.2: above grass (sand↔grass
  // interpenetrates with echo islands — the reference's dominant ground
  // read), below water (the waterline lip still laps onto the beach). The
  // subtle sand-over-grass lip is illegible at map zoom; the seam is what
  // matters.
  "terrain:sand": {
    base: "#cdb285",
    rim: "#a58a5e",
    priority: 3.2,
    mottle: { amp: 0.05, scale: 4, cool: -0.15 },
    speckle: { amp: 0.08, chance: 0.04 },
    keyCluster: SAND_DETAIL,
    interleave: { with: "terrain:grass" },
  },
  "terrain:dirt": {
    base: "#60482e",
    rim: "#4a3420",
    priority: 2,
    keyCluster: DIRT_DETAIL,
    mottle: { amp: 0.05, scale: 4, cool: 0.25 },
    speckle: { amp: 0.1, chance: 0.05 },
  },
  "terrain:path": {
    base: "#565338",
    rim: "#3f3d28",
    priority: 1,
    keyCluster: PATH_DETAIL,
    mottle: { amp: 0.04, scale: 4, cool: 0.25 },
    speckle: { amp: 0.1, chance: 0.05 },
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
    speckle: { amp: 0.08, chance: 0.04 },
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
    speckle: { amp: 0.08, chance: 0.04 },
    floor: { kind: "flagstone", palette: COBBLE_FLOOR_DETAIL, scale: 0.5 },
  },
  "terrain:stone-sandstone": {
    base: "#8a7454",
    rim: "#6a583f",
    priority: 7,
    edgeAmp: 0,
    mottle: { amp: 0.05, scale: 4, cool: -0.2 },
    speckle: { amp: 0.08, chance: 0.04 },
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
  // Tilled farm plot (island benchmark arc): furrow trench/ridge rows with
  // crop ticks. A laid surface, so it lives in the floors block (the sunken
  // families must sit strictly between water and EVERY dry floor — pinned by
  // sunkenStructures.test); nearly-straight hand-cut edges over any ground.
  "terrain:farm-furrow": {
    base: "#52402a",
    rim: "#3c2e1e",
    priority: 4.5,
    edgeAmp: 0.25,
    rimWidth: 0.06,
    mottle: { amp: 0.04, scale: 4, cool: 0.2 },
    floor: { kind: "furrow", palette: FURROW_DETAIL },
  },
  // Log-rib bridge deck (structure treatments — dock and bridge ribbons):
  // boards perpendicular to the run over a dark water-shadow base that shows
  // through the sliver gaps and missing boards, mask-driven edge stringers,
  // post terminals at run ends. Priority above the plain wood floors and
  // below the stairs so a stair ramp joins the deck cleanly; the tall shadow
  // band throws the deck's height cue onto the water below it.
  "terrain:bridge-plank": {
    base: "#20303c",
    rim: "#33291d",
    priority: 9.2,
    edgeAmp: 0,
    rimWidth: 0.05,
    shadow: { band: 0.3, strength: 0.26 },
    mottle: { amp: 0.03, scale: 4, cool: 0.2 },
    floor: { kind: "bridge", palette: BRIDGE_PLANK_DETAIL },
  },
  // The architectural block — walls, stairs, roofs, dais (priorities 10–34) —
  // lives in terrainPaletteStructures (350-LOC cap), same data verbatim.
  ...STRUCTURE_TERRAIN,
  // Foliage canopies (catalog rank 9): the level ABOVE the roofs — priorities
  // in their own 40+ block, so a crown overhangs any building and throws the
  // cone-tier plum shadow onto it. Organic maxed-out edge with an extra fine
  // sub-lobe octave (two-scale scallops); a thin DARK rim as the ink contour
  // (unlike roofs' light fascia — a leaf silhouette is inked, not sunlit);
  // interior split lit/shade by a noisy diagonal against the shared sun and
  // darkened toward `core` with crown depth. Bases match the starterTiles
  // swatch fills (pinned by canopyPainter.test).
  "terrain:canopy": {
    base: "#5e8f30",
    rim: "#1b3517",
    priority: 40,
    edgeAmp: 1.3,
    rimWidth: 0.06,
    shadow: CANOPY_SHADOW,
    contact: CANOPY_CONTACT,
    mottle: { amp: 0.05, scale: 3, cool: 0.25 },
    canopy: { shade: "#2f5d24", core: "#1f4520", sub: 0.5, detail: LEAF_CANOPY_DETAIL },
  },
  "terrain:canopy-blossom": {
    base: "#ef9dc0",
    rim: "#5c3355",
    priority: 41,
    edgeAmp: 1.3,
    rimWidth: 0.06,
    shadow: CANOPY_SHADOW,
    contact: CANOPY_CONTACT,
    mottle: { amp: 0.05, scale: 3, cool: 0.2 },
    canopy: { shade: "#96588f", core: "#6e4070", sub: 0.5, detail: BLOSSOM_CANOPY_DETAIL },
  },
};
