// Atmospheric haze post-pass (lava cavern study) — the drifting smoke/ash veil
// that gives a volcanic cavern its depth. The one thing the palette genuinely
// could not express: mottle is per-family and value-only, and the lighting
// veil is a map-global DARKENING, but haze must LIGHTEN and desaturate across
// family boundaries in soft continent-scale drifts.
//
// Pure and world-lattice deterministic like every other field term, so the bake
// and any re-render agree. Runs over the finished bake buffer (after the detail
// and lighting passes — atmosphere sits in front of everything) and touches
// only painted pixels, so the map's silhouette is unchanged.

import { valueNoise } from "./valueNoise";

export interface AshHaze {
  /** Veil colour — warm pale grey for ash, cooler for mist. */
  color: string;
  /** Maximum mix toward `color` where the drift is densest (0..1). */
  strength: number;
  /** Drift wavelength in CELLS (large — this is weather, not texture). */
  scale: number;
  /**
   * Vertical density ramp: multiplier at the TOP of the bake and at the
   * BOTTOM. Smoke pools low, so a cavern typically runs light at the top and
   * heavy at the floor. Both default to 1 (an even veil).
   */
  rampTop?: number;
  rampBottom?: number;
}

/** True when the haze would change any pixel — lets callers skip the pass. */
export function hazeActive(haze: AshHaze | undefined): haze is AshHaze {
  return haze !== undefined && haze.strength > 0;
}

/**
 * Mix the finished bake toward the haze colour by a two-octave drift field,
 * scaled by the vertical ramp. `originX/Y` are the buffer's world origin, so
 * the drift is locked to world space and a re-bake of the same map is
 * identical. Alpha-0 (unpainted) pixels are left alone.
 */
export function applyAshHaze(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  cellSize: number,
  haze: AshHaze,
): void {
  const r = parseInt(haze.color.slice(1, 3), 16);
  const g = parseInt(haze.color.slice(3, 5), 16);
  const b = parseInt(haze.color.slice(5, 7), 16);
  const wavelength = Math.max(1, haze.scale * cellSize);
  const top = haze.rampTop ?? 1;
  const bottom = haze.rampBottom ?? 1;

  for (let py = 0; py < height; py += 1) {
    // Vertical ramp is per-ROW, so it costs one lerp per scanline.
    const ramp = top + (bottom - top) * (height <= 1 ? 0 : py / (height - 1));
    if (ramp <= 0) continue;
    const wy = originY + py + 0.5;
    for (let px = 0; px < width; px += 1) {
      const o = (py * width + px) * 4;
      if (pixels[o + 3] === 0) continue; // never haze empty space
      const wx = originX + px + 0.5;
      // Two octaves: continent-scale banks plus a finer curl, biased so the
      // field spends most of its range in thin veil and only peaks are dense.
      const n =
        valueNoise(wx / wavelength, wy / wavelength, 811) * 0.7 +
        valueNoise(wx / (wavelength * 0.42) + 19, wy / (wavelength * 0.42) + 7, 812) * 0.3;
      const density = n * n; // square it — thin most places, thick in banks
      const t = haze.strength * ramp * density;
      if (t <= 0) continue;
      const mix = t > 1 ? 1 : t;
      pixels[o] = pixels[o]! + (r - pixels[o]!) * mix;
      pixels[o + 1] = pixels[o + 1]! + (g - pixels[o + 1]!) * mix;
      pixels[o + 2] = pixels[o + 2]! + (b - pixels[o + 2]!) * mix;
    }
  }
}
