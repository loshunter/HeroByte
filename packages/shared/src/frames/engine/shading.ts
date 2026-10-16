// ============================================================================
// FRAME LIGHTING AND PALETTES (C5a)
// ============================================================================
// Facets carry roles, not colours: the palette names each role's colour, and
// the one table light (FRAME_LIGHT, from the top-left) shades it by the
// facet's normal — Lambert, normalised so a flat top shows its palette colour
// exactly, plus the palette's white highlight. A "personal" role takes the
// frame's accent colour, shifted in OKLab by the role's own lightness and
// chroma offsets, so a near-black colour still has darker sides and a
// near-white one still has outlines; the lighting does the rest (dark colours
// read by their lit bevels and highlight, never by a fixed bright rim).

import {
  colorToOkLab,
  isInGamut,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  parseColor,
  type Rgb,
} from "../../colorSpace.js";
import { FRAME_LIGHT } from "../frameLimits.js";
import type { FramePalette, FrameRole } from "../types.js";

export type Vec3 = [number, number, number];

export interface ResolvedPalette {
  roles: Record<FrameRole, Rgb>;
  specular: number;
  /** The highlight's exponent: 4 (broad) to 64 (a glint). */
  exponent: number;
}

/** How a "personal" role sits against the accent: a lightness step and a chroma share. */
const PERSONAL_ROLE: Record<FrameRole, { dL: number; chroma: number }> = {
  top: { dL: 0, chroma: 1 },
  bevel: { dL: -0.05, chroma: 1 },
  side: { dL: -0.13, chroma: 0.85 },
  outline: { dL: -0.24, chroma: 0.6 },
  crack: { dL: -0.17, chroma: 0.7 },
  glow: { dL: 0.08, chroma: 1 },
  tint: { dL: 0, chroma: 1 },
  shadow: { dL: -1, chroma: 0 },
};
const L_FLOOR = 0.08;
const L_CEILING = 0.97;
/** The share of a facet's light that does not depend on its slope. */
export const AMBIENT = 0.4;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The accent stepped for a role, its chroma eased down until it fits sRGB. */
export function personalRoleColor(accent: string, role: FrameRole): Rgb {
  const lab = colorToOkLab(accent) ?? { L: 0.6, a: 0, b: 0 };
  const { L, C, h } = okLabToOkLch(lab);
  const step = PERSONAL_ROLE[role];
  const targetL = Math.min(L_CEILING, Math.max(L_FLOOR, L + step.dL));
  let chroma = C * step.chroma;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const rgb = okLabToRgb(okLchToOkLab({ L: targetL, C: chroma, h }));
    if (isInGamut(rgb)) return rgb;
    chroma *= 0.85;
  }
  return okLabToRgb(okLchToOkLab({ L: targetL, C: 0, h }));
}

export function resolvePalette(palette: FramePalette, accent: string): ResolvedPalette {
  const roles = {} as Record<FrameRole, Rgb>;
  for (const [role, value] of Object.entries(palette.roles) as [FrameRole, string][]) {
    roles[role] =
      value === "personal"
        ? personalRoleColor(accent, role)
        : (parseColor(value) ?? { r: 0, g: 0, b: 0 });
  }
  return { roles, specular: palette.specular, exponent: 4 + palette.gloss * 60 };
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const elevation = toRadians(FRAME_LIGHT.elevationDeg);
const azimuth = toRadians(FRAME_LIGHT.azimuthDeg);
/** Toward the light; screen x right, y DOWN, z out of the table. */
export const LIGHT: Vec3 = [
  Math.sin(azimuth) * Math.cos(elevation),
  -Math.cos(azimuth) * Math.cos(elevation),
  Math.sin(elevation),
];
const halfLength = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
/** Halfway between the light and the eye (straight above). */
const HALF: Vec3 = [LIGHT[0] / halfLength, LIGHT[1] / halfLength, (LIGHT[2] + 1) / halfLength];
export const UP: Vec3 = [0, 0, 1];

/** A facet sloping down along the screen direction (dx, dy) at `pitch` degrees from flat. */
export function slopeNormal(dx: number, dy: number, pitch: number): Vec3 {
  const length = Math.hypot(dx, dy);
  if (length === 0 || pitch <= 0) return UP;
  const angle = toRadians(Math.min(89, pitch));
  return [(dx / length) * Math.sin(angle), (dy / length) * Math.sin(angle), Math.cos(angle)];
}

const srgbToLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
const linearToSrgb = (channel: number) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

/** How bright a facet with this normal is, 1 = a flat top. */
export function diffuse(normal: Vec3): number {
  const lambert = Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]);
  return AMBIENT + ((1 - AMBIENT) * lambert) / LIGHT[2];
}

/** A role's colour under the light (sRGB 0–1). */
export function shade(base: Rgb, normal: Vec3, palette: ResolvedPalette, role: FrameRole): Rgb {
  const light = diffuse(normal);
  const facing = Math.max(0, normal[0] * HALF[0] + normal[1] * HALF[1] + normal[2] * HALF[2]);
  // Outlines are matte: a highlight on a seam reads as a gap in it.
  const sheen =
    (role === "outline" ? 0.25 : 1) * palette.specular * Math.pow(facing, palette.exponent);
  return {
    r: clamp01(linearToSrgb(srgbToLinear(base.r) * light + sheen)),
    g: clamp01(linearToSrgb(srgbToLinear(base.g) * light + sheen)),
    b: clamp01(linearToSrgb(srgbToLinear(base.b) * light + sheen)),
  };
}

/** Between two colours in linear light (a glow's strength over the crack it fills). */
export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const mix = (a: number, b: number) =>
    linearToSrgb(srgbToLinear(a) + (srgbToLinear(b) - srgbToLinear(a)) * clamp01(amount));
  return { r: mix(from.r, to.r), g: mix(from.g, to.g), b: mix(from.b, to.b) };
}
