// ============================================================================
// FRAME VALIDATION — the server's rule and the files' fallback (C5a)
// ============================================================================
// Two doors, two tempers. `sanitizeTokenFrame` is the wire's: a frame a client
// sends is checked against the catalog and refused whole, with a reason, when
// it names a shape, finish, generator, palette or preset this build does not
// have, more than six bands, or a total weight outside 0.04–0.34; numbers
// inside an otherwise good frame are clamped. `coerceTokenFrame` is the files':
// a character file or a table from a newer build must load, so an unknown
// generator or palette becomes plain stone per band and nothing is rejected.

import { FRAME_PALETTES, FRAME_PRESETS } from "./frameCatalog.generated.js";
import { FRAME_GENERATOR_SPECS, resolveFrameParams } from "./generatorSpecs.js";
import { FRAME_LIMITS } from "./frameLimits.js";
import type { FrameBand, FrameBevelProfile, FrameGrowth, TokenFrame } from "./types.js";

const HEX = /^#[0-9a-f]{6}$/;
const PROFILES: readonly FrameBevelProfile[] = ["round", "chamfer", "step", "flat"];
const GROWTHS: readonly FrameGrowth[] = ["in", "out", "mid"];
/** Totals are summed in floating point: a hair over the cap is the cap. */
const EPSILON = 1e-6;

