// ============================================================================
// MASONRY — stones in courses (C5a)
// ============================================================================
// Castle ashlar, brick, cave rubble and cobble are all this. The count obeys
// the repeat rule (N = round(perimeter / (stoneLength × band)), per course),
// so stones keep their proportions at any weight and taper exactly as their
// radius says; a band too thick for its circle is laid in two courses
// (courseCount). Each stone is a dark outline, a ring of chamfer facets
// falling from its centre, an inset top, and maybe a crack (the crack role,
// which a band with a glow lights up). Mortar is the band's base.
//
// Every stone takes the same fixed number of draws whatever the params, so
// changing one knob never reshuffles the rest of the ring.

import type { Facet } from "../bandSpace.js";
import { bandQuad } from "../bandSpace.js";
import { bevelledBlock, draws, num, splitLength, stroke, type FrameGenerator } from "./common.js";

const DRAWS_PER_STONE = 20;

export const masonry: FrameGenerator = ({ length, courses, courseScale, params, rng }) => {
  const bond = params.bond as string;
  const stoneLength = num(params, "stoneLength");
  const gap = num(params, "gap");
  const inset = num(params, "inset");
  const irregularity = num(params, "irregularity");
  const chamfer = num(params, "chamfer");
  const crackDensity = num(params, "crackDensity");
  const rough = bond === "rubble" || bond === "cobble";

  // The base (mortar, end gaps, seams): one polygon round the band, no joints.
  const facets: Facet[] = [{ role: "side", points: bandQuad(0, length, 0, 1) }];

  const [phaseRoll] = draws(rng, 1);
  for (let course = 0; course < courses; course += 1) {
    const scale = courseScale(course);
    // One band height of THIS course, along u and across v.
    const heightU = 1 / courses / scale;
    const heightV = 1 / courses;
    const count = Math.max(3, Math.round((length * scale * courses) / stoneLength));
    const rolls = draws(rng, count);
    const spread = rough ? 0.3 + 0.3 * irregularity : 0.12 * irregularity;
    const lengths = splitLength(length, count, spread, rolls);
    const bondShift = bond === "running" && course % 2 === 1 ? lengths[0]! / 2 : 0;
    let u = phaseRoll! * (length / count) + bondShift;
    const v0 = course * heightV;
    const v1 = v0 + heightV;
    for (let stone = 0; stone < count; stone += 1) {
      const d = draws(rng, DRAWS_PER_STONE);
      const jitter = (index: number, size: number) => (d[index]! * 2 - 1) * size;
      const half = { u: (gap / 2) * heightU, v: (gap / 2) * heightV };
      const start = u + half.u;
      const end = u + lengths[stone]! - half.u;
      u += lengths[stone]!;
      const ju = irregularity * (rough ? 0.22 : 0.1) * heightU;
      const jv = irregularity * (rough ? 0.14 : 0.06) * heightV;
      const top = v0 + half.v;
      const bottom = v1 - half.v;
      let shape: number[];
      if (bond === "cobble") {
        // Corners cut: a rounded, eight-sided cobble.
        const cut = Math.min(end - start, bottom - top) * 0.28;
        shape = [
          start + cut,
          top + jitter(0, jv),
          end - cut,
          top + jitter(1, jv),
          end + jitter(2, ju),
          top + cut,
          end + jitter(3, ju),
          bottom - cut,
          end - cut,
          bottom + jitter(4, jv),
          start + cut,
          bottom + jitter(5, jv),
          start + jitter(6, ju),
          bottom - cut,
          start + jitter(7, ju),
          top + cut,
        ];
      } else if (bond === "rubble") {
        // Six sides, every corner and both long-edge midpoints thrown about.
        const mid = (start + end) / 2 + jitter(8, ju);
        shape = [
          start + jitter(0, ju),
          top + jitter(1, jv),
          mid,
          top + jitter(9, jv * 1.5),
          end + jitter(2, ju),
          top + jitter(3, jv),
          end + jitter(4, ju),
          bottom + jitter(5, jv),
          mid,
          bottom + jitter(10, jv * 1.5),
          start + jitter(6, ju),
          bottom + jitter(7, jv),
        ];
      } else {
        shape = [
          start + jitter(0, ju),
          top + jitter(1, jv),
          end + jitter(2, ju),
          top + jitter(3, jv),
          end + jitter(4, ju),
          bottom + jitter(5, jv),
          start + jitter(6, ju),
          bottom + jitter(7, jv),
        ];
      }
      const pitch = 22 + chamfer * 40;
      const outline: [number, number] = [0.03 * heightU, 0.03 * heightV];
      const bevel: [number, number] = [inset * heightU, inset * heightV];
      facets.push(...bevelledBlock(shape, outline, bevel, pitch));

      if (d[11]! < crackDensity * 0.85) {
        // A crack across the top: in at one long edge, a kink, out at the other.
        const inner = { start: start + (end - start) * 0.25, end: end - (end - start) * 0.25 };
        const a = inner.start + (inner.end - inner.start) * d[12]!;
        const b = inner.start + (inner.end - inner.start) * d[13]!;
        const kinkU = (a + b) / 2 + jitter(14, 0.25 * heightU);
        const kinkV = (top + bottom) / 2 + jitter(15, 0.15 * heightV);
        const edge = (inset + 0.06) * heightV;
        facets.push(
          ...stroke([a, top + edge, kinkU, kinkV, b, bottom - edge], 0.05 * heightV, "crack"),
        );
      }
    }
  }
  return facets;
};
