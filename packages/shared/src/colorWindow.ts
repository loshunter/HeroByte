// ============================================================================
// COLOUR WINDOW — the picker's hue × lightness plane, in OKLCH
// ============================================================================
// The owner pictures "a pixel on the colour picker window, and a circle around
// it". For a circle to mean "looks different" anywhere on the window, the
// window is laid out in OKLCH: x is HUE (0..360°, and it WRAPS — the left and
// right edges are one colour), y is LIGHTNESS (light at the top), and every
// point shows one target chroma, or the most sRGB can show there when the
// gamut runs out first. Greys, near-black and near-white are not on the window
// at all: they vanish on dark maps, in fog, and on the navy cards.
//
// The window is a VIEW. The rule itself is measured in OKLab (colorRule.ts),
// on the colours each cell actually displays, so where the gamut clips a zone
// simply comes out flatter instead of pretending to be a circle.

import {
  isInGamut,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  colorToOkLab,
  rgbToHex,
  rgbToOkLab,
  type OkLab,
} from "./colorSpace.js";

export const COLOR_WINDOW = {
  /** Target chroma; a point shows min(this, the most sRGB allows there). */
  chroma: 0.17,
  /** Lightness band (OKLab L): the bottom and top edges. */
  lightMin: 0.64,
  lightMax: 0.88,
  /** Raster resolution for zones, snapping and suggestions (2° × ~0.004 L). */
  columns: 180,
  rows: 60,
} as const;

/** u: hue as 0..1 (wraps); v: 0 at the top (lightest) to 1 at the bottom. */
export interface WindowPoint {
  u: number;
  v: number;
}

export interface WindowColor {
  hex: string;
  /** OKLab of the ROUNDED hex: distances measure exactly what gets stored. */
  lab: OkLab;
}

export interface WindowCell extends WindowColor, WindowPoint {
  column: number;
  row: number;
}

const wrapUnit = (value: number): number => ((value % 1) + 1) % 1;
const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/** The most chroma sRGB can show at this lightness and hue (binary search). */
export function maxChroma(lightness: number, hue: number, ceiling = 0.4): number {
  const fits = (chroma: number) =>
    isInGamut(okLabToRgb(okLchToOkLab({ L: lightness, C: chroma, h: hue })));
  if (fits(ceiling)) return ceiling;
  let low = 0;
  let high = ceiling;
  for (let step = 0; step < 18; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

export function windowLightness(v: number): number {
  const { lightMax, lightMin } = COLOR_WINDOW;
  return lightMax - clampUnit(v) * (lightMax - lightMin);
}

/** The colour a window point displays. */
export function windowColorAt(point: WindowPoint): WindowColor {
  const hue = wrapUnit(point.u) * 360;
  const lightness = windowLightness(point.v);
  const chroma = Math.min(COLOR_WINDOW.chroma, maxChroma(lightness, hue));
  const raw = okLabToRgb(okLchToOkLab({ L: lightness, C: chroma, h: hue }));
  const hex = rgbToHex(raw);
  const rounded = {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
  return { hex, lab: rgbToOkLab(rounded) };
}

/**
 * Where a colour sits on the window: its hue, and its lightness clamped into
 * the band. A colour from before the window (a legacy hsl, a file's hex) still
 * gets a handle position; the colour itself stays what it is until moved.
 */
export function windowPointOf(color: string): WindowPoint | null {
  const lab = colorToOkLab(color);
  if (!lab) return null;
  const { L, h } = okLabToOkLch(lab);
  const { lightMax, lightMin } = COLOR_WINDOW;
  return { u: h / 360, v: clampUnit((lightMax - L) / (lightMax - lightMin)) };
}

let cellCache: WindowCell[] | null = null;

/** Every raster cell, row-major from the top-left, built once per process. */
export function windowCells(): readonly WindowCell[] {
  if (cellCache) return cellCache;
  const { columns, rows } = COLOR_WINDOW;
  const cells: WindowCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = { u: (column + 0.5) / columns, v: (row + 0.5) / rows };
      cells.push({ ...point, ...windowColorAt(point), column, row });
    }
  }
  cellCache = cells;
  return cells;
}

/** The index (into windowCells) of the cell containing a point. */
export function cellIndexAt(point: WindowPoint): number {
  const { columns, rows } = COLOR_WINDOW;
  const column = Math.min(columns - 1, Math.floor(wrapUnit(point.u) * columns));
  const row = Math.min(rows - 1, Math.floor(clampUnit(point.v) * rows));
  return row * columns + column;
}

/**
 * The window's size in ΔE units at the target chroma: a hue step of Δh radians
 * is about C·Δh, a lightness step ΔL is ΔL. Width ≈ 2πC, height = the band.
 * The picker draws at this aspect so window distance ≈ perceptual distance.
 */
export function windowSize(): { width: number; height: number } {
  const { chroma, lightMax, lightMin } = COLOR_WINDOW;
  return { width: 2 * Math.PI * chroma, height: lightMax - lightMin };
}

/** Distance between two window points in ΔE-scaled units, hue wrapping. */
export function windowDistance(first: WindowPoint, second: WindowPoint): number {
  const { width, height } = windowSize();
  const across = Math.abs(wrapUnit(first.u) - wrapUnit(second.u));
  const du = Math.min(across, 1 - across);
  return Math.hypot(du * width, (first.v - second.v) * height);
}
