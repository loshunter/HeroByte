// ============================================================================
// PLANK — boards end to end (C5a)
// ============================================================================
// Boards by the repeat rule, each a bevelled block with wavy grain lines (the
// crack role is the grain's colour), maybe a knot, and up to two nails at
// each end. End gaps show the band's dark base. Fixed draws per board.

import type { Facet } from "../bandSpace.js";
import { bandQuad } from "../bandSpace.js";
import {
  bevelledBlock,
  dome,
  draws,
  motifCount,
  num,
  splitLength,
  stroke,
  type FrameGenerator,
} from "./common.js";

const DRAWS_PER_PLANK = 12;
const GRAIN_LINES = [0.3, 0.5, 0.72];
const GRAIN_STEPS = 10;

export const plank: FrameGenerator = ({
  length,
  courses,
  courseScale,
  params,
  rng,
  maxMotifs,
  bandPx,
}) => {
  const plankLength = num(params, "plankLength");
  const gap = num(params, "gap");
  const nails = num(params, "nails");
  const knotDensity = num(params, "knotDensity");
  const waviness = num(params, "grainWaviness");

  // The base (mortar, end gaps, seams): one polygon round the band, no joints.
  const facets: Facet[] = [{ role: "outline", points: bandQuad(0, length, 0, 1) }];
  const [phaseRoll] = draws(rng, 1);
  for (let course = 0; course < courses; course += 1) {
    const scale = courseScale(course);
    const heightU = 1 / courses / scale;
    const heightV = 1 / courses;
    const count = motifCount(length * scale * courses, plankLength, maxMotifs);
    const lengths = splitLength(length, count, 0.15, draws(rng, count));
    let u = phaseRoll! * (length / count) + (course % 2) * (lengths[0]! / 2);
    const v0 = course * heightV;
    for (let board = 0; board < count; board += 1) {
      const d = draws(rng, DRAWS_PER_PLANK);
      const start = u + (gap / 2) * heightU;
      const end = u + lengths[board]! - (gap / 2) * heightU;
      u += lengths[board]!;
      const top = v0 + 0.04 * heightV;
      const bottom = v0 + 0.96 * heightV;
      const shape = [start, top, end, top, end, bottom, start, bottom];
      facets.push(
        ...bevelledBlock(
          shape,
          [0.03 * heightU, 0.03 * heightV],
          [0.08 * heightU, 0.1 * heightV],
          34,
        ),
      );
      // Grain: wavy lines along the board, phase from the board's own draw.
      // Grain, knots and nails only where they would be a pixel or more.
      const px = bandPx * heightV;
      for (const line of px >= 10 ? GRAIN_LINES : []) {
        const path: number[] = [];
        for (let step = 0; step <= GRAIN_STEPS; step += 1) {
          const t = step / GRAIN_STEPS;
          const wave = Math.sin(t * 7 + d[0]! * 6.28) * 0.05 * waviness;
          path.push(
            start + 0.12 * heightU + t * (end - start - 0.24 * heightU),
            v0 + (line + wave) * heightV,
          );
        }
        facets.push(...stroke(path, 0.028 * heightV, "crack", 0.7));
      }
      if (d[1]! < knotDensity && px * 0.09 >= 1) {
        const knotU = start + (end - start) * (0.3 + 0.4 * d[2]!);
        const knotV = v0 + (0.35 + 0.3 * d[3]!) * heightV;
        facets.push(
          ...dome(knotU, knotV, 0.09 * heightV, 1 / scale).map((facet) => ({
            ...facet,
            role: facet.role === "top" ? ("crack" as const) : facet.role,
          })),
        );
      }
      for (let nail = 0; nail < (px * 0.05 >= 1 ? nails : 0); nail += 1) {
        const v = v0 + (nails === 1 ? 0.5 : nail === 0 ? 0.3 : 0.7) * heightV;
        for (const at of [start + 0.22 * heightU, end - 0.22 * heightU]) {
          facets.push(...dome(at, v, 0.05 * heightV, 1 / scale));
        }
      }
    }
  }
  return facets;
};
