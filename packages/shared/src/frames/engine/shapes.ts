// ============================================================================
// FRAME SHAPES — the outlines a frame is laid round (C5b)
// ============================================================================
// A shape is an outline at any LEVEL: level 0.5 is the shape fitted to the
// token box, as a circle of radius 0.5 is, and a band between levels r0 and
// r1 lies between the outlines at those levels. A polygon's outline at another
// level is its edges moved out (or in) in parallel by the difference, corners
// mitred; the squircle's corners keep their centres and change radius. Every
// outline of one shape has the same vertices in the same order, starting at
// the top centre and running clockwise (y down), so the band's inner and outer
// edges correspond point for point and a corner stays one line across a band.
//
// The circle is not drawn from here: the engine keeps its own exact arcs for
// it (bandSpace.ts), so circle frames bake exactly as they did before shapes.

import type { FrameShape } from "../types.js";

export type PolygonShape = Exclude<FrameShape, "circle">;

/** The squircle's corner radius at the token box: 0.22 of the edge (plan §3.7). */
export const SQUIRCLE_CORNER = 0.22;
/** Points round each of the squircle's corners and the shield's two curves. */
const CURVE_STEPS = 12;

const HEX_APOTHEM = 0.5 * Math.cos(Math.PI / 6);
const OCT_HALF_SIDE = 0.5 * Math.tan(Math.PI / 8);
/** The heater shield: straight sides down to here, then two arcs of radius 1 to the point. */
const SHIELD_SHOULDER = 0.5 - Math.sqrt(3) / 2;

const arc = (cx: number, cy: number, radius: number, from: number, to: number): number[] => {
  const points: number[] = [];
  for (let step = 0; step <= CURVE_STEPS; step += 1) {
    const angle = from + ((to - from) * step) / CURVE_STEPS;
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  return points;
};

/** Each polygon at the token box, from the top centre, clockwise; `corners` are vertex indices. */
const BASE: Record<"square" | "hexagon" | "octagon", { points: number[]; corners: number[] }> = {
  square: { points: [0, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5], corners: [1, 2, 3, 4] },
  hexagon: {
    points: [
      0,
      -HEX_APOTHEM,
      0.25,
      -HEX_APOTHEM,
      0.5,
      0,
      0.25,
      HEX_APOTHEM,
      -0.25,
      HEX_APOTHEM,
      -0.5,
      0,
      -0.25,
      -HEX_APOTHEM,
    ],
    corners: [1, 2, 3, 4, 5, 6],
  },
  octagon: {
    points: [
      0,
      -0.5,
      OCT_HALF_SIDE,
      -0.5,
      0.5,
      -OCT_HALF_SIDE,
      0.5,
      OCT_HALF_SIDE,
      OCT_HALF_SIDE,
      0.5,
      -OCT_HALF_SIDE,
      0.5,
      -0.5,
      OCT_HALF_SIDE,
      -0.5,
      -OCT_HALF_SIDE,
      -OCT_HALF_SIDE,
      -0.5,
    ],
    corners: [1, 2, 3, 4, 5, 6, 7, 8],
  },
};

/** The shield's corners: its two top corners and the point (2 + the right arc's steps). */
const SHIELD_CORNERS = [1, 2 + CURVE_STEPS, 3 + 2 * CURVE_STEPS];

/**
 * The heater shield at `level`, built rather than mitred: its sides are so
 * short that an inward offset would fold them back on themselves. The top
 * moves to -level, the sides to ±level, and the two arcs keep their centres
 * and change radius, so this is the true parallel outline; once the top falls
 * below the shoulders the sides are gone and the top meets the arcs.
 */
function shield(level: number): number[] {
  const radius = 1 + (level - 0.5);
  const top = -level;
  const drop = Math.sqrt(radius * radius - 0.25);
  const point = Math.atan2(drop, 0.5);
  const from = Math.max(0, Math.asin(Math.min(1, (top - SHIELD_SHOULDER) / radius)));
  const corner = from > 0 ? radius * Math.cos(from) - 0.5 : level;
  const right = arc(-0.5, SHIELD_SHOULDER, radius, from, point);
  const left = arc(0.5, SHIELD_SHOULDER, radius, Math.PI - point, Math.PI - from).slice(2);
  return [0, top, corner, top, ...right, ...left, -corner, top];
}

/** Outward unit normals of each edge (from vertex i to i + 1), for a clockwise y-down outline. */
export function edgeNormalsOf(points: readonly number[]): number[] {
  const count = points.length / 2;
  const normals: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const dx = points[next * 2]! - points[index * 2]!;
    const dy = points[next * 2 + 1]! - points[index * 2 + 1]!;
    const length = Math.hypot(dx, dy) || 1;
    normals.push(dy / length, -dx / length);
  }
  return normals;
}

