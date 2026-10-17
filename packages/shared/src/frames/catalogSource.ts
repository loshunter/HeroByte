// ============================================================================
// FRAME CATALOG SOURCE — the build script's checks (C5a)
// ============================================================================
// scripts/build-frame-catalog.mjs reads every palette and preset JSON under
// packages/shared/src/frames/ and hands them here. Anything wrong is refused
// with a reason that names the file's id and the field, and nothing is
// written: a palette missing a role, a colour that is not #rrggbb or
// "personal", a preset over the weight cap, an unknown generator, palette or
// param, or a param outside its range. Presets list each band's SHARE of the
// frame; the catalog stores them at regular weight.

import { frameGeneratorSpec, resolveFrameParams, type FrameParamSpec } from "./generatorSpecs.js";
import { sanitizeTokenFrame } from "./frameValidation.js";
import { withFrameWeight } from "./frameDefaults.js";
import { FRAME_LIMITS, FRAME_WEIGHTS } from "./frameLimits.js";
import type {
  FrameBand,
  FrameBevelProfile,
  FrameGrowth,
  FramePalette,
  FramePreset,
  FramePresetTheme,
  FrameRole,
  FrameParamValue,
} from "./types.js";

export const FRAME_ROLES: readonly FrameRole[] = [
  "top",
  "bevel",
  "side",
  "outline",
  "crack",
  "glow",
  "tint",
  "shadow",
];
/** A palette must name these; glow and tint default to "personal". */
const REQUIRED_ROLES: readonly FrameRole[] = ["top", "bevel", "side", "outline", "crack", "shadow"];
const THEMES: readonly FramePresetTheme[] = ["plain", "stone", "metal", "wood"];
const PROFILES: readonly FrameBevelProfile[] = ["round", "chamfer", "step", "flat"];
const GROWTHS: readonly FrameGrowth[] = ["in", "out", "mid"];
const HEX = /^#[0-9a-f]{6}$/;
const ID = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)*$/;

export interface FrameCatalog {
  palettes: Record<string, FramePalette>;
  presets: FramePreset[];
}

export interface FrameCatalogResult extends FrameCatalog {
  errors: string[];
}

const hasOwn = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isUnit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function checkPalette(raw: unknown, errors: string[]): FramePalette | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !ID.test(raw.id)) {
    errors.push(
      `palette ${JSON.stringify(isRecord(raw) ? raw.id : raw)}: id must be like "stone.grey"`,
    );
    return null;
  }
  const where = `palette ${raw.id}`;
  const before = errors.length;
  if (typeof raw.name !== "string" || raw.name.length === 0) errors.push(`${where}: name missing`);
  const roles: Partial<Record<FrameRole, string>> = {};
  if (!isRecord(raw.roles)) {
    errors.push(`${where}: roles missing`);
  } else {
    for (const role of Object.keys(raw.roles)) {
      if (!FRAME_ROLES.includes(role as FrameRole)) errors.push(`${where}: unknown role "${role}"`);
    }
    for (const role of FRAME_ROLES) {
      const value = raw.roles[role];
      if (value === undefined) {
        if (REQUIRED_ROLES.includes(role)) errors.push(`${where}: role "${role}" missing`);
        else roles[role] = "personal";
      } else if (typeof value !== "string" || (value !== "personal" && !HEX.test(value))) {
        errors.push(`${where}: role "${role}" must be #rrggbb or "personal"`);
      } else {
        roles[role] = value;
      }
    }
  }
  if (!isUnit(raw.specular)) errors.push(`${where}: specular must be 0–1`);
  if (!isUnit(raw.gloss)) errors.push(`${where}: gloss must be 0–1`);
  if (errors.length > before) return null;
  return {
    id: raw.id,
    name: raw.name as string,
    roles: roles as Record<FrameRole, string>,
    specular: raw.specular as number,
    gloss: raw.gloss as number,
  };
}

function checkParam(spec: FrameParamSpec, value: unknown): boolean {
  if (spec.kind === "number") {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= spec.min &&
      value <= spec.max &&
      (!spec.integer || Number.isInteger(value))
    );
  }
  if (spec.kind === "enum") return typeof value === "string" && spec.values.includes(value);
  return typeof value === "boolean";
}

