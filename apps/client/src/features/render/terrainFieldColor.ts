// Colour terms for the procedural terrain field — hex parsing, the mottle
// cloud, depth-band picking, and the Water II per-pixel surface terms (foam
// lace, caustic web, drowned-structure tint). Split from proceduralTerrain for
// the 350-LOC cap; every function here is pure and world-lattice deterministic
// so the bake and any re-render agree. The mottle/band arithmetic is moved
// VERBATIM — families without the new knobs must render bit-identically
// (pinned by the proceduralTerrain suite).

import { valueNoise } from "./valueNoise";
import type { FieldRgb } from "./proceduralTerrainTypes";

export const parseHex = (h: string): FieldRgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Linear RGB mix, rounded — a fresh triple (inputs are shared references). */
export const mixRgb = (a: FieldRgb, b: FieldRgb, t: number): FieldRgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Depth bands with parsed colours, sorted shallow→deep. */
export type ParsedBands = { maxCells: number; rgb: FieldRgb }[];

/** Parse + sort palette depth bands into the form pickBand consumes. */
export const parseBands = (
  bands: readonly { maxCells: number; base: string }[] | undefined,
): ParsedBands =>
  [...(bands ?? [])]
    .sort((a, b) => a.maxCells - b.maxCells)
    .map((band) => ({ maxCells: band.maxCells, rgb: parseHex(band.base) }));

/** The shallow→deep band whose maxCells covers `d` (the last extends to ∞).
 * Bands must be pre-sorted ascending — the same contract bandColorOf had. */
export function pickBand(bands: ParsedBands, d: number): FieldRgb {
  for (const band of bands) {
    if (d <= band.maxCells) return band.rgb;
  }
  return bands[bands.length - 1]!.rgb;
}

/**
 * Low-frequency value mottle: two noise octaves at the family's wavelength
 * (`scale` in world px), dark patches shifted cool and light patches warm by
 * `cool`. Returns a fresh triple — base/rim/band arrays are shared references.
 */
export function mottledRgb(
  rgb: FieldRgb,
  wx: number,
  wy: number,
  seed: number,
  scale: number,
  amp: number,
  cool: number,
): FieldRgb {
  const n =
    valueNoise(wx / scale, wy / scale, seed + 11) -
    0.5 +
    (valueNoise(wx / (scale * 0.5) + 31, wy / (scale * 0.5) + 17, seed + 12) - 0.5) * 0.5;
  const v = n * 1.33 * amp; // two octaves span ±0.75 → normalise to ±amp
  const shift = cool * 0.35;
  const clamp255 = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);
  return [
    Math.round(clamp255(rgb[0] * (1 + v * (1 + shift)))),
    Math.round(clamp255(rgb[1] * (1 + v))),
    Math.round(clamp255(rgb[2] * (1 + v * (1 - shift)))),
  ];
}

// --- Water II surface terms -------------------------------------------------

/** Foam noise wavelength in cells — fine enough that near-shore holes and the
 * outer spray speckles land in the study's 2–6 px range on the 50 px grid. */
export const FOAM_SCALE_CELLS = 0.35;
/** Inside this shore distance the web is solid (holes only at noise peaks) —
 * the painted waterline sits near depth ≈ 0.4, so the collar hugs the land. */
const FOAM_SOLID_DEPTH = 0.3;

/**
 * The foam lace mask at a world point: true ⇒ this water pixel is foam. One
 * noise field thresholded at a cutoff that falls with shore distance — a
 * near-solid web with punched holes at the land contact, dissolving through
 * connected lace into sparse speckles, gone smoothly at `reach` (cells).
 */
export function foamMaskAt(
  wx: number,
  wy: number,
  seed: number,
  scale: number,
  depth: number,
  reach: number,
): boolean {
  // A reach at/below the solid-collar depth has no dissolve range to sweep —
  // treat it as off rather than let the t ratio go negative/NaN.
  if (depth >= reach || reach <= FOAM_SOLID_DEPTH) return false;
  const t = Math.max(0, (depth - FOAM_SOLID_DEPTH) / (reach - FOAM_SOLID_DEPTH));
  // The two-octave noise sum concentrates near ½ (σ ≈ 0.14 after the /1.5
  // normalisation), so the cutoff sweeps that REAL quantile range: ~0.68 at
  // the land contact (foam over ~85 %, holes at the noise peaks) through the
  // half-coverage lace near mid-collar, diving to zero at the reach so the
  // spray dissolves without a hard density edge.
  const cut = 0.68 * Math.pow(1 - t, 0.55);
  const n =
    valueNoise(wx / scale, wy / scale, seed) -
    0.5 +
    (valueNoise(wx / (scale * 0.55) + 53, wy / (scale * 0.55) + 29, seed + 1) - 0.5) * 0.5;
  return 0.5 + n / 1.5 < cut;
}

/** Caustic noise wavelength in cells — one octave, so the ½-contour of the
 * noise forms the connected refraction web the reference maps show. */
export const CAUSTIC_SCALE_CELLS = 0.75;
/** Ridge half-width: how far from the noise ½-contour still reads as web. */
const CAUSTIC_EPS = 0.07;

/**
 * The caustic web weight (0..1) at a world point: proximity to the ridge
 * |noise − ½| = 0, faded linearly to zero past `reach` cells of shore
 * distance — sunlit refraction lives in the shallows, never over the deeps.
 */
export function causticWeightAt(
  wx: number,
  wy: number,
  seed: number,
  scale: number,
  depth: number,
  reach: number,
): number {
  if (reach <= 0) return 0; // guard the ratio below — never NaN into the mix
  const fade = 1 - depth / reach;
  if (fade <= 0) return 0;
  const ridge = 1 - Math.abs(valueNoise(wx / scale, wy / scale, seed) - 0.5) / CAUSTIC_EPS;
  return ridge <= 0 ? 0 : ridge * (fade > 1 ? 1 : fade);
}

/**
 * How hard a drowned structure's pixels pull toward the water colour at a
 * given water-body depth (cells). The sunken palettes are already pre-mixed
 * 40 % toward the water mid tone, so this is the ADDITIONAL depth term: zero
 * in the shallows (the pre-mix alone ≈ the study's 40 % tint / halved
 * contrast), rising to a 0.75 cap where deep ruins read as whisper contrast.
 */
export function sunkenTintStrength(depth: number): number {
  const a = 0.25 * (depth - 1);
  return a < 0 ? 0 : a > 0.75 ? 0.75 : a;
}

/**
 * The DETAIL-side drown: a sunken sibling's painters draw their raw dry-land
 * hex shades, so the tint context maps each through the FULL study curve —
 * 40 % toward the water colour at the shore, capped at 85 % (whisper
 * contrast) in the deeps. Cell-resolution depth is fine here: detail rides on
 * top of the per-pixel field tint, it never has to bit-match it.
 */
export function drownHex(hex: string, depth: number, bands: ParsedBands): string {
  const t = Math.min(0.85, 0.4 + 0.15 * Math.max(0, depth - 1));
  const [r, g, b] = mixRgb(parseHex(hex), pickBand(bands, depth), t);
  return `rgb(${r}, ${g}, ${b})`;
}
