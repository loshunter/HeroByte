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

import { hash2, smoothstep, valueNoise } from "./valueNoise";
import {
  causticWeightAt,
  foamMaskAt,
  mixRgb,
  mottledRgb,
  parseHex,
  pickBand,
  shadowedRgb,
  sunkenTintStrength,
} from "./terrainFieldColor";
import { polarCourseColor } from "./terrainPolarField";
import { buildFieldFamilies, type FieldFamily } from "./proceduralTerrainFamilies";
import type { FieldRgb, TerrainField, TerrainFieldConfig } from "./proceduralTerrainTypes";

export type {
  FieldRgb,
  TerrainField,
  TerrainFieldConfig,
  TerrainFieldFamily,
} from "./proceduralTerrainTypes";
// The shared tuning constants moved to the family-precompute module
// (proceduralTerrainFamilies, 350-LOC cap); re-exported so callers and tests
// keep their import path.
export { TERRAIN_RIM, TERRAIN_SHADOW_STRENGTH } from "./proceduralTerrainFamilies";

const AMP = 0.9; // boundary bump amplitude

// Paired-family interleave tuning (catalog rank 12): the shared-noise
// wavelength and seam reach in cells, the hysteresis half-band, and the
// override amplitude. The amplitude must clear the ±0.5 field saturation
// AFTER the reach falloff halves it — at amp 8, a noise excursion of ~0.15
// past the band flips ownership one cell into the partner, ~0.25 reaches
// almost two; smaller excursions only warp the seam (the interpenetration).
const IL_SCALE = 2.2;
const IL_REACH = 2.4;
const IL_BAND = 0.05;
const IL_AMP = 8;

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
  const shadowTint = config.shadowTint ? parseHex(config.shadowTint) : null;
  const fams = buildFieldFamilies(config.families, cellSize);
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
    let bump = f.underfill ? disp(wx, wy, f.seed) : Math.max(0, disp(wx, wy, f.seed));
    // Canopy sub-lobe octave: a fine extra displacement (≈quarter-cell
    // wavelength) so the crown edge carries small scallops riding the big
    // lobes — the corpus' two-scale leaf silhouette. Gated on the knob, so
    // every other family's field is bit-identical.
    if (f.canopy) {
      const sub = valueNoise(wx / (ns * 0.22) + 31, wy / (ns * 0.22) + 11, f.seed + 2) - 0.5;
      bump += sub * f.canopy.sub;
    }
    let v = base - 0.5 + bump * prox * f.edgeAmp;
    // Paired-family interleave (catalog rank 12): near the seam with the
    // partner, shared low-frequency noise past the hysteresis band overrides
    // ownership — EXTEND this family inside the partner (echo islands) or
    // CARVE it so the underfilling partner shows through. The near-family
    // probes keep islands off the partner's OTHER seams (a grass echo must
    // not spawn beside a dirt↔path boundary with no grass in sight).
    if (f.interleave) {
      const cx = Math.floor((wx - offsetX) / cellSize);
      const cy = Math.floor((wy - offsetY) / cellSize);
      const n = valueNoise(wx / (ns * IL_SCALE) + 3, wy / (ns * IL_SCALE) + 89, f.seed + 17);
      const dOther = bilinearDepth(f.interleave.with, wx, wy);
      if (dOther > 0 && dOther < IL_REACH && n > 0.5 + IL_BAND && nearFamily(f.assetId, cx, cy)) {
        v += (n - 0.5 - IL_BAND) * IL_AMP * (1 - dOther / IL_REACH);
      } else if (n < 0.5 - IL_BAND && nearFamily(f.interleave.with, cx, cy)) {
        const dSelf = bilinearDepth(f.assetId, wx, wy);
        if (dSelf > 0 && dSelf < IL_REACH) {
          v -= (0.5 - IL_BAND - n) * IL_AMP * (1 - dSelf / IL_REACH);
        }
      }
    }
    return v;
  };
  // True when `id` is painted at the cell or within two cells on an axis —
  // the coarse "is the pair's seam actually near here" gate for interleave.
  const nearFamily = (id: string, cx: number, cy: number): boolean =>
    familyAt(cx, cy) === id ||
    familyAt(cx + 1, cy) === id ||
    familyAt(cx - 1, cy) === id ||
    familyAt(cx, cy + 1) === id ||
    familyAt(cx, cy - 1) === id ||
    familyAt(cx + 2, cy) === id ||
    familyAt(cx - 2, cy) === id ||
    familyAt(cx, cy + 2) === id ||
    familyAt(cx, cy - 2) === id;
  // Smoothstep-bilinear shore distance in cells (0 outside the family), so
  // depth bands curve smoothly between cell centres instead of stair-stepping.
  const depthOf = config.depthOf;
  const polarOf = config.polarOf;
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
    } else if (f.polar && polarOf) {
      // Polar landmark: quantized radial courses around the painted region's
      // point source; off-region pixels (an underfilled neighbour) keep base.
      const cx = Math.floor((wx - offsetX) / cellSize);
      const cy = Math.floor((wy - offsetY) / cellSize);
      const region = polarOf(f.assetId, cx, cy);
      flat = region
        ? polarCourseColor(f.base, f.rim, wx, wy, region, f.polar, f.seed, cellSize)
        : f.base;
    } else if (f.canopy) {
      // Canopy two-tone (catalog rank 9): the side of the crown nearer its
      // up-right edge faces the sun and stays `base`; the far side drops to
      // `shade`. Asymmetric depth probes make the split follow each blob's
      // own silhouette, and noise jitters the boundary so it reads as leaf
      // mass, not a ruled line. Deeper into the crown, both tones sink
      // toward `core` — the under-canopy darkness.
      const probe = cellSize * 0.9;
      const upRight = bilinearDepth(f.assetId, wx + probe, wy - probe);
      const downLeft = bilinearDepth(f.assetId, wx - probe, wy + probe);
      const jitter =
        (valueNoise(wx / (ns * 2.2) + 47, wy / (ns * 2.2) + 5, f.seed + 3) - 0.5) * 1.6;
      flat = upRight + jitter <= downLeft ? f.base : f.canopy.shade;
      const coreT = Math.min(1, bilinearDepth(f.assetId, wx, wy) / 4) * 0.55;
      if (coreT > 0) flat = mixRgb(flat, f.canopy.core, coreT);
    } else {
      flat = f.base;
    }
    let color =
      f.mottleAmp > 0
        ? mottledRgb(flat, wx, wy, f.seed, f.mottleScale, f.mottleAmp, f.mottleCool)
        : flat;
    // Micro-grunge speckle (catalog rank 12): sparse 1px darker flecks at
    // bake resolution, one octave finer than the mottle's clouds.
    if (
      f.speckleChance > 0 &&
      hash2(Math.floor(wx), Math.floor(wy), f.seed + 23) < f.speckleChance
    ) {
      color = mixRgb(color, [0, 0, 0], f.speckleAmp);
    }
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
        if (keep < 1) color = shadowedRgb(color, keep, shadowTint);
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