function checkBand(
  raw: unknown,
  where: string,
  palettes: Record<string, FramePalette>,
  errors: string[],
): (FrameBand & { share: number }) | null {
  if (!isRecord(raw)) {
    errors.push(`${where}: not an object`);
    return null;
  }
  const before = errors.length;
  const spec = frameGeneratorSpec(raw.generator);
  if (!spec) errors.push(`${where}: unknown generator ${JSON.stringify(raw.generator)}`);
  if (typeof raw.palette !== "string" || !hasOwn(palettes, raw.palette)) {
    errors.push(`${where}: unknown palette ${JSON.stringify(raw.palette)}`);
  }
  if (typeof raw.share !== "number" || !(raw.share > 0) || raw.share > 1) {
    errors.push(`${where}: share must be above 0 and at most 1`);
  }
  if (!isUnit(raw.depth)) errors.push(`${where}: depth must be 0–1`);
  const params: Record<string, FrameParamValue> = {};
  if (raw.params !== undefined) {
    if (!isRecord(raw.params)) {
      errors.push(`${where}: params must be an object`);
    } else if (spec) {
      for (const [name, value] of Object.entries(raw.params)) {
        const paramSpec = hasOwn(spec.params, name) ? spec.params[name] : undefined;
        if (!paramSpec) errors.push(`${where}: ${spec.id} has no param "${name}"`);
        else if (!checkParam(paramSpec, value))
          errors.push(`${where}: param "${name}" out of range`);
        else params[name] = value as FrameParamValue;
      }
    }
  }
  let bevel: FrameBand["bevel"];
  if (raw.bevel !== undefined) {
    const profile = isRecord(raw.bevel) ? raw.bevel.profile : undefined;
    const width = isRecord(raw.bevel) ? raw.bevel.width : undefined;
    if (!PROFILES.includes(profile as FrameBevelProfile) || !isUnit(width) || width > 0.5) {
      errors.push(`${where}: bevel must be { profile: round|chamfer|step|flat, width: 0–0.5 }`);
    } else {
      bevel = { profile: profile as FrameBevelProfile, width };
    }
  }
  let glow: FrameBand["glow"];
  if (raw.glow !== undefined) {
    const color = isRecord(raw.glow) ? raw.glow.color : undefined;
    const strength = isRecord(raw.glow) ? raw.glow.strength : undefined;
    if (
      typeof color !== "string" ||
      (color !== "personal" && !HEX.test(color)) ||
      !isUnit(strength)
    ) {
      errors.push(`${where}: glow must be { color: #rrggbb|personal, strength: 0–1 }`);
    } else {
      glow = { color, strength };
    }
  }
  if (errors.length > before) return null;
  return {
    generator: raw.generator as string,
    ...(Object.keys(params).length > 0 ? { params } : {}),
    palette: raw.palette as string,
    weight: 0,
    depth: raw.depth as number,
    ...(bevel ? { bevel } : {}),
    ...(glow ? { glow } : {}),
    share: raw.share as number,
  };
}

