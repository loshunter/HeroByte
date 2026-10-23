// ============================================================================
// MASONRY — stones in courses (C5a)
// ============================================================================
// Castle ashlar, brick, cave rubble and cobble are all this. The count obeys
// the repeat rule (N = round(perimeter / (stoneLength × band)), per course),
// so stones keep their proportions at any weight and taper exactly as their
// radius says; a band too thick for its circle is laid in two courses
// or three (courseCount). Each stone is a dark outline, a ring of chamfer facets
// falling from its centre, an inset top, and maybe a crack (the crack role,
// which a band with a glow lights up). Mortar is the band's base.
//
// Every stone takes the same fixed number of draws whatever the params, so
// gap, inset, irregularity, chamfer, crack density and bond never reshuffle
// the ring; anything that changes the stone COUNT (stone length, weight, the
// token's size) lays different stones.

import type { Facet } from "../bandSpace.js";
import { bandQuad } from "../bandSpace.js";
import {
  bevelledBlock,
  clampAcross,
  draws,
  motifCount,
  num,
  layCourse,
  stroke,
  type FrameGenerator,
} from "./common.js";

const DRAWS_PER_STONE = 20;

export const masonry: FrameGenerator = ({
  length,
  courses,
  courseScale,
  params,
  rng,
  maxMotifs,
  corners,
}) => {
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
    const count = motifCount(length * scale * courses, stoneLength, maxMotifs);
    const rolls = draws(rng, count);
    const spread = rough ? 0.3 + 0.3 * irregularity : 0.12 * irregularity;
    const running = bond === "running" && course % 2 === 1;
    const laid = layCourse({ length, corners }, count, spread, rolls, phaseRoll!, running);
    const v0 = course * heightV;
    const v1 = v0 + heightV;
    for (const { at: u, length: piece } of laid) {
      const d = draws(rng, DRAWS_PER_STONE);
      const jitter = (index: number, size: number) => (d[index]! * 2 - 1) * size;
      const half = { u: (gap / 2) * heightU, v: (gap / 2) * heightV };
      const start = u + half.u;
      const end = u + piece - half.u;
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
      // Jitter may not carry a stone out of its course (over the next) or its band (off the bitmap).
      for (const facet of bevelledBlock(clampAcross(shape, v0, v1), outline, bevel, pitch))
        facets.push(facet);

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
