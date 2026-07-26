// Per-family precompute for the procedural terrain field — the parsed,
// defaulted FieldFamily records createTerrainField samples against (split
// from proceduralTerrain for the 350-LOC cap, precedent
// proceduralTerrainTypes). Pure data preparation: all field MATH stays in
// proceduralTerrain, so there is still exactly one field implementation.

import { CAUSTIC_SCALE_CELLS, FOAM_SCALE_CELLS, parseBands, parseHex } from "./terrainFieldColor";
import type { PolarParams } from "./terrainPolarField";
import type { FieldRgb, TerrainFieldFamily } from "./proceduralTerrainTypes";

// Tuning — validated in the prototype. Band and probe are shared by every
// family so the shipped grass/dirt/floor look is untouched; only the shadow
// STRENGTH is per-family (exported so tests pin overrides against it, not
// against magic literals).
export const TERRAIN_RIM = 0.16; // default shading-lip band width, in field units
export const TERRAIN_SHADOW_STRENGTH = 0.16; // default cast-shadow darkening
export const SHADOW = 0.15; // cast-shadow band width on the lower family
const SHADOW_STRENGTH = TERRAIN_SHADOW_STRENGTH;
export const SHADOW_PROBE = 0.14; // up-right presence probe, in cells

export interface FieldFamily {
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
  /** Polar-course params (terrainPolarField); undefined ⇒ not a landmark. */
  polar?: PolarParams;
  /** Canopy two-tone terms (catalog rank 9); undefined ⇒ not a canopy. */
  canopy?: { shade: FieldRgb; core: FieldRgb; sub: number };
}

/** Low → high priority; precompute rgb + a distinct noise seed per family so
 * adjacent boundaries don't share the exact same bumps. */
export function buildFieldFamilies(
  families: readonly TerrainFieldFamily[],
  cellSize: number,
): FieldFamily[] {
  return [...families]
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
      polar: f.polar,
      canopy: f.canopy
        ? {
            shade: parseHex(f.canopy.shade),
            core: parseHex(f.canopy.core),
            sub: f.canopy.sub ?? 0.35,
          }
        : undefined,
    }));
}