export type FrameCheck = { frame: TokenFrame } | { error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isColor = (value: unknown): value is string =>
  typeof value === "string" && (value === "personal" || HEX.test(value));

export function isFramePreset(id: unknown): boolean {
  return typeof id === "string" && FRAME_PRESETS.some((preset) => preset.id === id);
}

/** The band's optional parts, clamped; the generator and palette are the caller's. */
function bandExtras(raw: Record<string, unknown>): Partial<FrameBand> {
  const extras: Partial<FrameBand> = {};
  if (isRecord(raw.bevel) && PROFILES.includes(raw.bevel.profile as FrameBevelProfile)) {
    const width = isFiniteNumber(raw.bevel.width) ? clamp(raw.bevel.width, 0, 0.5) : 0;
    extras.bevel = { profile: raw.bevel.profile as FrameBevelProfile, width };
  }
  if (isRecord(raw.glow) && isColor(raw.glow.color)) {
    const strength = isFiniteNumber(raw.glow.strength) ? clamp(raw.glow.strength, 0, 1) : 0.5;
    extras.glow = { color: raw.glow.color, strength };
  }
  if (isFiniteNumber(raw.seed)) extras.seed = Math.trunc(raw.seed) | 0;
  return extras;
}

function cleanBand(raw: Record<string, unknown>, generator: string, palette: string): FrameBand {
  const params = resolveFrameParams(generator, isRecord(raw.params) ? raw.params : undefined);
  return {
    generator,
    ...(Object.keys(params).length > 0 ? { params } : {}),
    palette,
    weight: raw.weight as number,
    depth: isFiniteNumber(raw.depth) ? clamp(raw.depth, 0, 1) : 0.6,
    ...bandExtras(raw),
  };
}

/** The wire's check: a clean copy of the frame, or the reason it is refused. */
export function sanitizeTokenFrame(raw: unknown): FrameCheck {
  if (!isRecord(raw)) return { error: "frame must be an object" };
  if (raw.shape !== undefined && raw.shape !== "circle") {
    return { error: "frame shape must be circle" };
  }
  if (raw.finish !== undefined && raw.finish !== "none") {
    return { error: "frame finishes are not available" };
  }
  if (raw.growth !== undefined && !GROWTHS.includes(raw.growth as FrameGrowth)) {
    return { error: "frame growth must be in, out or mid" };
  }
  if (raw.accent !== undefined && !isColor(raw.accent)) {
    return { error: 'frame accent must be #rrggbb or "personal"' };
  }
  if (raw.preset !== undefined && !isFramePreset(raw.preset)) {
    return { error: "frame preset is unknown" };
  }
  if (!Array.isArray(raw.bands) || raw.bands.length < 1) {
    return { error: "frame needs at least one band" };
  }
  if (raw.bands.length > FRAME_LIMITS.MAX_BANDS) {
    return { error: `frame has more than ${FRAME_LIMITS.MAX_BANDS} bands` };
  }
  const bands: FrameBand[] = [];
  for (const band of raw.bands) {
    if (!isRecord(band)) return { error: "frame band must be an object" };
    if (typeof band.generator !== "string" || !FRAME_GENERATOR_SPECS[band.generator]) {
      return { error: "frame band generator is unknown" };
    }
    if (typeof band.palette !== "string" || !FRAME_PALETTES[band.palette]) {
      return { error: "frame band palette is unknown" };
    }
    if (!isFiniteNumber(band.weight) || band.weight <= 0) {
      return { error: "frame band weight must be a positive number" };
    }
    bands.push(cleanBand(band, band.generator, band.palette));
  }
  const total = bands.reduce((sum, band) => sum + band.weight, 0);
  if (total < FRAME_LIMITS.MIN_WEIGHT - EPSILON || total > FRAME_LIMITS.MAX_WEIGHT + EPSILON) {
    return {
      error: `frame weight must be ${FRAME_LIMITS.MIN_WEIGHT}–${FRAME_LIMITS.MAX_WEIGHT}`,
    };
  }
  return {
    frame: {
      ...(raw.preset !== undefined ? { preset: raw.preset as string } : {}),
      ...(raw.shape !== undefined ? { shape: "circle" as const } : {}),
      ...(raw.growth !== undefined ? { growth: raw.growth as FrameGrowth } : {}),
      accent: (raw.accent as string | undefined) ?? "personal",
      bands,
    },
  };
}

/**
 * A file's frame, loaded whatever it holds: a missing or bandless frame is
 * none; an unknown generator or palette (a newer build's) is plain grey stone
 * in that band; extra bands are dropped; the total is brought into range by
 * scaling every band; an unknown preset, shape or finish is forgotten.
 */
export function coerceTokenFrame(raw: unknown): TokenFrame | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.bands)) return undefined;
  const bands: FrameBand[] = [];
  for (const band of raw.bands.slice(0, FRAME_LIMITS.MAX_BANDS)) {
    if (!isRecord(band)) continue;
    const known =
      typeof band.generator === "string" &&
      Boolean(FRAME_GENERATOR_SPECS[band.generator]) &&
      typeof band.palette === "string" &&
      Boolean(FRAME_PALETTES[band.palette]);
    const weight = isFiniteNumber(band.weight) && band.weight > 0 ? band.weight : 0.1;
    bands.push(
      known
        ? cleanBand({ ...band, weight }, band.generator as string, band.palette as string)
        : cleanBand({ ...band, weight, params: undefined }, "plain", "stone.grey"),
    );
  }
  if (bands.length === 0) return undefined;
  const total = bands.reduce((sum, band) => sum + band.weight, 0);
  const target = clamp(total, FRAME_LIMITS.MIN_WEIGHT, FRAME_LIMITS.MAX_WEIGHT);
  if (target !== total) {
    for (const band of bands) band.weight = (band.weight * target) / total;
  }
  return {
    ...(isFramePreset(raw.preset) ? { preset: raw.preset as string } : {}),
    ...(raw.shape === "circle" ? { shape: "circle" as const } : {}),
    ...(GROWTHS.includes(raw.growth as FrameGrowth) ? { growth: raw.growth as FrameGrowth } : {}),
    accent: isColor(raw.accent) ? raw.accent : "personal",
    bands,
  };
}

/**
 * Every token's frame through the files' door (table state off disk or out
 * of a backup): a frame that cannot be read is dropped, the token kept.
 */
export function coerceTokenFrames<T extends { frame?: TokenFrame }>(tokens: readonly T[]): T[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.map((token) => {
    if (token?.frame === undefined) return token;
    const frame = coerceTokenFrame(token.frame);
    const next = { ...token };
    if (frame) next.frame = frame;
    else delete next.frame;
    return next;
  });
}
