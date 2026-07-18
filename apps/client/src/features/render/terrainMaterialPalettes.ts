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

import type { KeyClusterPalette } from "./terrainPalette";

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
