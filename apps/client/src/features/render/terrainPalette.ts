// Terrain palettes as DATA — the per-family colours the procedural terrain
// renderer and the interior-detail painters read. Keeping colour out of the
// draw code means a map's "mood" (warm village, cool cave/swamp, or a
// user-chosen fantasy palette — purple grass, say) is a config swap, not a
// code change. See features/render/terrainDetail (the painters that consume
// these), terrainMaterialPalettes (the wall/roof/stairs shade sets), and
// temp/_dirt_path_proto (the validated prototypes).

import {
  BONE_WALL_DETAIL,
  BRICK_WALL_DETAIL,
  DARK_WALL_DETAIL,
  SHINGLE_ROOF_DETAIL,
  STONE_STAIRS_DETAIL,
  THATCH_ROOF_DETAIL,
  TIMBER_WALL_DETAIL,
} from "./terrainMaterialPalettes";

/**
 * Interior "key cluster" detail shades for a dirt-like family (dirt, path):
 * pebble clusters in three tans over a darker crevice/shadow tone. Slynyrd
 * "Top Down Tiles" pg-49 uses 3–4 low-contrast earthy tones.
 */
export interface KeyClusterPalette {
  /** Darker-than-base crevice tone — ground cracks and each pebble's shadow. */
  crev: string;
  /** The three pebble tans, dark → light (weighted toward `mid`). */
  dark: string;
  mid: string;
  light: string;
}

/** Default (warm "village" mood) dirt detail palette. */
export const DIRT_DETAIL: KeyClusterPalette = {
  crev: "#4a3420",
  dark: "#7a6440",
  mid: "#a49060",
  light: "#bfa876",
};

/** Default (warm "village" mood) path detail palette — worn, cooler-olive. */
export const PATH_DETAIL: KeyClusterPalette = {
  crev: "#3f3d28",
  dark: "#6a6748",
  mid: "#8f8a66",
  light: "#a6a07a",
};

/**
 * Flagstone floor shades: `crev` draws the slab seams and cracks, the three
 * tones draw chips/lichen speckle inside each slab. Consumed by the flagstone
 * painter in terrainFloorDetail (the key-cluster tone roles map 1:1, so floor
 * variants stay a pure palette swap).
 */
export const STONE_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#3a3f4a",
  dark: "#474d5a",
  mid: "#535a69",
  light: "#5f6675",
};

/** Oak plank shades: `crev` = board seams/joints/knot cores, `dark`/`light` =
 * grain streaks, `mid` = knot halos. See STONE_FLOOR_DETAIL. */
export const WOOD_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#4c3722",
  dark: "#6a4b31",
  mid: "#7a583a",
  light: "#886443",
};

/** Walnut plank shades — deep, rich brown (see WOOD_FLOOR_DETAIL roles). */
export const WALNUT_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#2f1e12",
  dark: "#452e20",
  mid: "#573b28",
  light: "#684a33",
};

/** Weathered grey plank shades — sun-bleached, low saturation. */
export const GREY_PLANK_DETAIL: KeyClusterPalette = {
  crev: "#3f3d36",
  dark: "#59564d",
  mid: "#767268",
  light: "#8a867a",
};

/** Cobblestone shades — grey-brown, drawn at half slab scale. */
export const COBBLE_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#3b392f",
  dark: "#524f43",
  mid: "#6a6757",
  light: "#7d7a68",
};

/** Sandstone slab shades — warm desert tans. */
export const SANDSTONE_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#5d4d33",
  dark: "#7b6749",
  mid: "#94805c",
  light: "#a68f68",
};

/** The floor material painters terrainFloorDetail implements. */
export type FloorDetailKind = "plank" | "flagstone";

/**
 * Dedicated floor interior detail (Slice 2): which material painter a floor
 * family uses and the shades it draws with. `scale` shrinks the feature size —
 * cobblestone is the flagstone painter at half scale — so every floor variant
 * is data over the same two painters.
 */
export interface FloorDetail {
  kind: FloorDetailKind;
  palette: KeyClusterPalette;
  /** Feature-size multiplier; omitted ⇒ 1 (full-size boards/slabs). */
  scale?: number;
}

/**
 * One terrain family in the procedural render: its silhouette colours (`base`
 * fill + `rim` shading lip), its `priority` (higher draws OVER lower — grass
 * over dirt over path, so the higher family rounds its bumpy rim onto the
 * lower), and its interior `keyCluster` pebble palette when it has one.
 */
/** Wall-top detail: which shades the wall painter (terrainWallDetail) draws
 * courses, quoins and edge lips with. A `wall` family reads as a TALL lit
 * surface: light top, thin dark rim, and a dark cast shadow onto lower
 * families. Roofs and stairs reuse this shape over their own painters. */
