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
// module paints only the base/rim/shadow field. Palette is data (terrainPalette,
// types in proceduralTerrainTypes, colour terms in terrainFieldColor). The
// per-pixel colour AND the signed field the caller clips detail against are
// both served by one sampler (createTerrainField), so there is a single field
// implementation. Validated in temp/_dirt_path_proto/transition_v2_proto.mjs.

import { smoothstep, valueNoise } from "./valueNoise";
import {
  causticWeightAt,
  CAUSTIC_SCALE_CELLS,
  foamMaskAt,
  FOAM_SCALE_CELLS,
  mixRgb,
  mottledRgb,
  parseBands,
  parseHex,
  pickBand,
  sunkenTintStrength,
} from "./terrainFieldColor";
import type { FieldRgb, TerrainField, TerrainFieldConfig } from "./proceduralTerrainTypes";

export type {
  FieldRgb,
  TerrainField,
  TerrainFieldConfig,
  TerrainFieldFamily,
} from "./proceduralTerrainTypes";

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
  /** Contact occlusion; strength 0 ⇒ none. */
  contactReach: number;
  contactStrength: number;
  /** Soft long directional throw; 0 ⇒ none (band at/below the default). */
  longShadowBand: number;
  longShadowStrength: number;
  /** Water II surface terms; reach/strength 0 ⇒ off (bit-parity default). */
  foamRgb: FieldRgb;
  foamReach: number;
  foamScale: number;
  causticRgb: FieldRgb;
  causticStrength: number;
  causticReach: number;
  causticScale: number;
  /** Water bathymetry a drowned family tints toward; empty ⇒ not sunken. */
  sunkenBands: { maxCells: number; rgb: FieldRgb }[];
  /** Noise seed of the bands' owner, so band jitter aligns across the seam. */
  sunkenSeed: number;
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
      // The crisp NEAR shadow keeps the shared band/probe for every family;
      // `strength` is per-family. A `shadow.band` above the default becomes
      // the soft LONG throw below (its hard-probed version read as detached
      // wedges at wall corners — the long pass gates softly instead).
      shadowBand: SHADOW,
      shadowStrength: f.shadow?.strength ?? SHADOW_STRENGTH,
      shadowProbe: SHADOW_PROBE,
      contactReach: f.contact?.reach ?? 0,
      contactStrength: f.contact?.strength ?? 0,
      longShadowBand: f.shadow && f.shadow.band > SHADOW ? f.shadow.band : 0,
      longShadowStrength: (f.shadow?.strength ?? SHADOW_STRENGTH) * 0.5,
      mottleAmp: f.mottle?.amp ?? 0,
      mottleScale: (f.mottle?.scale ?? 1) * cellSize,
      mottleCool: f.mottle?.cool ?? 0,
      bands: parseBands(f.depthBands),
      underfill: f.underfill ?? true,
      foamRgb: parseHex(f.foam?.color ?? "#ffffff"),
      foamReach: f.foam?.reach ?? 0,
      foamScale: FOAM_SCALE_CELLS * cellSize,
      causticRgb: parseHex(f.caustics?.color ?? "#ffffff"),
      causticStrength: f.caustics?.strength ?? 0,
      causticReach: f.caustics?.reach ?? 0,
      causticScale: CAUSTIC_SCALE_CELLS * cellSize,
      sunkenBands: parseBands(f.sunken?.bands),
      sunkenSeed: (f.sunken?.priority ?? f.priority) * 97 + 3,
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
  // Interior colour for a family the pixel is inside (v ≥ 0): rim lip, then
  // depth-banded water with its surface terms (noise-jittered band pick, the
  // caustic web fading off-shore, the foam collar overriding both), else the
  // plain base. Mottle rides on top; a drowned family then pulls the result
  // toward the water bathymetry with its depth (terrainFieldColor).
  //
  // A banded family's rim is the WATERLINE — a shore contact line — so it only
  // paints where the body depth is shallow. Without the gate, the exact-region
  // seam against a mid-lake drowned (sunken) structure would ring it with
  // broken near-white dashes (caught by a review probe). True shores always
  // sit well under the gate (shore cells are BFS depth 1), so maps without
  // drowned cells render bit-identically; non-banded families keep the
  // unconditional rim.
  const RIM_MAX_DEPTH = 1.5;
  const interiorColor = (f: FieldFamily, v: number, wx: number, wy: number): FieldRgb => {
    let flat: FieldRgb;
    if (
      v < f.rimWidth &&
      (f.bands.length === 0 || bilinearDepth(f.assetId, wx, wy) < RIM_MAX_DEPTH)
    ) {
      flat = f.rim;
    } else if (f.bands.length > 0) {
      const depth = bilinearDepth(f.assetId, wx, wy);
      flat = pickBand(f.bands, depth + disp(wx, wy, f.seed + 5));
      if (f.causticStrength > 0) {
        const w = causticWeightAt(wx, wy, f.seed + 25, f.causticScale, depth, f.causticReach);
        if (w > 0) flat = mixRgb(flat, f.causticRgb, w * f.causticStrength);
      }
      if (f.foamReach > 0 && foamMaskAt(wx, wy, f.seed + 21, f.foamScale, depth, f.foamReach)) {
        flat = f.foamRgb;
      }
    } else {
      flat = f.base;
    }
    let color =
      f.mottleAmp > 0
        ? mottledRgb(flat, wx, wy, f.seed, f.mottleScale, f.mottleAmp, f.mottleCool)
        : flat;
    if (f.sunkenBands.length > 0) {
      const depth = bilinearDepth(f.assetId, wx, wy);
      const a = sunkenTintStrength(depth);
      if (a > 0) {
        color = mixRgb(color, pickBand(f.sunkenBands, depth + disp(wx, wy, f.sunkenSeed + 5)), a);
      }
    }
    return color;
  };
  const colorAt = (wx: number, wy: number): FieldRgb | null => {
    let color: FieldRgb | null = null;
    for (const f of fams) {
      const v = fieldOf(f, wx, wy);
      if (v >= 0) {
        color = interiorColor(f, v, wx, wy);
      } else if (color && v < 0) {
        // Darkening terms from this higher family onto the colour painted so
        // far, composed multiplicatively so overlaps never crush to black.
        let keep = 1;
        // Contact occlusion: omnidirectional (no probe — the signed field is
        // already a distance-to-boundary on every side).
        if (f.contactStrength > 0 && v > -f.contactReach) {
          keep *= 1 - f.contactStrength * (1 + v / f.contactReach);
        }
        // Crisp near cast shadow: present up-right ⇒ shadowed lower-left edge.
        if (
          v > -f.shadowBand &&
          fieldOf(f, wx + cellSize * f.shadowProbe, wy - cellSize * f.shadowProbe) >= 0
        ) {
          keep *= 1 - f.shadowStrength * (1 + v / f.shadowBand);
        }
        // Soft long throw (tall families): the caster must be present up-right
        // at a distance MATCHING how far this pixel sits from the edge — which
        // is what lets the shadow reproduce the caster's outline — and the
        // presence gate is smoothed so the far edge feathers instead of
        // cutting into wedges.
        if (f.longShadowBand > 0 && v > -f.longShadowBand) {
          const throwOff = cellSize * Math.min(-v * 1.2, f.longShadowBand * 1.2);
          const presence = fieldOf(f, wx + throwOff, wy - throwOff);
          const soft = Math.min(1, Math.max(0, presence * 3 + 0.5));
          if (soft > 0) {
            keep *= 1 - f.longShadowStrength * (1 + v / f.longShadowBand) * soft;
          }
        }
        if (keep < 1) {
          color = [
            Math.round(color[0] * keep),
            Math.round(color[1] * keep),
            Math.round(color[2] * keep),
          ];
        }
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
