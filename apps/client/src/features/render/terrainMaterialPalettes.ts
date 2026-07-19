// Architectural material shades — the wall, roof and stairs detail palettes
// VILLAGE_TERRAIN composes (split from terrainPalette to respect the 350-LOC
// cap; same KeyClusterPalette tone roles throughout, so every variant stays a
// pure palette swap over one painter).
//
// Tone roles per painter:
//   walls  (terrainWallDetail): crev = course ticks/quoins/shaded lips,
//          dark/mid = chip mottle, light = lit lips.
//   roofs  (terrainRoofDetail): crev = shingle-row shadows, dark/mid = slipped
//          shingle mottle, light = sun-caught shingle edges.
//   stairs (terrainRoofDetail): crev = tread riser shadows, light = nosing
//          highlights, dark/mid = wear mottle.

import type { KeyClusterPalette } from "./terrainPaletteTypes";

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

/** Flagstone floor shades: `crev` = slab seams/cracks, tones = chips/lichen. */
export const STONE_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#3a3f4a",
  dark: "#474d5a",
  mid: "#535a69",
  light: "#5f6675",
};

/** Oak plank shades: `crev` = board seams/joints/knot cores, `dark`/`light` =
 * grain streaks, `mid` = knot halos. */
export const WOOD_FLOOR_DETAIL: KeyClusterPalette = {
  crev: "#4c3722",
  dark: "#6a4b31",
  mid: "#7a583a",
  light: "#886443",
};

/** Walnut plank shades — deep, rich brown. */
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

/** Bone-stone wall (the Czepeku default). */
export const BONE_WALL_DETAIL: KeyClusterPalette = {
  crev: "#5f5745",
  dark: "#9a8d72",
  mid: "#a89b7e",
  light: "#cabfa2",
};

/** Brick wall shades — warm russet courses. */
export const BRICK_WALL_DETAIL: KeyClusterPalette = {
  crev: "#5e3c2c",
  dark: "#8a5c46",
  mid: "#a97a5e",
  light: "#bd9070",
};

/** Timber wall shades — dark oak beams over wattle. */
export const TIMBER_WALL_DETAIL: KeyClusterPalette = {
  crev: "#452f1e",
  dark: "#5e422a",
  mid: "#7c5a3b",
  light: "#97744e",
};

/** Dark dungeon wall shades — cool slate, lighter than the stone floors. */
export const DARK_WALL_DETAIL: KeyClusterPalette = {
  crev: "#3a3b45",
  dark: "#4e505c",
  mid: "#6a6c7a",
  light: "#868a9a",
};

/** Slate shingle roof — muted purple-grey rows (candle-workshop roofed study). */
export const SHINGLE_ROOF_DETAIL: KeyClusterPalette = {
  crev: "#565064",
  dark: "#6f6a7c",
  mid: "#8a8496",
  light: "#9d97ab",
};

/** Thatch roof — warm straw rows. */
export const THATCH_ROOF_DETAIL: KeyClusterPalette = {
  crev: "#6e5c36",
  dark: "#8b7648",
  mid: "#ab935c",
  light: "#bfa76d",
};

/** Stone stairs — lighter than the flagstone floor so treads read raised. */
export const STONE_STAIRS_DETAIL: KeyClusterPalette = {
  crev: "#454a56",
  dark: "#5d626f",
  mid: "#7a8090",
  light: "#8f95a5",
};
