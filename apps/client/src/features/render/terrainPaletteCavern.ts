// Volcanic-cavern terrain families — the lava-cavern benchmark study's roster,
// split from terrainPalette for the 350-LOC cap (precedent
// terrainPaletteStructures). terrainPalette spreads CAVERN_TERRAIN into
// VILLAGE_TERRAIN, so consumers keep reading one record.
//
// The study's finding: almost none of this needed a new painter. Molten rock is
// the WATER machinery with a hot palette (shore-distance bands, the foam lace
// as an incandescent lip, the caustic web as heat cracks, the deep-water dash
// flock as floating crust); a crystal cluster is the CANOPY machinery (organic
// blob, lit/shade split, core darkening) with a mineral palette; a cavern wall
// is the sea-crag LEDGE machinery underground. Only two genuinely new
// primitives were needed, both tiny and additive: `glow` (emissive spill — the
// inverse of contact AO) and `body` (so a lava lake and a water pool keep
// independent bathymetries instead of fusing into one liquid).

import {
  ASH_FLOOR_DETAIL,
  CAVE_FLOOR_DETAIL,
  CRYSTAL_GOLD_DETAIL,
} from "./terrainMaterialPalettes";
import type { TerrainFamilyPalette } from "./terrainPaletteTypes";

/** Lava's own shore-distance body — never fused with the water body. */
const MOLTEN_BODY = "lava";
/** The flooded-cave abyss: its own body so a black tarn beside the main lagoon
 * keeps its own bathymetry instead of reading as that lagoon's deep centre. */
const ABYSS_BODY = "abyss";

