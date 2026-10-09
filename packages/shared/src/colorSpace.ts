// ============================================================================
// COLOUR SPACE — hex ↔ OKLab / OKLCH, perceptual distance, legacy parsing
// ============================================================================
// The personal-colour rule (docs/planning/personal-colour-arc-plan.md §3)
// measures "looks different" in OKLab, where straight-line distance tracks
// what people see far better than RGB or HSL do. Colours are STORED as
// `#rrggbb` (Konva and CSS both take it as is); older tables hold the token
// service's `hsl(h, 70%, 50%)` strings and character files can carry any
// string, so everything enters through parseColor.
//
// Matrices: Björn Ottosson's OKLab (2020), linear sRGB, D65.

/** Gamma-encoded sRGB, each channel 0..1 (may stray outside before clamping). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface OkLab {
  L: number;
  a: number;
  b: number;
}

/** Lightness 0..1, chroma ≥ 0, hue in degrees [0, 360). */
export interface OkLch {
  L: number;
  C: number;
  h: number;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

export function rgbToOkLab({ r, g, b }: Rgb): OkLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB WITHOUT clamping, so callers can test whether it is in gamut. */
export function okLabToRgb({ L, a, b }: OkLab): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function okLabToOkLch({ L, a, b }: OkLab): OkLch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function okLchToOkLab({ L, C, h }: OkLch): OkLab {
  const radians = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(radians), b: C * Math.sin(radians) };
}

/** Within sRGB, allowing a hair of float error at the edges. */
export function isInGamut({ r, g, b }: Rgb, epsilon = 1e-4): boolean {
  return [r, g, b].every((channel) => channel >= -epsilon && channel <= 1 + epsilon);
}

const toByte = (channel: number): number => Math.round(Math.min(1, Math.max(0, channel)) * 255);

/** Clamped and rounded to `#rrggbb`, lower case. */
export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => toByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

export function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number): number => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: channel(1 / 3), g: channel(0), b: channel(-1 / 3) };
}

const HEX_6 = /^#([0-9a-f]{6})$/i;
const HEX_3 = /^#([0-9a-f]{3})$/i;
// Each separator is ONE alternation, a comma (with optional spaces) or spaces,
// never `\s*[, ]\s*`, which backtracks super-linearly on long runs of spaces.
const HSL =
  /^hsla?\((-?\d+(?:\.\d+)?)(?:deg)?(?:\s*,\s*|\s+)(\d+(?:\.\d+)?)%(?:\s*,\s*|\s+)(\d+(?:\.\d+)?)%(?:\s*[,/]\s*[\d.]+%?)?\)$/i;
/** No colour HeroByte writes is longer; anything longer is junk, and is not parsed at all. */
const MAX_COLOR_LENGTH = 64;

/**
 * Any colour string HeroByte has ever stored, or null.
 *
 * Accepts `#rrggbb`, `#rgb` and `hsl(h, s%, l%)` (the token service's own
 * format before personal colours; `hsla`, `deg` and space-separated forms too,
 * since character files are hand-editable). Alpha is ignored: a token colour
 * is opaque. Anything else — named colours, `var(...)`, junk — is null, and
 * the caller decides what null means (the server reassigns).
 */
export function parseColor(input: string): Rgb | null {
  // Colours arrive from files and restored tables unchecked: a non-string or an
  // overlong one is junk, and must never reach a regex (or crash the rule).
  if (typeof input !== "string" || input.length > MAX_COLOR_LENGTH) return null;
  const text = input
    .trim()
    .replace(/^hsl(a?)\(\s+/i, "hsl$1(")
    .replace(/\s+\)$/, ")");
  const six = HEX_6.exec(text);
  if (six) {
    const value = parseInt(six[1]!, 16);
    return {
      r: ((value >> 16) & 255) / 255,
      g: ((value >> 8) & 255) / 255,
      b: (value & 255) / 255,
    };
  }
  const three = HEX_3.exec(text);
  if (three) {
    const [r, g, b] = three[1]!.split("").map((digit) => parseInt(digit + digit, 16) / 255);
    return { r: r!, g: g!, b: b! };
  }
  const hsl = HSL.exec(text);
  if (hsl) {
    return hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
  }
  return null;
}

/** The canonical stored form (`#rrggbb`, lower case), or null if unparseable. */
export function normalizeColor(input: string): string | null {
  const rgb = parseColor(input);
  return rgb ? rgbToHex(rgb) : null;
}

/** Exactly the stored format: `#rrggbb`. */
export function isHexColor(input: string): boolean {
  return HEX_6.test(input);
}

export function colorToOkLab(input: string): OkLab | null {
  const rgb = parseColor(input);
  return rgb ? rgbToOkLab(rgb) : null;
}

/** Perceptual distance (ΔE in OKLab units; about 0.02 is just noticeable). */
export function deltaE(first: OkLab, second: OkLab): number {
  return Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b);
}

/** WCAG relative luminance of a gamma-encoded colour. */
export function relativeLuminance(rgb: Rgb): number {
  const { r, g, b } = {
    r: srgbToLinear(Math.min(1, Math.max(0, rgb.r))),
    g: srgbToLinear(Math.min(1, Math.max(0, rgb.g))),
    b: srgbToLinear(Math.min(1, Math.max(0, rgb.b))),
  };
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21, order-independent. */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
