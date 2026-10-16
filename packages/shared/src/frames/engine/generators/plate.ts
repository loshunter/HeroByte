// ============================================================================
// PLATE — metal plates with seams and rivets (C5a)
// ============================================================================
// Curved plates by the repeat rule. Overlapping plates (the default) end in a
// raised lip that catches the light; `weld` butts them together under a
// rippled bead instead. Rivets sit in 0–3 rows near each plate's ends (and
// mid-plate on long plates). `irregularity` throws the plate ends and the
// rivets about, which is what makes rusted plate look old. Fixed draws per
// plate, as every generator.

import type { Facet } from "../bandSpace.js";
import { bandQuad } from "../bandSpace.js";
import { bevelledBlock, dome, draws, num, splitLength, type FrameGenerator } from "./common.js";

const DRAWS_PER_PLATE = 24;
const RIVET_ROWS: Record<number, number[]> = {
  0: [],
  1: [0.5],
  2: [0.3, 0.7],
  3: [0.24, 0.5, 0.76],
};
const BEAD_RIPPLES = 6;

export const plate: FrameGenerator = ({ length, courses, courseScale, params, rng }) => {
  const plateLength = num(params, "plateLength");
  const rivetRows = RIVET_ROWS[num(params, "rivetRows")] ?? [];
  const rivetSize = num(params, "rivetSize");
  const seam = num(params, "seamWidth");
  const weld = params.weld === true;
  const irregularity = num(params, "irregularity");

  // The base (mortar, end gaps, seams): one polygon round the band, no joints.
  const facets: Facet[] = [{ role: "outline", points: bandQuad(0, length, 0, 1) }];
  const [phaseRoll] = draws(rng, 1);
  for (let course = 0; course < courses; course += 1) {
    const scale = courseScale(course);
    const heightU = 1 / courses / scale;
    const heightV = 1 / courses;
    const count = Math.max(3, Math.round((length * scale * courses) / plateLength));
    const lengths = splitLength(length, count, 0.25 * irregularity, draws(rng, count));
    let u = phaseRoll! * (length / count) + (course % 2) * (lengths[0]! / 2);
    const v0 = course * heightV;
    const v1 = v0 + heightV;
    for (let index = 0; index < count; index += 1) {
      const d = draws(rng, DRAWS_PER_PLATE);
      const jitter = (at: number, size: number) => (d[at]! * 2 - 1) * size * irregularity;
      const gapU = weld ? 0 : (seam / 2) * heightU;
      const start = u + gapU;
      const end = u + lengths[index]! - gapU;
      u += lengths[index]!;
      const shape = [
        start + jitter(0, 0.12 * heightU),
        v0,
        end + jitter(1, 0.12 * heightU),
        v0,
        end + jitter(2, 0.12 * heightU),
        v1,
        start + jitter(3, 0.12 * heightU),
        v1,
      ];
      facets.push(
        ...bevelledBlock(shape, [0.02 * heightU, 0], [0.07 * heightU, 0.04 * heightV], 30),
      );
      if (!weld) {
        // The overlap: a lip along the plate's leading end, a sloped strip that catches the light.
        const lip = 0.12 * heightU;
        facets.push({
          role: "bevel",
          points: [end - lip, v0, end, v0, end, v1, end - lip, v1],
          tilt: { pitch: 55, from: [end - lip * 2, (v0 + v1) / 2] },
        });
      } else {
        // A weld bead over the joint: ripples sloping alternately, so it glints in bands.
        const half = Math.max(seam * 1.4, 0.05) * heightU;
        const step = heightV / BEAD_RIPPLES;
        for (let ripple = 0; ripple < BEAD_RIPPLES; ripple += 1) {
          const a = v0 + ripple * step;
          const b = a + step;
          const centre = u + jitter(4 + ripple, 0.2 * half);
          facets.push({
            role: "bevel",
            points: [
              centre - half,
              a,
              centre + half,
              a,
              centre + half * 0.8,
              b,
              centre - half * 0.8,
              b,
            ],
            tilt: { pitch: 38, from: [centre, ripple % 2 === 0 ? b + step : a - step] },
          });
        }
      }
      const span = end - start;
      const rivetAt = [start + 0.28 * heightU, end - 0.28 * heightU];
      if (span > 2.6 * heightU) rivetAt.push((start + end) / 2);
      rivetRows.forEach((row, rowIndex) => {
        rivetAt.forEach((at, atIndex) => {
          const slot = 12 + rowIndex * 3 + atIndex;
          facets.push(
            ...dome(
              at + jitter(slot, 0.08 * heightU),
              v0 + (row + jitter(slot + 1, 0.06)) * heightV,
              (rivetSize / 2) * heightV,
              1 / scale,
            ),
          );
        });
      });
    }
  }
  return facets;
};
