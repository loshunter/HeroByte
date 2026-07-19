// Types for the procedural terrain FIELD (proceduralTerrain) — split into a
// sibling module for the 350-LOC cap, precedent terrainMaterialPalettes. The
// implementation re-exports everything here, so callers keep importing from
// "./proceduralTerrain".

/** One terrain family in the field render. */
export interface TerrainFieldFamily {
  assetId: string;
  /** Higher draws OVER lower — grass(3) > dirt(2) > path(1), floors above. */
  priority: number;
  /** Silhouette base fill (hex). */
  base: string;
  /** Boundary shading-lip colour (hex). */
  rim: string;
  /**
   * Per-family boundary displacement scale. Undefined ⇒ 1: the organic bumpy
   * edge of natural terrain (grass/dirt/path). Architectural floors set 0 so
   * their boundary stays straight and grid-aligned (crisp), not wavy.
   */
  edgeAmp?: number;
  /** Shading-lip band width in field units. Undefined ⇒ TERRAIN_RIM. Walls use
   * a thin lip so their edge reads as an inked outline, not a wide bevel. */
  rimWidth?: number;
  /** Cast-shadow override on lower families. Undefined ⇒ the default
   * grass-over-dirt lip. `strength` deepens the crisp near shadow; a `band`
   * ABOVE the shared default adds a soft LONG directional throw out to that
   * width (catalog #11 — shadow length is the height cue: roofs throw
   * furthest). The near band/probe stay at the shared defaults. */
  shadow?: { band: number; strength: number };
  /** Omnidirectional contact occlusion (catalog #4): a thin grime/AO band
   * hugging the family on EVERY side — the ground-contact cue that seats a
   * wall or roof on the map, distinct from the directional cast shadow.
   * `reach` in field units, `strength` the max darkening. */
  contact?: { reach: number; strength: number };
  /**
   * Low-frequency tonal clouds under the per-cell detail (Czepeku catalog #1):
   * `amp` is the max value offset (~0.03–0.08), `scale` the wavelength in
   * cells, `cool` shifts dark patches cool and light patches warm (0 ⇒
   * neutral). Kills the flat "vector fill" look one octave below cell detail.
   */
  mottle?: { amp: number; scale: number; cool?: number };
  /**
   * Shore-distance colour bands (catalog #2): ordered shallow→deep, each
   * applied while the cell distance ≤ `maxCells` (the last band extends to
   * ∞). Band boundaries are noise-jittered so they read organic, and the
   * family's `rim` becomes the waterline contact line. Needs the config's
   * `depthOf` sampler.
   */
  depthBands?: { maxCells: number; base: string }[];
  /**
   * Foam lace collar (Water II): a near-white cellular web hugging every land
   * contact in the shallowest water, its holes widening with shore distance
   * until only spray speckles remain past `reach` (in cells). Rides the same
   * `depthOf` sampler as the depth bands — inert without them.
   */
  foam?: { color: string; reach: number };
  /**
   * Caustic web (Water II): ridge-thresholded value noise (|n − ½| under a
   * thin epsilon) drawn as a pale web over the banded water, `strength` the
   * max colour mix, fading to nothing past `reach` cells of shore distance.
   */
  caustics?: { color: string; reach: number; strength: number };
  /**
   * Drowned-architecture tint (Water II): pull this family's finished pixels
   * toward the water body's bathymetry (`bands` = the water family's
   * depthBands) with strength keyed to this family's own shore depth —
   * shallow ruins keep their own colour, deep ones fade to whisper contrast.
   * The family's `depthOf` entry must be its water-body depth (the surface
   * registers the combined water∪sunken BFS under this family's id).
   * `priority` is the bands OWNER's priority (the water family), so the
   * band-boundary jitter matches across the water↔sunken seam instead of
   * wiggling differently on each side; omitted ⇒ this family's own seed.
   */
  sunken?: { bands: { maxCells: number; base: string }[]; priority?: number };
  /**
   * Polar-course landmark (polar-course engine): the family renders as
   * quantized radial courses around each painted region's point source
   * (terrainPolarField). `courseWidth`/`jointPitch` in cells; `ramp` darkens
   * toward the eave over the normalized radius; `sunSplit` splits luminance
   * against the shared top-right light (cones/domes); `jagged` roughens the
   * course edges (thatch tufts); `spiral` steps one course per turn. Needs
   * the config's `polarOf` sampler.
   */
  polar?: {
    courseWidth: number;
    jointPitch: number;
    jagged?: number;
    ramp?: number;
    sunSplit?: number;
    spiral?: boolean;
  };
  /**
   * False ⇒ the family's region is EXACTLY its painted cells (not the union
   * with higher-priority cells), and its edge bumps only EXTEND outward.
   * Water needs this: with the default union indicator, every floor/wall
   * region far from any pond would summon a phantom water fringe around its
   * crisp edge, and with receding bumps the water would open transparent gaps
   * against docks laid over it. Undefined ⇒ true (the classic underfill).
   */
  underfill?: boolean;
}

export interface TerrainFieldConfig {
  /** The family painted at a cell, or null for empty. */
  familyAt(cellX: number, cellY: number): string | null;
  families: readonly TerrainFieldFamily[];
  /** World px per cell. */
  cellSize: number;
  /** World coordinate of buffer pixel (0, 0). */
  originX: number;
  originY: number;
  /** World coordinate of the cell lattice origin (grid offset). Defaults to 0
   * so callers with a zero-offset grid can omit it. */
  offsetX?: number;
  offsetY?: number;
  /** Cell distance to the nearest non-`assetId` cell, for families with
   * `depthBands` (terrainDistanceField). Cells outside the family read 0. */
  depthOf?(assetId: string, cellX: number, cellY: number): number;
  /** The connected painted region's point source (centre + radius, world px)
   * for a cell of a `polar` family, or null off the family
   * (terrainPolarField.computePolarRegions). Angle/radial distance are
   * analytic from the centre — smoother than the cell-sampled depth field. */
  polarOf?(
    assetId: string,
    cellX: number,
    cellY: number,
  ): { centerX: number; centerY: number; radius: number } | null;
}

/** An RGB triple, 0–255 per channel. */
export type FieldRgb = [number, number, number];

/** The one field sampler: the composited pixel colour, and the signed field a
 * caller clips interior detail against (>= 0 is inside that family). */
export interface TerrainField {
  /** Pass-1 composited colour (base / rim / cast shadow) at a world point, or
   * null when no family paints there. */
  colorAt(wx: number, wy: number): FieldRgb | null;
  /** Signed field for one family at a world point; >= 0 is inside it,
   * >= TERRAIN_RIM is past its shading lip. Unknown ids sample as absent. */
  sampleField(assetId: string, wx: number, wy: number): number;
}