function checkPreset(
  raw: unknown,
  palettes: Record<string, FramePalette>,
  errors: string[],
): FramePreset | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !ID.test(raw.id)) {
    errors.push(
      `preset ${JSON.stringify(isRecord(raw) ? raw.id : raw)}: id must be like "stone.castle"`,
    );
    return null;
  }
  const where = `preset ${raw.id}`;
  const before = errors.length;
  if (typeof raw.name !== "string" || raw.name.length === 0) errors.push(`${where}: name missing`);
  if (!THEMES.includes(raw.theme as FramePresetTheme)) {
    errors.push(`${where}: theme must be one of ${THEMES.join(", ")}`);
  }
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [];
  const weight = raw.weight ?? FRAME_WEIGHTS.regular;
  if (typeof weight !== "number" || weight > FRAME_LIMITS.MAX_WEIGHT) {
    errors.push(`${where}: weight over the cap of ${FRAME_LIMITS.MAX_WEIGHT}`);
  } else if (weight < FRAME_LIMITS.MIN_WEIGHT) {
    errors.push(`${where}: weight under the floor of ${FRAME_LIMITS.MIN_WEIGHT}`);
  }
  if (raw.growth !== undefined && !GROWTHS.includes(raw.growth as FrameGrowth)) {
    errors.push(`${where}: growth must be in, out or mid`);
  }
  const bands: (FrameBand & { share: number })[] = [];
  if (!Array.isArray(raw.bands) || raw.bands.length < 1) {
    errors.push(`${where}: needs 1–${FRAME_LIMITS.MAX_BANDS} bands`);
  } else if (raw.bands.length > FRAME_LIMITS.MAX_BANDS) {
    errors.push(`${where}: ${raw.bands.length} bands, at most ${FRAME_LIMITS.MAX_BANDS}`);
  } else {
    raw.bands.forEach((band, index) => {
      const checked = checkBand(band, `${where} band ${index + 1}`, palettes, errors);
      if (checked) bands.push(checked);
    });
    const thinnest = Math.min(...bands.map((band) => band.share)) * FRAME_LIMITS.MIN_WEIGHT;
    if (bands.length > 0 && thinnest < FRAME_LIMITS.MIN_BAND_WEIGHT) {
      errors.push(
        `${where}: its thinnest band is under ${FRAME_LIMITS.MIN_BAND_WEIGHT} at the weight slider's floor`,
      );
    }
    const shares = bands.reduce((sum, band) => sum + band.share, 0);
    if (bands.length === raw.bands.length && Math.abs(shares - 1) > 1e-6) {
      errors.push(`${where}: band shares sum to ${shares.toFixed(3)}, not 1`);
    }
  }
  if (errors.length > before) return null;
  const total = weight as number;
  return {
    id: raw.id,
    name: raw.name as string,
    theme: raw.theme as FramePresetTheme,
    tags: tags as string[],
    frame: {
      preset: raw.id,
      ...(raw.growth ? { growth: raw.growth as FrameGrowth } : {}),
      accent: "personal",
      bands: bands.map(({ share, ...band }) => ({
        ...band,
        weight: Math.round(share * total * 1e6) / 1e6,
      })),
    },
  };
}

/** Validates the raw palette and preset files; `errors` empty means the catalog is good. */
export function buildFrameCatalogSource(
  rawPalettes: readonly unknown[],
  rawPresets: readonly unknown[],
): FrameCatalogResult {
  const errors: string[] = [];
  const palettes: Record<string, FramePalette> = {};
  for (const raw of rawPalettes) {
    const palette = checkPalette(raw, errors);
    if (!palette) continue;
    if (hasOwn(palettes, palette.id)) errors.push(`palette ${palette.id}: listed twice`);
    palettes[palette.id] = palette;
  }
  const presets: FramePreset[] = [];
  for (const raw of rawPresets) {
    const preset = checkPreset(raw, palettes, errors);
    if (!preset) continue;
    if (presets.some((existing) => existing.id === preset.id)) {
      errors.push(`preset ${preset.id}: listed twice`);
    }
    presets.push(preset);
  }
  if (!hasOwn(palettes, "stone.grey"))
    errors.push(`palette stone.grey: required (the fallback material)`);
  if (!presets.some((preset) => preset.id === "plain.ring")) {
    errors.push(`preset plain.ring: required (every new token wears it)`);
  }
  // Every preset must pass the wire's own check at both ends of the weight slider.
  for (const preset of presets) {
    for (const weight of [FRAME_LIMITS.MIN_WEIGHT, FRAME_LIMITS.MAX_WEIGHT]) {
      const scaled = withFrameWeight(
        {
          ...preset.frame,
          bands: preset.frame.bands.map((band) => ({
            ...band,
            ...(Object.keys(resolveFrameParams(band.generator, band.params)).length > 0
              ? { params: resolveFrameParams(band.generator, band.params) }
              : {}),
          })),
        },
        weight,
      );
      // Its id is not in the shipped catalog yet: checked without it.
      const checked = sanitizeTokenFrame({ ...scaled, preset: undefined }, palettes);
      if ("error" in checked)
        errors.push(`preset ${preset.id}: at weight ${weight}, ${checked.error}`);
    }
  }
  // The shelf's order: by theme, the default first within its theme, then as listed.
  const rank = (preset: FramePreset) =>
    THEMES.indexOf(preset.theme) * 2 + (preset.tags.includes("default") ? 0 : 1);
  presets.sort((first, second) => rank(first) - rank(second));
  return { palettes, presets, errors };
}
