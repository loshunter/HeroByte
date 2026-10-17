// ============================================================================
// FRAME VALIDATION — the server's rule and the files' fallback (C5a)
// ============================================================================
// Two doors, two tempers. `sanitizeTokenFrame` is the wire's: a frame a client
// sends is checked against the catalog and refused whole, with a reason, when
// it names a shape, finish, generator, palette or preset this build does not
// have, more than six bands, a band thinner than 0.005, a total weight outside
// 0.04–0.34 or more than 2.25 KB of JSON; numbers inside an otherwise good
// frame are clamped and rounded (they ride every token in every snapshot).
// `coerceTokenFrame` is the files': a character file or a table from a newer
// build must load, so an unknown generator or palette becomes plain stone per
// band, a band too thin is thickened, and nothing is rejected. A frame the
// wire stored comes back through it exactly as it was saved.

import { FRAME_PRESETS } from "./frameCatalog.generated.js";
import { framePaletteById } from "./catalogLookup.js";
import { frameGeneratorSpec, resolveFrameParams } from "./generatorSpecs.js";
/** What pinning a seeded band's seed adds to its JSON, at most (`,"seed":-2147483648`). */
const PINNED_SEED_BYTES = 19;
import { FRAME_LIMITS } from "./frameLimits.js";
import type {
  FrameBand,
  FrameBevelProfile,
  FrameGrowth,
  FramePalette,
  TokenFrame,
} from "./types.js";

const HEX = /^#[0-9a-f]{6}$/;
const PROFILES: readonly FrameBevelProfile[] = ["round", "chamfer", "step", "flat"];
const GROWTHS: readonly FrameGrowth[] = ["in", "out", "mid"];
/** Weights are rounded to 1e-4 each, so six bands' total may stray by 3e-4. */
export const FRAME_WEIGHT_TOLERANCE = 5e-4;

export type FrameCheck = { frame: TokenFrame } | { error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isColor = (value: unknown): value is string =>
  typeof value === "string" && (value === "personal" || HEX.test(value));
/** `value` to the nearest `step`, without float tails (0.1 + 0.2 stays 0.3). */
export const roundTo = (value: number, step: number): number =>
  Number((Math.round(value / step) * step).toFixed(Math.max(0, Math.ceil(-Math.log10(step)))));
const knownGenerator = (id: unknown) => frameGeneratorSpec(id) !== undefined;
const knownPalette = (id: unknown, palettes?: Readonly<Record<string, FramePalette>>) =>
  framePaletteById(id, palettes) !== undefined;

export function isFramePreset(id: unknown): boolean {
  return typeof id === "string" && FRAME_PRESETS.some((preset) => preset.id === id);
}

/** The band's optional parts, clamped and rounded; generator and palette are the caller's. */
function bandExtras(raw: Record<string, unknown>): Partial<FrameBand> {
  const extras: Partial<FrameBand> = {};
  if (isRecord(raw.bevel) && PROFILES.includes(raw.bevel.profile as FrameBevelProfile)) {
    const width = isFiniteNumber(raw.bevel.width) ? clamp(raw.bevel.width, 0, 0.5) : 0;
    extras.bevel = { profile: raw.bevel.profile as FrameBevelProfile, width: roundTo(width, 0.01) };
  }
  if (isRecord(raw.glow) && isColor(raw.glow.color)) {
    const strength = isFiniteNumber(raw.glow.strength) ? clamp(raw.glow.strength, 0, 1) : 0.5;
    extras.glow = { color: raw.glow.color, strength: roundTo(strength, 0.01) };
  }
  if (isFiniteNumber(raw.seed)) extras.seed = Math.trunc(raw.seed) | 0;
  return extras;
}

function cleanBand(
  raw: Record<string, unknown>,
  generator: string,
  palette: string,
  weight: number,
): FrameBand {
  const params = resolveFrameParams(generator, isRecord(raw.params) ? raw.params : undefined);
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "number") params[name] = roundTo(value, 0.001);
  }
  return {
    generator,
    ...(Object.keys(params).length > 0 ? { params } : {}),
    palette,
    weight: roundTo(weight, 1e-4),
    depth: isFiniteNumber(raw.depth) ? roundTo(clamp(raw.depth, 0, 1), 0.001) : 0.6,
    ...bandExtras(raw),
  };
}

const totalOf = (bands: readonly FrameBand[]) => bands.reduce((sum, band) => sum + band.weight, 0);

