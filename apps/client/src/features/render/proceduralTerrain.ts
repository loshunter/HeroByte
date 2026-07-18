// Procedural terrain FIELD — the bumpy grass↔dirt↔path boundary render
// (Slynyrd "Grass/Dirt Connection Tiles", pg-50). Superseding the baked blob47
// silhouette: instead of tiling rounded quarters, the boundary between two
// families is a world-coherent noise-displaced field, so edges are organically
// bumpy and never repeat. Families layer by PRIORITY (grass over dirt over
// path); the higher family rounds its shading rim over the lower, which fills
// flat underneath (revealed at the higher family's receded edges). Light comes
// from the top-right, so the raised higher family casts a soft shadow on the
// lower one's lower-left.
//
// Pure and canvas-agnostic: it fills an RGBA pixel buffer (document-space, one
// buffer pixel per world pixel), which the surfaces blit — baked once per edit,
// then displayed like an image map. Interior DECORATION (grass blades, dirt
// pebbles) is a separate fillRect pass layered on top by the caller; this
// module paints only the base/rim/shadow field. Palette is data (terrainPalette).
// The per-pixel colour AND the signed field the caller clips detail against are
// both served by one sampler (createTerrainField), so there is a single field
// implementation. Validated in temp/_dirt_path_proto/transition_v2_proto.mjs.

import { smoothstep, valueNoise } from "./valueNoise";

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
   * grass-over-dirt lip. Only `strength` (max darkening, 0–1) is applied —
   * walls darken HARDER, not wider, to read tall (the Czepeku height cue).
   * `band` is a reserved depth knob; band/probe stay at the shared defaults. */
  shadow?: { band: number; strength: number };
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

// Tuning — validated in the prototype. Band and probe are shared by every
// family so the shipped grass/dirt/floor look is untouched; only the shadow
// STRENGTH is per-family (exported so tests pin overrides against it, not
// against magic literals).
export const TERRAIN_RIM = 0.16; // default shading-lip band width, in field units
export const TERRAIN_SHADOW_STRENGTH = 0.16; // default cast-shadow darkening
const SHADOW = 0.15; // cast-shadow band width on the lower family
const AMP = 0.9; // boundary bump amplitude
const SHADOW_STRENGTH = TERRAIN_SHADOW_STRENGTH;
const SHADOW_PROBE = 0.14; // up-right presence probe, in cells

const parseHex = (h: string): FieldRgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

interface FieldFamily {
  assetId: string;
  priority: number;
  base: FieldRgb;
  rim: FieldRgb;
  seed: number;
  edgeAmp: number;
  rimWidth: number;
  shadowBand: number;
  shadowStrength: number;
  shadowProbe: number;
  /** Precomputed mottle: max value offset, wavelength in px, cool shift. */
  mottleAmp: number;
  mottleScale: number;
  mottleCool: number;
  /** Parsed depth bands, sorted shallow→deep; empty ⇒ plain base fill. */
  bands: { maxCells: number; rgb: FieldRgb }[];
  underfill: boolean;
}

/**
 * Build the shared field sampler for a terrain config. `colorAt` and
 * `sampleField` are the ONLY field math in the codebase, so the per-pixel bake
 * and the caller's detail-clipping can never diverge (F10). Pure and
 * deterministic on the world lattice.
 */
