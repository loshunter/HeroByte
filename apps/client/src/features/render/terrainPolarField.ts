// Polar-course engine (catalog rank 6): a point-source field per painted
// region and ONE parametric per-pixel painter over it, so round tower cones,
// domes, dais rings and spiral thatch are pure palette entries. Two halves:
//
//  * computePolarRegions — connected components of a polar family's painted
//    cells, each reduced to a centre + radius (the point source). Angle and
//    radial distance are ANALYTIC from the centre per pixel — smoother than
//    the cell-sampled depth field, no bilinear needed.
//  * polarCourseColor — quantized radial courses with per-course tone ramp,
//    staggered radial joint seams at an arc pitch, an optional sun-facing
//    luminance split (cones/domes), jagged course edges (thatch tufts), and
//    an optional one-course-per-turn spiral. All parameters are data.

import type { FieldRgb } from "./proceduralTerrainTypes";
import { mixRgb } from "./terrainFieldColor";
import { hash2, valueNoise } from "./valueNoise";

/** One painted region's point source, in world px. */
export interface PolarRegion {
  centerX: number;
  centerY: number;
  radius: number;
}

/** The parametric course knobs (see terrainPaletteTypes for the data docs). */
export interface PolarParams {
  courseWidth: number;
  jointPitch: number;
  jagged?: number;
  ramp?: number;
  sunSplit?: number;
  spiral?: boolean;
}

const NEIGHBOURS8: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * Group each polar family's painted cells into 8-connected components and map
 * every cell to its component's centre (cell-centroid) + radius (furthest
 * cell centre + half a cell, so the outermost course hugs the painted edge).
 * A lone cell is a half-cell-radius disc.
 */
export function computePolarRegions(
  familyByCell: ReadonlyMap<string, string>,
  polarIds: readonly string[],
  grid: { size: number; offsetX: number; offsetY: number },
): Map<string, Map<string, PolarRegion>> {
  const out = new Map<string, Map<string, PolarRegion>>();
  for (const id of polarIds) {
    const cellSet = new Set<string>();
    for (const [cellKey, familyId] of familyByCell) {
      if (familyId === id) cellSet.add(cellKey);
    }
    if (cellSet.size === 0) continue;
    const seen = new Set<string>();
    const regions = new Map<string, PolarRegion>();
    for (const start of cellSet) {
      if (seen.has(start)) continue;
      const component: [number, number][] = [];
      const queue = [start];
      seen.add(start);
      while (queue.length > 0) {
        const key = queue.pop()!;
        const [x, y] = key.split(",").map(Number) as [number, number];
        component.push([x, y]);
        for (const [dx, dy] of NEIGHBOURS8) {
          const nk = `${x + dx},${y + dy}`;
          if (cellSet.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            queue.push(nk);
          }
        }
      }
      let sumX = 0;
      let sumY = 0;
      for (const [x, y] of component) {
        sumX += x;
        sumY += y;
      }
      const centerX = grid.offsetX + (sumX / component.length + 0.5) * grid.size;
      const centerY = grid.offsetY + (sumY / component.length + 0.5) * grid.size;
      let maxD = 0;
      for (const [x, y] of component) {
        const dx = grid.offsetX + (x + 0.5) * grid.size - centerX;
        const dy = grid.offsetY + (y + 0.5) * grid.size - centerY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxD) maxD = d;
      }
      const region: PolarRegion = { centerX, centerY, radius: maxD + grid.size / 2 };
      for (const [x, y] of component) regions.set(`${x},${y}`, region);
    }
    out.set(id, regions);
  }
  return out;
}

const TWO_PI = Math.PI * 2;
/** The shared light direction (top-right), matching the field's cast shadows. */
const LIGHT_ANGLE = -Math.PI / 4;
/** Seam thickness as a fraction of a joint segment / course width. */
const JOINT_FRAC = 0.08;
const COURSE_SEAM_FRAC = 0.1;

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * The course colour at a world point of a polar region. `courseWidth` and
 * `jointPitch` are in CELLS (masonry has an absolute module, so big towers
 * get MORE courses, not wider ones); the tone ramp runs over the normalized
 * radius (apex→eave shading spans the region whatever its size). Pure and
 * deterministic — same inputs, same colour, every bake.
 */
export function polarCourseColor(
  base: FieldRgb,
  rim: FieldRgb,
  wx: number,
  wy: number,
  region: PolarRegion,
  params: PolarParams,
  seed: number,
  cellSize: number,
): FieldRgb {
  const dx = wx - region.centerX;
  const dy = wy - region.centerY;
  const rPx = Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dy, dx);
  const angFrac = (theta + Math.PI) / TWO_PI; // 0..1 around the centre
  const coursePx = params.courseWidth * cellSize;
  let r = rPx;
  if (params.jagged) {
    const ns = cellSize * 0.4;
    r += (valueNoise(wx / ns, wy / ns, seed + 31) - 0.5) * params.jagged * coursePx * 2;
  }
  if (params.spiral) r += angFrac * coursePx;
  const course = Math.max(0, Math.floor(r / coursePx));

  // Per-course tone: the radial ramp, a small hash variance so adjacent rings
  // never read identical, and the sun-facing luminance split.
  const rNorm = Math.min(1.2, rPx / region.radius);
  let tone = 1 - (params.ramp ?? 0) * rNorm;
  tone *= 1 + (hash2(course, 0, seed + 32) - 0.5) * 0.08;
  if (params.sunSplit) tone *= 1 + params.sunSplit * Math.cos(theta - LIGHT_ANGLE);

  let color: FieldRgb = [
    Math.round(clamp255(base[0] * tone)),
    Math.round(clamp255(base[1] * tone)),
    Math.round(clamp255(base[2] * tone)),
  ];

  // Seams: the ring line between courses, and radial joints at ~jointPitch
  // cells of arc along the course's mid ring, brick-staggered per course. A
  // per-course hash phase rotates each course's joint grid so no two courses
  // share the theta-wrap anchor — without it every EVEN course started a
  // joint band on the 9-o'clock ray, drawing an aligned dashed column there
  // (caught by a review probe). Also keeps joint edges off the wrap line.
  const midR = Math.max(coursePx * 0.5, (course + 0.5) * coursePx);
  const segments = Math.max(3, Math.round((TWO_PI * midR) / (params.jointPitch * cellSize)));
  const jointPos = angFrac * segments + (course % 2) * 0.5 + hash2(course, 1, seed + 33);
  const isJoint = jointPos - Math.floor(jointPos) < JOINT_FRAC;
  const isRing = r / coursePx - course < COURSE_SEAM_FRAC;
  if (isJoint || isRing) color = mixRgb(color, rim, 0.55);
  return color;
}