/** The cavern block of the village mood (see VILLAGE_TERRAIN). */
export const CAVERN_TERRAIN: Record<string, TerrainFamilyPalette> = {
  // MOLTEN LAVA — the study's keystone, and pure data over the Water II
  // machinery. Shore-distance bands run hot→cool INWARD exactly as water runs
  // bright→dark: the lip against the rock is incandescent and the deep centre
  // is a dull red crust. `foam` becomes the white-hot lace at every rock
  // contact, `caustics` the bright crack web over the shallows, and the
  // deep-water dash flock becomes floating crust rafts (`water.dash`, near
  // black). `underfill: false` for the same reason water needs it — an exact
  // region with extend-only bumps, or every distant floor would grow a phantom
  // magma fringe. `glow` is the one new primitive: the rock ring around the
  // lake is brightened toward the flame colour, so molten stone lights its
  // surroundings instead of sitting in them like a decal.
  "terrain:lava": {
    base: "#e8541a",
    rim: "#fff0c2",
    priority: 3.4,
    body: MOLTEN_BODY,
    edgeAmp: 0.95,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.07, scale: 4, cool: -0.5 },
    // The reference's lake is DEEP: saturated orange-red over most of its area,
    // with white heat only in a thin line at the rock. Pass 1 ran the bands
    // far too light and read as neon — the values below drop roughly two stops
    // and push the brightest band into a narrow shore strip.
    depthBands: [
      { maxCells: 0.9, base: "#ffab3d" },
      { maxCells: 2.0, base: "#ee7016" },
      { maxCells: 3.6, base: "#cf4a10" },
      { maxCells: 6, base: "#9d2b09" },
    ],
    // A THIN incandescent lip. Pass 1's reach of 1.05 cells put a fat yellow
    // band around every shore and dominated the map.
    foam: { color: "#ffdf92", reach: 0.42 },
    caustics: { color: "#ffb45e", reach: 2.4, strength: 0.22 },
    water: { dash: "#3d1105" },
    // CEILING: a family's signed field saturates near −0.5, so a glow reach at
    // or above that lights EVERY pixel of the neighbouring family at a floor
    // value instead of falling off — the same ceiling that caps the shadow
    // length ladder at 0.5. Keep reaches under it (pinned by cavernFamilies).
    glow: { color: "#ff7b2e", reach: 0.42, strength: 0.44 },
  },
  // COOLED CRUST — the black obsidian skin that scabs over a flow. Same molten
  // body (so its bathymetry joins the lake's rather than reading as shore) but
  // dark bands and only a whisper of glow: the heat is still in the cracks.
  "terrain:lava-crust": {
    base: "#33241f",
    rim: "#ff9440",
    priority: 3.45,
    body: MOLTEN_BODY,
    edgeAmp: 0.9,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.06, scale: 3, cool: -0.3 },
    depthBands: [
      { maxCells: 1.4, base: "#4a3028" },
      { maxCells: 3, base: "#38251f" },
      { maxCells: 5, base: "#2a1c18" },
    ],
    caustics: { color: "#ff8f38", reach: 2.2, strength: 0.5 },
    glow: { color: "#c9541f", reach: 0.26, strength: 0.16 },
  },
  // CAVERN FLOOR — the dark volcanic ground the whole map stands on. A natural
  // family like dirt/path (key-cluster pebbles, no crisp floor edge), tuned
  // cold and desaturated so the lava is the only saturated thing on the map.
  // Heavy speckle carries the ash grit at bake resolution.
  "terrain:cave-floor": {
    base: "#514751",
    rim: "#3b333d",
    priority: 1.4,
    keyCluster: CAVE_FLOOR_DETAIL,
    mottle: { amp: 0.08, scale: 5, cool: 0.35 },
    speckle: { amp: 0.14, chance: 0.06 },
  },
  // ASH DRIFT — the pale volcanic dust that pools in the lee of the rock. The
  // lower-priority partner of the cavern floor, INTERLEAVED so the two
  // interpenetrate with echo islands instead of meeting at a drawn line —
  // exactly the grass↔dirt grammar, in greys.
  "terrain:ash-drift": {
    base: "#6b6069",
    rim: "#544a54",
    priority: 1.6,
    keyCluster: ASH_FLOOR_DETAIL,
    mottle: { amp: 0.07, scale: 6, cool: 0.3 },
    speckle: { amp: 0.1, chance: 0.05 },
    interleave: { with: "terrain:cave-floor" },
  },
  // CAVERN WALL — the living rock enclosing the cave. The sea-crag LEDGE
  // machinery underground: the interior quantizes into rim-within-rim courses
  // (a rock face reads as contoured shelves, not a gradient) with an ink
  // contour at every break.
  //
  // Priority follows the CLIFF precedent (3.8), not the masonry wall block
  // (20+): natural rock is TERRAIN, so a laid floor or a cut stair reads as
  // carved INTO the wall rather than sitting on top of it — and the 20+ block
  // stays reserved for built walls, which wallVariants.test pins as strictly
  // above every ground family. It keeps a wall's long shadow throw, so the
  // mass still looms over the cavern floor.
  "terrain:cave-wall": {
    base: "#4b4048",
    rim: "#211c22",
    priority: 3.9,
    edgeAmp: 1.15,
    rimWidth: 0.05,
    shadow: { band: 0.42, strength: 0.38 },
    contact: { reach: 0.12, strength: 0.2 },
    mottle: { amp: 0.05, scale: 3.5, cool: 0.4 },
    speckle: { amp: 0.12, chance: 0.05 },
    // Pass 1's courses spanned too narrow a value range to read at map zoom —
    // the wall went flat. Widened to a real dark→light climb with a near-black
    // contour so the rock face shows its shelves.
    ledges: {
      colors: ["#181419", "#282130", "#3a3140", "#4b4048"],
      contour: "#0d0b0f",
    },
  },
  // GOLD CRYSTAL — sulfur/gold mineral clusters, and the study's second piece
  // of reuse: the CANOPY treatment is already "organic blob with a two-scale
  // scalloped silhouette, a lit side and a shade side split by a noisy
  // diagonal, darkening toward a core". Swap leaves for mineral and the same
  // painter grows crystal. `sub` is raised so the silhouette faceting is
  // sharper than foliage, and the family glows faintly — these clusters catch
  // the lava light.
  "terrain:crystal-gold": {
    base: "#f2c53d",
    rim: "#6b4a12",
    priority: 42,
    edgeAmp: 1.25,
    rimWidth: 0.06,
    shadow: { band: 0.4, strength: 0.34 },
    contact: { reach: 0.12, strength: 0.18 },
    mottle: { amp: 0.06, scale: 2.5, cool: -0.45 },
    // Facets need a HARD lit/shade break — pass 1's gentle foliage contrast
    // read as a flat yellow splat. A deep core sinks the cluster's middle so
    // the silhouette lobes separate into crystals.
    canopy: { shade: "#b07d1d", core: "#5e3d0c", sub: 0.7, detail: CRYSTAL_GOLD_DETAIL },
    glow: { color: "#ffd45e", reach: 0.22, strength: 0.14 },
  },
  // ABYSS WATER (night cave study) — the near-black tarn of a flooded cave's
  // side chambers. The SECOND water body the `body` key made possible: without
  // it this would fuse into the main lagoon's BFS and lose the shore between
  // them. Bands barely lighten at the rim (cave water has no sunlit shallows)
  // and the caustic web is off entirely — there is no sun down here to refract.
  "terrain:abyss-water": {
    base: "#0d1a2b",
    rim: "#4a6b84",
    priority: 3.3,
    body: ABYSS_BODY,
    edgeAmp: 0.85,
    rimWidth: 0.05,
    underfill: false,
    mottle: { amp: 0.07, scale: 5, cool: 0.55 },
    depthBands: [
      { maxCells: 1.3, base: "#1d3350" },
      { maxCells: 3, base: "#132540" },
      { maxCells: 5, base: "#0d1a2b" },
      { maxCells: 7, base: "#07101c" },
    ],
    foam: { color: "#7f9db2", reach: 0.5 },
    water: { dash: "#050b14" },
  },
  // BIOLUMINESCENCE (night cave study) — a shoal of glowing algae in the black
  // water. Rides the abyss body, and the `glow` primitive earns its keep a
  // second time: the cave wall around the shoal is lit COLD green, the exact
  // inverse of lava's warm spill, with no lighting pass involved.
  "terrain:biolume": {
    base: "#123f3a",
    rim: "#8ef0c8",
    priority: 3.35,
    body: ABYSS_BODY,
    edgeAmp: 0.95,
    rimWidth: 0.06,
    underfill: false,
    mottle: { amp: 0.08, scale: 3, cool: 0.3 },
    depthBands: [
      { maxCells: 1.2, base: "#2f7d63" },
      { maxCells: 2.6, base: "#1c5a4d" },
      { maxCells: 4.5, base: "#123f3a" },
    ],
    foam: { color: "#a9f7d8", reach: 0.6 },
    caustics: { color: "#7ff0bd", reach: 2.6, strength: 0.34 },
    glow: { color: "#5fe0aa", reach: 0.34, strength: 0.34 },
  },
  // VERDIGRIS CRYSTAL — the teal mineral variant (the reference's green mass).
  // Same painter, cooler data.
  "terrain:crystal-verdigris": {
    base: "#3f8f7a",
    rim: "#16403a",
    priority: 43,
    edgeAmp: 1.25,
    rimWidth: 0.06,
    shadow: { band: 0.4, strength: 0.34 },
    contact: { reach: 0.12, strength: 0.18 },
    mottle: { amp: 0.06, scale: 2.5, cool: 0.4 },
    canopy: { shade: "#276056", core: "#123832", sub: 0.7, detail: CRYSTAL_GOLD_DETAIL },
  },
};
