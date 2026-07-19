// Types for the terrain palette-as-data (terrainPalette) — split into a
// sibling module for the 350-LOC cap, precedent terrainMaterialPalettes. The
// palette module re-exports everything here, so callers keep importing from
// "./terrainPalette".

/**
 * Interior "key cluster" detail shades for a dirt-like family (dirt, path):
 * pebble clusters in three tans over a darker crevice/shadow tone. Slynyrd
 * "Top Down Tiles" pg-49 uses 3–4 low-contrast earthy tones. The shade sets
 * themselves live in terrainMaterialPalettes.
 */
export interface KeyClusterPalette {
  /** Darker-than-base crevice tone — ground cracks and each pebble's shadow. */
  crev: string;
  /** The three pebble tans, dark → light (weighted toward `mid`). */
  dark: string;
  mid: string;
  light: string;
}

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

/** Wall-top detail: which shades the wall painter (terrainWallDetail) draws
 * courses, quoins and edge lips with. A `wall` family reads as a TALL lit
 * surface: light top, thin dark rim, and a dark cast shadow onto lower
 * families. Roofs and stairs reuse this shape over their own painters. */
export interface WallDetail {
  palette: KeyClusterPalette;
}

/** Deep-water dash flocks (Water II): sparse darker current dashes sharing one
 * hash-picked diagonal orientation per region, drawn by terrainWaterDetail
 * only where the shore distance exceeds its depth gate. */
export interface WaterDetail {
  /** The dash colour — darker than the deepest bathymetry band. */
  dash: string;
}

/**
 * One terrain family in the procedural render: its silhouette colours (`base`
 * fill + `rim` shading lip), its `priority` (higher draws OVER lower — grass
 * over dirt over path, so the higher family rounds its bumpy rim onto the
 * lower), and its interior detail painter routing when it has one.
 */
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
  /** Depth-banded water routes to the dash-flock painter (terrainWaterDetail). */
  water?: WaterDetail;
  /**
   * Drowned sibling family (Water II): render `of`'s painter output (base +
   * detail), pulled toward the water bathymetry with this family's own
   * water-body shore depth. `algae` scatters olive growth ticks on cells
   * within a cell of land. The entry's own base/rim are the PRE-DROWNED
   * colours (the sibling's, mixed 40 % toward the water mid tone) so the flat
   * swatch/SVG fallback stays in-family — the field adds only the depth term.
   */
  sunken?: { of: string; algae?: string };
  /**
   * Boundary displacement scale for the procedural field (proceduralTerrain
   * `fieldOf`). Omitted ⇒ 1 = organic bumpy edge (natural terrain). Floors set
   * 0 so their architectural edges stay crisp and grid-aligned.
   */
  edgeAmp?: number;
  /** Shading-lip width in field units (default TERRAIN_RIM). Walls use a thin
   * lip so the edge reads as an inked outline, not a wide bevel. */
  rimWidth?: number;
  /** Cast-shadow depth onto lower families (see proceduralTerrain): strength
   * deepens the crisp near shadow; band above the default adds the soft long
   * throw (shadow LENGTH is the height cue — roofs furthest). */
  shadow?: { band: number; strength: number };
  /** Omnidirectional contact/AO band seating the family on the ground (see
   * proceduralTerrain) — reach in field units, strength max darkening. */
  contact?: { reach: number; strength: number };
  /** Low-frequency tonal clouds under the cell detail (Czepeku catalog #1):
   * amp = max value offset, scale = wavelength in cells, cool shifts dark
   * patches cool / light patches warm. */
  mottle?: { amp: number; scale: number; cool?: number };
  /** Shore-distance colour bands, shallow→deep (catalog #2) — water only
   * today. The family's rim doubles as the waterline contact line. */
  depthBands?: { maxCells: number; base: string }[];
  /** Polar-course landmark (terrainPolarField): quantized radial courses
   * around each painted region's point source — cones, domes, dais rings,
   * spiral thatch as data. courseWidth/jointPitch in cells; ramp darkens
   * toward the eave; sunSplit lights the sun-facing side; jagged roughens
   * course edges; spiral steps one course per turn. Joints/ridges draw in
   * the family's rim colour (light fascia ribs on roofs, dark stone seams
   * on a dais). Mutually exclusive with depthBands — a banded family renders
   * its bathymetry and ignores this knob. */
  polar?: {
    courseWidth: number;
    jointPitch: number;
    jagged?: number;
    ramp?: number;
    sunSplit?: number;
    spiral?: boolean;
  };
  /** Foam lace collar over the shallowest water (Water II): near-white web
   * hugging every land contact, dissolving into spray past `reach` cells. */
  foam?: { color: string; reach: number };
  /** Caustic refraction web over the shallows (Water II), fading to nothing
   * past `reach` cells of shore distance. */
  caustics?: { color: string; reach: number; strength: number };
  /** False ⇒ exact region + extend-only bumps (water). See proceduralTerrain. */
  underfill?: boolean;
}
