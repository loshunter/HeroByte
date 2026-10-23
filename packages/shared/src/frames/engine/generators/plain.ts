// ============================================================================
// PLAIN — one smooth band (C5a)
// ============================================================================
// The colour ring, and the raised rims of a welded strip. The band itself is
// one flat top; its rounded or chamfered edges are the
// band's bevel profile, which the bake adds to every band (bandEdges.ts).
// `grain` lays faint brushed streaks along it. Plain draws nothing from the
// token's seed (the streaks come from a fixed stream), so every plain ring of
// one colour shares one bake.

import { createSeededRng } from "../../../rng.js";
import type { Facet } from "../bandSpace.js";
import { bandQuad } from "../bandSpace.js";
import { draws, num, sideOf, stroke, type FrameGenerator } from "./common.js";

const GRAIN_SEED = 0x5eed;

export const plain: FrameGenerator = ({ length, params, bandPx, corners }) => {
  // One polygon round the whole band (its two seam edges coincide and cancel),
  // so the flat top has no joints for the background to show through.
  const facets: Facet[] = [{ role: "top", points: bandQuad(0, length, 0, 1) }];
  const grain = num(params, "grain");
  if (grain > 0 && bandPx >= 6) {
    const rng = createSeededRng(GRAIN_SEED);
    const streaks = Math.min(512, Math.round(length * 3 * grain));
    for (let index = 0; index < streaks; index += 1) {
      const [start, span, across, light] = draws(rng, 4);
      const u0 = start! * length;
      let u1 = u0 + (0.6 + span! * 2.4);
      // On a polygon a streak ends at its side's corner (its draws are taken all the same).
      if (corners && corners.length > 0) u1 = Math.min(u1, sideOf(corners, length, u0)[1]);
      if (u1 - u0 < 0.3) continue;
      const v = 0.18 + across! * 0.64;
      facets.push(
        ...stroke([u0, v, (u0 + u1) / 2, v, u1, v], 0.035, light! < 0.5 ? "bevel" : "side", 0.35),
      );
    }
  }
  return facets;
};
