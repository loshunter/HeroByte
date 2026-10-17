// ============================================================================
// FRAME PRESETS IN USE — picking, weighing, the default ring (C5a)
// ============================================================================
// Picking a preset COPIES its stack onto the token, so a later catalog change
// never restyles anyone's token behind their back. Every copy carries every
// param filled in (the server stores what it validated), and the weight
// slider scales every band in proportion.

import { FRAME_PRESETS } from "./frameCatalog.generated.js";
import { resolveFrameParams } from "./generatorSpecs.js";
import { FRAME_LIMITS, FRAME_WEIGHTS } from "./frameLimits.js";
import { roundTo } from "./frameValidation.js";
import type { FramePreset, TokenFrame } from "./types.js";

/** The preset every new token wears (owner decision, 2026-10-08). */
export const DEFAULT_FRAME_PRESET = "plain.ring";

export function findFramePreset(id: string | undefined): FramePreset | undefined {
  return id === undefined ? undefined : FRAME_PRESETS.find((preset) => preset.id === id);
}

/** The frame's total weight: the sum of its bands'. */
export function frameWeight(frame: TokenFrame): number {
  return frame.bands.reduce((sum, band) => sum + band.weight, 0);
}

/** The same stack at another total weight (clamped to the limits), every band in proportion. */
export function withFrameWeight(frame: TokenFrame, total: number): TokenFrame {
  const target = Math.min(FRAME_LIMITS.MAX_WEIGHT, Math.max(FRAME_LIMITS.MIN_WEIGHT, total));
  const current = frameWeight(frame) || target;
  return {
    ...frame,
    bands: frame.bands.map((band) => ({
      ...band,
      weight: Math.max(
        FRAME_LIMITS.MIN_BAND_WEIGHT,
        roundTo((band.weight * target) / current, 1e-4),
      ),
    })),
  };
}

/** A fresh copy of a preset's stack, every param filled, at a total weight. */
export function presetFrame(
  id: string,
  total: number = FRAME_WEIGHTS.regular,
): TokenFrame | undefined {
  const preset = findFramePreset(id);
  if (!preset) return undefined;
  const frame: TokenFrame = {
    ...preset.frame,
    bands: preset.frame.bands.map((band) => {
      const params = resolveFrameParams(band.generator, band.params);
      return { ...band, ...(Object.keys(params).length > 0 ? { params } : {}) };
    }),
  };
  return withFrameWeight(frame, total);
}

/** What a token created from now on wears: a plain ring in its own colour, regular weight. */
export function defaultTokenFrame(): TokenFrame {
  return presetFrame(DEFAULT_FRAME_PRESET)!;
}

/** Whether any band lights a glow (the Frame tab then offers the glow colour and strength). */
export function frameHasGlow(frame: TokenFrame): boolean {
  return frame.bands.some((band) => band.glow !== undefined);
}
