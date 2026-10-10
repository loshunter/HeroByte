// ============================================================================
// A PLAYER'S COLOUR AS TEXT AND EDGES — readable on any background (slice C3)
// ============================================================================
// C1's window runs from deep shades (L 0.30) to pastels, and older colours can
// be anything, so a name in a player's colour cannot simply be painted in it:
// on the navy panels the darkest colours are about 1.3:1. Text takes the colour
// with its OKLCH lightness moved, the hue kept, until it reads; an edge drawn
// around a colour takes whichever of a dark or a light keyline contrasts more.
// Side-effect free: nothing runs at module load.

import {
  colorToOkLab,
  contrastRatio,
  isInGamut,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  parseColor,
  relativeLuminance,
  rgbToHex,
  type Rgb,
} from "./colorSpace.js";

/** The keyline pair: a near-black and a warm near-white from the JRPG palette. */
export const KEYLINE_DARK = "#0b0b16";
export const KEYLINE_LIGHT = "#f4f1e8";

/**
 * The most of `C` sRGB can show at this lightness and hue (binary search). Kept
 * here rather than importing colorWindow's maxChroma: names and pings need this
 * on first load, and that import would pull the whole colour window (the
 * picker's lazy chunk) into the entry bundle.
 */
function chromaInGamut(L: number, C: number, h: number): number {
  const fits = (chroma: number) => isInGamut(okLabToRgb(okLchToOkLab({ L, C: chroma, h })));
  if (fits(C)) return C;
  let low = 0;
  let high = C;
  for (let step = 0; step < 18; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** The colour at lightness L with its own hue, chroma cut to what sRGB can show there. */
function atLightness(L: number, C: number, h: number): Rgb {
  const chroma = chromaInGamut(L, C, h);
  const rgb = okLabToRgb(okLchToOkLab({ L, C: chroma, h }));
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return { r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b) };
}

/**
 * `color` as text on `background`: unchanged when it already reaches `target`
 * contrast, else its lightness moved (up on a dark background, down on a light
 * one) just far enough, keeping the hue. `#rrggbb`, or null for an unreadable
 * colour or background (the caller keeps its own fallback).
 */
export function readableOn(color: string, background: string, target = 4.5): string | null {
  const rgb = parseColor(color);
  const ground = parseColor(background);
  const lab = colorToOkLab(color);
  if (!rgb || !ground || !lab) return null;
  if (contrastRatio(rgb, ground) >= target) return rgbToHex(rgb);
  const { C, h } = okLabToOkLch(lab);
  const lighten = relativeLuminance(ground) < 0.18;
  // Judged as the #rrggbb it will be written as: rounding can cost a hair of contrast.
  const hexAt = (L: number) => rgbToHex(atLightness(L, C, h));
  const reaches = (L: number) => contrastRatio(parseColor(hexAt(L))!, ground) >= target;
  // Binary search for the smallest move that reaches the target.
  let near = lab.L;
  let far = lighten ? 1 : 0;
  if (!reaches(far)) return hexAt(far);
  for (let step = 0; step < 24; step += 1) {
    const middle = (near + far) / 2;
    if (reaches(middle)) far = middle;
    else near = middle;
  }
  return hexAt(far);
}

/**
 * Text drawn ON `color` (a badge's number, an initial on a ring): black or white,
 * whichever contrasts more. That is at least 4.58:1 for any colour, where the
 * keyline pair below bottoms out at 4.16:1 (`#008183`), short of text's 4.5:1.
 */
export function textOn(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return "#ffffff";
  const black = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  const white = contrastRatio(rgb, { r: 1, g: 1, b: 1 });
  return black >= white ? "#000000" : "#ffffff";
}

/** The keyline for an edge drawn in `color`: dark or light, whichever contrasts more. */
export function keylineFor(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return KEYLINE_DARK;
  const dark = contrastRatio(rgb, parseColor(KEYLINE_DARK)!);
  const light = contrastRatio(rgb, parseColor(KEYLINE_LIGHT)!);
  return dark >= light ? KEYLINE_DARK : KEYLINE_LIGHT;
}