export interface WallDetail {
  palette: KeyClusterPalette;
}

export interface TerrainFamilyPalette {
  base: string;
  rim: string;
  priority: number;
  keyCluster?: KeyClusterPalette;
  /** Floor families route to a dedicated material painter instead of the
   * key-cluster pebbles or grass decoration (checked first). */
  floor?: FloorDetail;
  /** Wall families route to the wall-top painter (checked before `floor`). */
  wall?: WallDetail;
  /** Roof families route to the shingle-row painter (terrainRoofDetail). */
  roof?: WallDetail;
  /** Stairs families route to the tread painter (terrainRoofDetail). */
  stairs?: WallDetail;
  /**
   * Boundary displacement scale for the procedural field (proceduralTerrain
   * `fieldOf`). Omitted ⇒ 1 = organic bumpy edge (natural terrain). Floors set
   * 0 so their architectural edges stay crisp and grid-aligned.
   */
  edgeAmp?: number;
  /** Shading-lip width in field units (default TERRAIN_RIM). Walls use a thin
   * lip so the edge reads as an inked outline, not a wide bevel. */
  rimWidth?: number;
  /** Cast-shadow depth onto lower families (see proceduralTerrain). Walls set
   * a wide/dark band so they read tall; omitted ⇒ the default low lip. */
  shadow?: { band: number; strength: number };
}

/** Shared wall field tuning: a thin inked rim (≈3px at the 50px grid) and a
 * darker-than-default cast shadow — the two knobs that sell wall height.
 * (Only the shadow's strength is applied; band is a reserved depth knob.)
 * Roofs sit a level above walls, so their shadow bites hardest. */
const WALL_RIM = 0.055;
const WALL_SHADOW = { band: 0.34, strength: 0.3 };
const ROOF_SHADOW = { band: 0.34, strength: 0.38 };

/**
 * The default "village" mood — warm and saturated. A map's mood (cool
 * cave/swamp, purple-grass fantasy) is the same shape with different values,
 * so re-skinning terrain is a data swap, never a code change. Keyed by the
 * terrain assetId. See temp/_dirt_path_proto for the validated mood set.
 */
export const VILLAGE_TERRAIN: Record<string, TerrainFamilyPalette> = {
  "terrain:grass": { base: "#7cb04a", rim: "#4a764e", priority: 3 },
  "terrain:dirt": { base: "#60482e", rim: "#4a3420", priority: 2, keyCluster: DIRT_DETAIL },
  "terrain:path": { base: "#565338", rim: "#3f3d28", priority: 1, keyCluster: PATH_DETAIL },
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
    floor: { kind: "flagstone", palette: STONE_FLOOR_DETAIL },
  },
  "terrain:wood-floor": {
    base: "#725236",
    rim: "#553b27",
    priority: 5,
    edgeAmp: 0,
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
    floor: { kind: "flagstone", palette: COBBLE_FLOOR_DETAIL, scale: 0.5 },
  },
  "terrain:stone-sandstone": {
    base: "#8a7454",
    rim: "#6a583f",
    priority: 7,
    edgeAmp: 0,
    floor: { kind: "flagstone", palette: SANDSTONE_FLOOR_DETAIL },
  },
  "terrain:wood-walnut": {
    base: "#4f3526",
    rim: "#3a2719",
    priority: 8,
    edgeAmp: 0,
    floor: { kind: "plank", palette: WALNUT_FLOOR_DETAIL },
  },
  "terrain:wood-grey": {
    base: "#6a675e",
    rim: "#4f4d45",
    priority: 9,
    edgeAmp: 0,
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
    wall: { palette: BONE_WALL_DETAIL },
  },
  "terrain:wall-brick": {
    base: "#9d6b52",
    rim: "#452e22",
    priority: 21,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    wall: { palette: BRICK_WALL_DETAIL },
  },
  "terrain:wall-timber": {
    base: "#84613e",
    rim: "#33241a",
    priority: 22,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    wall: { palette: TIMBER_WALL_DETAIL },
  },
  "terrain:wall-dark": {
    base: "#5d5f6c",
    rim: "#26272e",
    priority: 23,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: WALL_SHADOW,
    wall: { palette: DARK_WALL_DETAIL },
  },
  // Stairs: floor-height treads (priority between floors and walls, default
  // shadow) — the painter's riser/nosing bars do the reading, not the field.
  "terrain:stairs-stone": {
    base: "#6d7280",
    rim: "#3f434d",
    priority: 10,
    edgeAmp: 0,
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
    roof: { palette: SHINGLE_ROOF_DETAIL },
  },
  "terrain:roof-thatch": {
    base: "#a08954",
    rim: "#c4b183",
    priority: 31,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: ROOF_SHADOW,
    roof: { palette: THATCH_ROOF_DETAIL },
  },
};
