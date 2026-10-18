// ============================================================================
// FRAME BAKE KEY — when two tokens can share one bitmap (C5a)
// ============================================================================
// Everything the bake reads, in a fixed order: the stack with every param
// filled in, the growth, the size's weight scale, the tier, the accent only
// when some band takes it, and each band's seed only when its generator
// draws from one. So every plain ring of one colour, weight, growth and size
// class at one tier is one bake, while two castle rings (seeded by their
// token ids) are two.

import type { TokenSize } from "../../index.js";
import { framePaletteById } from "../catalogLookup.js";
import { frameSizeScale } from "../frameLimits.js";
import { frameGeneratorSpec, resolveFrameParams } from "../generatorSpecs.js";
import type { TokenFrame } from "../types.js";
import { bandSeed } from "./frameSeeds.js";

/**
 * The roles a band is drawn in without a glow. Glow and tint default to
 * "personal" in every palette, but a band only shows them when it has a glow
 * (whose own colour then decides), so they never make a frame take the accent.
 */
const DRAWN_ROLES = ["top", "bevel", "side", "outline", "crack", "shadow"] as const;

/** Whether any band's palette takes the frame's colour (the "Frame colour" row has an effect). */
export function frameUsesAccent(frame: TokenFrame): boolean {
  return frame.bands.some((band) => {
    const roles = framePaletteById(band.palette)?.roles;
    return roles !== undefined && DRAWN_ROLES.some((role) => roles[role] === "personal");
  });
}

/** Whether any band glows in the character's own colour. */
export function frameGlowsPersonal(frame: TokenFrame): boolean {
  return frame.bands.some((band) => band.glow?.color === "personal");
}

export function frameBakeKey(input: {
  frame: TokenFrame;
  size?: TokenSize;
  accent: string;
  personal?: string;
  seed: number;
  tier: number;
}): string {
  const { frame } = input;
  return JSON.stringify([
    frame.shape ?? "circle",
    frame.growth ?? "in",
    frameSizeScale(input.size),
    input.tier,
    frameUsesAccent(frame) ? input.accent : "",
    frameGlowsPersonal(frame) ? (input.personal ?? input.accent) : "",
    frame.bands.map((band, index) => [
      band.generator,
      band.palette,
      band.weight,
      band.depth,
      band.bevel ? [band.bevel.profile, band.bevel.width] : null,
      band.glow ? [band.glow.color, band.glow.strength] : null,
      Object.values(resolveFrameParams(band.generator, band.params)),
      frameGeneratorSpec(band.generator)?.seeded ? bandSeed(frame, index, input.seed) : 0,
    ]),
  ]);
}