/** The polygon moved out by `offset` (negative: in), every corner mitred. */
function mitre(points: readonly number[], offset: number): number[] {
  const normals = edgeNormalsOf(points);
  const count = points.length / 2;
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const before = (index + count - 1) % count;
    const nx = normals[before * 2]! + normals[index * 2]!;
    const ny = normals[before * 2 + 1]! + normals[index * 2 + 1]!;
    // The mitre: along the corner's bisector, 1 / cos(half the turn) as far.
    const scale =
      offset /
      (1 +
        normals[before * 2]! * normals[index * 2]! +
        normals[before * 2 + 1]! * normals[index * 2 + 1]!);
    out.push(points[index * 2]! + nx * scale, points[index * 2 + 1]! + ny * scale);
  }
  return out;
}

function squircle(level: number): number[] {
  const half = level;
  const radius = Math.max(0, SQUIRCLE_CORNER + (level - 0.5));
  const inner = half - radius;
  const quarter = Math.PI / 2;
  return [
    0,
    -half,
    ...arc(inner, -inner, radius, -quarter, 0),
    ...arc(inner, inner, radius, 0, quarter),
    ...arc(-inner, inner, radius, quarter, 2 * quarter),
    ...arc(-inner, -inner, radius, 2 * quarter, 3 * quarter),
  ];
}

/** The shape's outline at `level` (0.5: fitted to the token box). Flat [x0, y0, …], closed implicitly. */
export function shapeOutline(shape: PolygonShape, level: number): number[] {
  if (shape === "squircle") return squircle(level);
  if (shape === "shield") return shield(level);
  return mitre(BASE[shape].points, level - 0.5);
}

/** Vertex indices where the outline turns a corner (none for the squircle: it is smooth). */
export function shapeCorners(shape: PolygonShape): readonly number[] {
  if (shape === "squircle") return [];
  return shape === "shield" ? SHIELD_CORNERS : BASE[shape].corners;
}

/** How far the outline at `level` reaches from the centre along x or y: the bitmap must hold it. */
export function shapeReach(shape: PolygonShape, level: number): number {
  const points = shapeOutline(shape, level);
  let reach = 0;
  for (const value of points) reach = Math.max(reach, Math.abs(value));
  return reach;
}

/** The outline's length once round. */
export function outlineLength(points: readonly number[]): number {
  let total = 0;
  const count = points.length / 2;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    total += Math.hypot(
      points[next * 2]! - points[index * 2]!,
      points[next * 2 + 1]! - points[index * 2 + 1]!,
    );
  }
  return total;
}

/** Whether (x, y) is inside the outline (even-odd). */
export function insideOutline(points: readonly number[], x: number, y: number): boolean {
  let inside = false;
  const count = points.length / 2;
  for (let index = 0, last = count - 1; index < count; last = index, index += 1) {
    const xi = points[index * 2]!;
    const yi = points[index * 2 + 1]!;
    const xj = points[last * 2]!;
    const yj = points[last * 2 + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const isPolygonShape = (shape: FrameShape | undefined): shape is PolygonShape =>
  shape !== undefined && shape !== "circle";
