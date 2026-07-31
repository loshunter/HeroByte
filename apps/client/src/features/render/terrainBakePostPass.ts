// The bake's POST-PASS pipeline — everything applied over finished terrain art,
// in physical order: light first (it belongs to the scene), atmosphere second
// (it sits between the scene and the viewer). Split from
// proceduralTerrainSurface at its 350-LOC cap.
//
// Each stage is skipped when its knob is absent, so an unlit, haze-free map
// bakes bit-identically to the pre-lighting renderer — the parity rule every
// colour term in this renderer obeys.

import { applyBakeLighting, lightingActive, type BakeLighting } from "./terrainLighting";
import { applyAshHaze, hazeActive, type AshHaze } from "./terrainAshHaze";

export interface BakePostPasses {
  lighting?: BakeLighting;
  haze?: AshHaze;
}

/** True when at least one post-pass would change a pixel. */
export function postPassActive(passes: BakePostPasses): boolean {
  return lightingActive(passes.lighting) || hazeActive(passes.haze);
}

/**
 * Run the active post-passes over an RGBA buffer in place. `originX/Y` are the
 * buffer's world origin and `cellSize` the grid pitch, so both stages stay
 * world-locked and a re-bake of the same map is identical.
 */
export function applyBakePostPasses(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  cellSize: number,
  passes: BakePostPasses,
): void {
  // Bound to locals so the active-checks narrow (lightingActive is a plain
  // predicate, not a type guard).
  const { lighting, haze } = passes;
  if (lighting && lightingActive(lighting)) {
    applyBakeLighting(pixels, width, height, originX, originY, lighting);
  }
  if (hazeActive(haze)) {
    applyAshHaze(pixels, width, height, originX, originY, cellSize, haze);
  }
}