/** The wire's check: a clean copy of the frame, or the reason it is refused. */
export function sanitizeTokenFrame(
  raw: unknown,
  /** The build script's freshly checked palettes; the shipped catalog otherwise. */
  palettes?: Readonly<Record<string, FramePalette>>,
): FrameCheck {
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
    if (!knownGenerator(band.generator)) return { error: "frame band generator is unknown" };
    if (!knownPalette(band.palette, palettes)) return { error: "frame band palette is unknown" };
    if (!isFiniteNumber(band.weight) || band.weight <= 0) {
      return { error: "frame band weight must be a positive number" };
    }
    if (band.weight < FRAME_LIMITS.MIN_BAND_WEIGHT - FRAME_WEIGHT_TOLERANCE / 10) {
      return { error: `frame band weight must be at least ${FRAME_LIMITS.MIN_BAND_WEIGHT}` };
    }
    bands.push(cleanBand(band, band.generator as string, band.palette as string, band.weight));
  }
  const total = totalOf(bands);
  if (
    total < FRAME_LIMITS.MIN_WEIGHT - FRAME_WEIGHT_TOLERANCE ||
    total > FRAME_LIMITS.MAX_WEIGHT + FRAME_WEIGHT_TOLERANCE
  ) {
    return {
      error: `frame weight must be ${FRAME_LIMITS.MIN_WEIGHT}–${FRAME_LIMITS.MAX_WEIGHT}`,
    };
  }
  const frame: TokenFrame = {
    ...(raw.preset !== undefined ? { preset: raw.preset as string } : {}),
    ...(raw.shape !== undefined ? { shape: "circle" as const } : {}),
    ...(raw.growth !== undefined ? { growth: raw.growth as FrameGrowth } : {}),
    accent: (raw.accent as string | undefined) ?? "personal",
    bands,
  };
  // Counted as a carry would store it (pinFrameSeeds), so a frame the wire
  // takes never outgrows the cap on its way to a file or a re-placed NPC.
  const unpinned = bands.filter(
    (band) => band.seed === undefined && frameGeneratorSpec(band.generator)?.seeded,
  ).length;
  if (JSON.stringify(frame).length + unpinned * PINNED_SEED_BYTES > FRAME_LIMITS.MAX_FRAME_BYTES) {
    return { error: `frame is larger than ${FRAME_LIMITS.MAX_FRAME_BYTES} bytes` };
  }
  return { frame };
}

/**
 * Bands scaled so their total lands inside the limits: any band the scaling
 * would thin past the floor is held at it and the rest share what is left,
 * and the rounding's remainder goes to the widest band, so the total is exact.
 */
function scaleInto(bands: FrameBand[], total: number): void {
  const target = clamp(total, FRAME_LIMITS.MIN_WEIGHT, FRAME_LIMITS.MAX_WEIGHT);
  const floor = FRAME_LIMITS.MIN_BAND_WEIGHT;
  // Holding one band shrinks what the rest share, which can thin another past
  // the floor in turn: hold until no free band would fall under it.
  const held = new Set<FrameBand>();
  for (;;) {
    const room = target - held.size * floor;
    const free = bands.filter((band) => !held.has(band));
    const freeTotal = free.reduce((sum, band) => sum + band.weight, 0);
    const thin = free.filter((band) => (band.weight * room) / freeTotal < floor);
    if (thin.length === 0 || thin.length === free.length) {
      for (const band of held) band.weight = floor;
      for (const band of free) band.weight = roundTo((band.weight * room) / freeTotal, 1e-4);
      break;
    }
    for (const band of thin) held.add(band);
  }
  const widest = bands.reduce((best, band) => (band.weight > best.weight ? band : best));
  widest.weight = roundTo(widest.weight + target - totalOf(bands), 1e-4);
}

/**
 * A file's frame, loaded whatever it holds: a missing or bandless frame is
 * none; an unknown generator or palette (a newer build's) is plain grey stone
 * in that band; extra bands are dropped; a band too thin is thickened; a total
 * out of range is scaled into it; an unknown preset, shape or finish is
 * forgotten. A frame already in range is kept exactly (backups restore it).
 */
export function coerceTokenFrame(raw: unknown): TokenFrame | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.bands)) return undefined;
  const bands: FrameBand[] = [];
  for (const band of raw.bands.slice(0, FRAME_LIMITS.MAX_BANDS)) {
    if (!isRecord(band)) continue;
    const known = knownGenerator(band.generator) && knownPalette(band.palette);
    const weight = clamp(
      isFiniteNumber(band.weight) && band.weight > 0 ? band.weight : 0.1,
      FRAME_LIMITS.MIN_BAND_WEIGHT,
      1,
    );
    bands.push(
      known
        ? cleanBand(band, band.generator as string, band.palette as string, weight)
        : cleanBand({ ...band, params: undefined }, "plain", "stone.grey", weight),
    );
  }
  if (bands.length === 0) return undefined;
  const total = totalOf(bands);
  const low = FRAME_LIMITS.MIN_WEIGHT - FRAME_WEIGHT_TOLERANCE;
  const high = FRAME_LIMITS.MAX_WEIGHT + FRAME_WEIGHT_TOLERANCE;
  if (total < low || total > high) scaleInto(bands, total);
  const frame: TokenFrame = {
    ...(isFramePreset(raw.preset) ? { preset: raw.preset as string } : {}),
    ...(raw.shape === "circle" ? { shape: "circle" as const } : {}),
    ...(GROWTHS.includes(raw.growth as FrameGrowth) ? { growth: raw.growth as FrameGrowth } : {}),
    accent: isColor(raw.accent) ? raw.accent : "personal",
    bands,
  };
  // One the wire would refuse (six thin bands thickened past the cap) is no frame.
  return "frame" in sanitizeTokenFrame(frame) ? frame : undefined;
}

/**
 * Every token's frame through the files' door (table state off disk or out
 * of a backup, live or parked on another map): a frame that cannot be read
 * is dropped, the token kept.
 */
export function coerceTokenFrames<T extends { frame?: TokenFrame }>(tokens: readonly T[]): T[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.map((token) => {
    if (token?.frame === undefined) return token;
    const frame = coerceTokenFrame(token.frame);
    // Unchanged, the token itself comes back (a parked map with nothing to fix keeps its identity).
    if (frame && JSON.stringify(frame) === JSON.stringify(token.frame)) return token;
    const next = { ...token };
    if (frame) next.frame = frame;
    else delete next.frame;
    return next;
  });
}
