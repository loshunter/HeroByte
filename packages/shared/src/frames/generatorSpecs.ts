// ============================================================================
// FRAME GENERATORS — the knobs each one takes (C5a)
// ============================================================================
// Data only, so the server can validate a frame without loading the engine:
// every param a generator reads is listed here with its range and default,
// and anything not listed is dropped. Lengths are in BAND HEIGHTS (a stone
// 1.6 long is 1.6 times as long as its band is thick), so a motif keeps its
// proportions at every weight.

import type { FrameBevelProfile, FrameParamValue } from "./types.js";

export type FrameParamSpec =
  | { kind: "number"; min: number; max: number; default: number; integer?: boolean }
  | { kind: "enum"; values: readonly string[]; default: string }
  | { kind: "boolean"; default: boolean };

export interface FrameGeneratorSpec {
  id: string;
  params: Readonly<Record<string, FrameParamSpec>>;
  /** Whether it draws from the seeded stream (a plain band does not, so all plain rings share a bake). */
  seeded: boolean;
  /** The band edge profile it gets when the band names none. */
  bevel: { profile: FrameBevelProfile; width: number };
}

export const FRAME_GENERATOR_SPECS: Readonly<Record<string, FrameGeneratorSpec>> = {
  plain: {
    id: "plain",
    params: {
      // Fine brushed streaks along the band (steel), 0 = none.
      grain: { kind: "number", min: 0, max: 1, default: 0 },
    },
    seeded: false,
    bevel: { profile: "round", width: 0.3 },
  },
  masonry: {
    id: "masonry",
    params: {
      bond: { kind: "enum", values: ["running", "stack", "rubble", "cobble"], default: "running" },
      stoneLength: { kind: "number", min: 0.6, max: 4, default: 1.5 },
      gap: { kind: "number", min: 0, max: 0.2, default: 0.06 },
      inset: { kind: "number", min: 0.04, max: 0.3, default: 0.14 },
      irregularity: { kind: "number", min: 0, max: 1, default: 0.3 },
      chamfer: { kind: "number", min: 0, max: 1, default: 0.5 },
      crackDensity: { kind: "number", min: 0, max: 1, default: 0 },
    },
    seeded: true,
    bevel: { profile: "flat", width: 0 },
  },
  plank: {
    id: "plank",
    params: {
      plankLength: { kind: "number", min: 1, max: 8, default: 2.4 },
      gap: { kind: "number", min: 0, max: 0.15, default: 0.05 },
      nails: { kind: "number", min: 0, max: 2, default: 2, integer: true },
      knotDensity: { kind: "number", min: 0, max: 1, default: 0.35 },
      grainWaviness: { kind: "number", min: 0, max: 1, default: 0.4 },
    },
    seeded: true,
    bevel: { profile: "flat", width: 0 },
  },
  plate: {
    id: "plate",
    params: {
      plateLength: { kind: "number", min: 1, max: 8, default: 2.6 },
      rivetRows: { kind: "number", min: 0, max: 3, default: 1, integer: true },
      rivetSize: { kind: "number", min: 0.05, max: 0.3, default: 0.12 },
      seamWidth: { kind: "number", min: 0.01, max: 0.15, default: 0.04 },
      weld: { kind: "boolean", default: false },
      irregularity: { kind: "number", min: 0, max: 1, default: 0 },
    },
    seeded: true,
    bevel: { profile: "chamfer", width: 0.12 },
  },
};

/** A param value clamped to its spec, the spec's default when it is missing or unreadable. */
export function clampFrameParam(spec: FrameParamSpec, value: unknown): FrameParamValue {
  if (spec.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return spec.default;
    const clamped = Math.min(spec.max, Math.max(spec.min, value));
    return spec.integer ? Math.round(clamped) : clamped;
  }
  if (spec.kind === "enum") {
    return typeof value === "string" && spec.values.includes(value) ? value : spec.default;
  }
  return typeof value === "boolean" ? value : spec.default;
}

/** Every param the generator reads, filled from `params` (clamped) or its default. */
export function resolveFrameParams(
  generator: string,
  params: Record<string, unknown> | undefined,
): Record<string, FrameParamValue> {
  const spec = FRAME_GENERATOR_SPECS[generator];
  const resolved: Record<string, FrameParamValue> = {};
  if (!spec) return resolved;
  for (const [name, paramSpec] of Object.entries(spec.params)) {
    resolved[name] = clampFrameParam(paramSpec, params?.[name]);
  }
  return resolved;
}