export function createTerrainField(config: TerrainFieldConfig): TerrainField {
  const { familyAt, cellSize } = config;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;
  // Low → high priority; precompute rgb + a distinct noise seed per family so
  // adjacent boundaries don't share the exact same bumps.
  const fams: FieldFamily[] = [...config.families]
    .sort((a, b) => a.priority - b.priority)
    .map((f) => ({
      assetId: f.assetId,
      priority: f.priority,
      base: parseHex(f.base),
      rim: parseHex(f.rim),
      seed: f.priority * 97 + 3,
      edgeAmp: f.edgeAmp ?? 1,
      rimWidth: f.rimWidth ?? TERRAIN_RIM,
      // Band and probe stay at the shared defaults for every family; only the
      // shadow's `strength` is per-family (tall families darken harder, not
      // wider — a widened band/probe read as detached wedges at wall corners).
      shadowBand: SHADOW,
      shadowStrength: f.shadow?.strength ?? SHADOW_STRENGTH,
      shadowProbe: SHADOW_PROBE,
      mottleAmp: f.mottle?.amp ?? 0,
      mottleScale: (f.mottle?.scale ?? 1) * cellSize,
      mottleCool: f.mottle?.cool ?? 0,
      bands: [...(f.depthBands ?? [])]
        .sort((a, b) => a.maxCells - b.maxCells)
        .map((band) => ({ maxCells: band.maxCells, rgb: parseHex(band.base) })),
      underfill: f.underfill ?? true,
    }));
  const byId = new Map(fams.map((f) => [f.assetId, f]));
  const priorityOf = new Map(config.families.map((f) => [f.assetId, f.priority]));
  const fillPriority = (cx: number, cy: number): number => {
    const id = familyAt(cx, cy);
    return id ? (priorityOf.get(id) ?? 0) : 0;
  };
  const ns = cellSize * 1.15;
  const disp = (wx: number, wy: number, seed: number): number =>
    (valueNoise(wx / ns, wy / ns, seed) - 0.5) * AMP +
    (valueNoise(wx / (ns * 0.5) + 13, wy / (ns * 0.5) + 7, seed + 1) - 0.5) * AMP * 0.45;
  // Bilinear sample of a family's indicator. Underfill families count a cell
  // when its fill priority ≥ theirs (lower families fill UNDER higher ones);
  // an exact family (underfill: false — water) counts ONLY its own cells, or
  // every distant floor/wall region would summon a phantom fringe of it. World
  // coords map to the cell lattice through the grid offset.
  const bilinearIndicator = (f: FieldFamily, wx: number, wy: number): number => {
    const gx = (wx - offsetX) / cellSize - 0.5;
    const gy = (wy - offsetY) / cellSize - 0.5;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const fx = smoothstep(gx - i0);
    const fy = smoothstep(gy - j0);
    const ind = f.underfill
      ? (ix: number, iy: number): number => (fillPriority(ix, iy) >= f.priority ? 1 : 0)
      : (ix: number, iy: number): number => (familyAt(ix, iy) === f.assetId ? 1 : 0);
    const top = ind(i0, j0) * (1 - fx) + ind(i0 + 1, j0) * fx;
    const bot = ind(i0, j0 + 1) * (1 - fx) + ind(i0 + 1, j0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };
  // Signed field; ≥ 0 is inside. `prox` peaks at the boundary and is 0 in solid
  // interior, so the bump never punches a hole through solid ground.
  const fieldOf = (f: FieldFamily, wx: number, wy: number): number => {
    const base = bilinearIndicator(f, wx, wy);
    const prox = 1 - Math.abs(2 * base - 1);
    // edgeAmp scales the per-family boundary bump: 1 = organic (natural
    // terrain), 0 = crisp grid-aligned edge (floors). The bilinear indicator's
    // 0.5 contour already traces the cell boundary, so amp 0 gives a straight
    // edge. An exact family's bump only EXTENDS (never recedes): receding
    // would open transparent gaps against a crisp higher neighbour (a dock),
    // while extending is always safely overdrawn by it.
    const bump = f.underfill ? disp(wx, wy, f.seed) : Math.max(0, disp(wx, wy, f.seed));
    return base - 0.5 + bump * prox * f.edgeAmp;
  };
  // Smoothstep-bilinear shore distance in cells (0 outside the family), so
  // depth bands curve smoothly between cell centres instead of stair-stepping.
  const depthOf = config.depthOf;
  const bilinearDepth = (assetId: string, wx: number, wy: number): number => {
    if (!depthOf) return 0;
    const gx = (wx - offsetX) / cellSize - 0.5;
    const gy = (wy - offsetY) / cellSize - 0.5;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const fx = smoothstep(gx - i0);
    const fy = smoothstep(gy - j0);
    const top = depthOf(assetId, i0, j0) * (1 - fx) + depthOf(assetId, i0 + 1, j0) * fx;
    const bot = depthOf(assetId, i0, j0 + 1) * (1 - fx) + depthOf(assetId, i0 + 1, j0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };
  // Depth-band colour: noise-jittered distance picks the band, so band
  // boundaries wander organically like the reference maps' bathymetry.
  const bandColorOf = (f: FieldFamily, wx: number, wy: number): FieldRgb => {
    const d = bilinearDepth(f.assetId, wx, wy) + disp(wx, wy, f.seed + 5);
    for (const band of f.bands) {
      if (d <= band.maxCells) return band.rgb;
    }
    return f.bands[f.bands.length - 1]!.rgb;
  };
  // Low-frequency value mottle: two noise octaves at the family's wavelength,
  // dark patches shifted cool and light patches warm by `mottleCool`. Returns
  // a fresh triple — base/rim/band arrays are shared references.
  const mottled = (f: FieldFamily, rgb: FieldRgb, wx: number, wy: number): FieldRgb => {
    const s = f.mottleScale;
    const n =
      valueNoise(wx / s, wy / s, f.seed + 11) -
      0.5 +
      (valueNoise(wx / (s * 0.5) + 31, wy / (s * 0.5) + 17, f.seed + 12) - 0.5) * 0.5;
    const v = n * 1.33 * f.mottleAmp; // two octaves span ±0.75 → normalise to ±amp
    const shift = f.mottleCool * 0.35;
    const clamp255 = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);
    return [
      Math.round(clamp255(rgb[0] * (1 + v * (1 + shift)))),
      Math.round(clamp255(rgb[1] * (1 + v))),
      Math.round(clamp255(rgb[2] * (1 + v * (1 - shift)))),
    ];
  };
  const colorAt = (wx: number, wy: number): FieldRgb | null => {
    let color: FieldRgb | null = null;
    for (const f of fams) {
      const v = fieldOf(f, wx, wy);
      if (v >= 0) {
        const flat = v < f.rimWidth ? f.rim : f.bands.length > 0 ? bandColorOf(f, wx, wy) : f.base;
        color = f.mottleAmp > 0 ? mottled(f, flat, wx, wy) : flat;
      } else if (
        color &&
        v > -f.shadowBand &&
        fieldOf(f, wx + cellSize * f.shadowProbe, wy - cellSize * f.shadowProbe) >= 0
      ) {
        // Cast shadow: this higher family is present up-right, so darken the
        // lower family already painted here (its shadowed lower-left edge).
        const k = f.shadowStrength * (1 + v / f.shadowBand); // v in (-band,0) → fades out
        color = [
          Math.round(color[0] * (1 - k)),
          Math.round(color[1] * (1 - k)),
          Math.round(color[2] * (1 - k)),
        ];
      }
    }
    return color;
  };
  const sampleField = (assetId: string, wx: number, wy: number): number => {
    const f = byId.get(assetId);
    return f ? fieldOf(f, wx, wy) : Number.NEGATIVE_INFINITY;
  };
  return { colorAt, sampleField };
}

/**
 * Render the terrain base/rim/shadow field into an RGBA buffer. Painted pixels
 * get alpha 255; empty (no family, or a higher family's carved edge over
 * nothing) stays transparent. Thin wrapper over the shared sampler so the bake
 * and detail-clipping share one field.
 */
export function renderTerrainField(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: TerrainFieldConfig,
): void {
  const { colorAt } = createTerrainField(config);
  const { originX, originY } = config;
  for (let py = 0; py < height; py += 1) {
    const wy = originY + py + 0.5;
    for (let pxi = 0; pxi < width; pxi += 1) {
      const wx = originX + pxi + 0.5;
      const color = colorAt(wx, wy);
      if (color) {
        const o = (py * width + pxi) * 4;
        pixels[o] = color[0];
        pixels[o + 1] = color[1];
        pixels[o + 2] = color[2];
        pixels[o + 3] = 255;
      }
    }
  }
}
