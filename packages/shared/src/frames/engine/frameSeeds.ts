// ============================================================================
// FRAME SEEDS — which stones a frame lays (C5a)
// ============================================================================
// Apart from the bake on purpose: the character file and the bake key need the
// seeds on the main thread up front, and importing them from frameBake.ts
// pulled the whole engine (raster, generators, edges) into the app's entry
// chunk, 12 KB gzipped past its budget.

import { frameGeneratorSpec } from "../generatorSpecs.js";
import type { TokenFrame } from "../types.js";

/** A token id into a 32-bit seed (FNV-1a): the same stones on every client. */
export function frameSeed(tokenId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < tokenId.length; index += 1) {
    hash ^= tokenId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** The seed band `index` actually uses. */
export function bandSeed(frame: TokenFrame, index: number, seed: number): number {
  return frame.bands[index]?.seed ?? (seed + Math.imul(index + 1, 0x9e3779b1)) | 0;
}

/**
 * The frame with each seeded band's seed written in, from the token it was
 * drawn on: carried to another token (an NPC placed again, a character file
 * loaded at another table) it lays the same stones, not new ones.
 */
export function pinFrameSeeds(frame: TokenFrame, tokenId: string): TokenFrame {
  const seed = frameSeed(tokenId);
  return {
    ...frame,
    bands: frame.bands.map((band, index) =>
      band.seed === undefined && frameGeneratorSpec(band.generator)?.seeded
        ? { ...band, seed: bandSeed(frame, index, seed) }
        : band,
    ),
  };
}
