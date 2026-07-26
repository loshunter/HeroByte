// Architectural terrain families — walls, stairs, roofs, dais — split from
// terrainPalette for the 350-LOC cap (precedent terrainMaterialPalettes).
// terrainPalette spreads STRUCTURE_TERRAIN into VILLAGE_TERRAIN, so consumers
// keep reading one record and the split is invisible. Same data, verbatim:
// the shadowTint parity hash and the wallVariants/polarCourse pins see
// identical values.

import {
  BONE_WALL_DETAIL,
  BRICK_WALL_DETAIL,
  DARK_WALL_DETAIL,
  SHINGLE_ROOF_DETAIL,
  STONE_STAIRS_DETAIL,
  THATCH_ROOF_DETAIL,
  TIMBER_WALL_DETAIL,
} from "./terrainMaterialPalettes";
import type { TerrainFamilyPalette } from "./terrainPaletteTypes";

/** Shared wall field tuning: a thin inked rim (≈3px at the 50px grid), a
 * darker-than-default cast shadow whose band length scales with height
 * (catalog #11), and a thin omnidirectional contact/AO band (catalog #4). */
const WALL_RIM = 0.055;
const WALL_SHADOW = { band: 0.3, strength: 0.3 };
const ROOF_SHADOW = { band: 0.42, strength: 0.38 };
const WALL_CONTACT = { reach: 0.1, strength: 0.16 };
const ROOF_CONTACT = { reach: 0.12, strength: 0.18 };

/** Shadow LENGTH is the height cue (catalog #11): walls < square roofs <
 * spiral < cone < dome as band data. CEILING: a crisp family's field saturates
 * at −0.5, so 0.5 is the longest expressible throw — a band above it adds no
 * reach, only a wasted always-true probe per pixel (review finding). Ladder
 * lives in [0.3, 0.5]; ordering + ceiling pinned in wallVariants/polarCourse. */
const SPIRAL_SHADOW = { band: 0.45, strength: 0.38 };
const CONE_SHADOW = { band: 0.48, strength: 0.38 };
const DOME_SHADOW = { band: 0.5, strength: 0.38 };

/** The architectural block of the village mood (see VILLAGE_TERRAIN). */
export const STRUCTURE_TERRAIN: Record<string, TerrainFamilyPalette> = {
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
  // Roofs: the TALLEST built level (priority above walls, hardest shadow), and
  // the rim is a LIGHT fascia trim rather than an inked outline — an eave
  // catches sun, it isn't inked (Czepeku roofed-variant study). One-cell
  // overlaps with wall bands read as eaves poking past the wall line.
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
  // Round landmarks (polar-course engine): each painted region renders as
  // radial courses around its own point source — no cell painter, the field
  // does all the reading (terrainPolarField). Roof-priority entries keep the
  // roof grammar (light fascia rim = the ridge ribs, hardest shadow); the
  // dais is a GROUND-level ring platform (dark stone seams, no shadow).
  "terrain:roof-cone": {
    base: "#6f6a7c",
    rim: "#b7ad92",
    priority: 32,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: CONE_SHADOW,
    contact: ROOF_CONTACT,
    mottle: { amp: 0.03, scale: 3, cool: 0.3 },
    polar: { courseWidth: 0.34, jointPitch: 0.8, ramp: 0.35, sunSplit: 0.22 },
  },
  "terrain:roof-dome": {
    base: "#31549b",
    rim: "#8fa8dc",
    priority: 33,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: DOME_SHADOW,
    contact: ROOF_CONTACT,
    mottle: { amp: 0.03, scale: 4, cool: 0.2 },
    polar: { courseWidth: 0.5, jointPitch: 1.6, ramp: 0.25, sunSplit: 0.38 },
  },
  "terrain:roof-thatch-spiral": {
    base: "#a28b4e",
    rim: "#c9b67f",
    priority: 34,
    edgeAmp: 0,
    rimWidth: WALL_RIM,
    shadow: SPIRAL_SHADOW,
    contact: ROOF_CONTACT,
    mottle: { amp: 0.04, scale: 4, cool: -0.2 },
    polar: {
      courseWidth: 0.4,
      jointPitch: 1.2,
      jagged: 0.5,
      ramp: 0.3,
      sunSplit: 0.15,
      spiral: true,
    },
  },
  "terrain:dais-stone": {
    base: "#8b8f9c",
    rim: "#5c6070",
    priority: 11,
    edgeAmp: 0,
    mottle: { amp: 0.04, scale: 3, cool: 0.4 },
    polar: { courseWidth: 0.45, jointPitch: 0.7, ramp: 0.18 },
  },
};
