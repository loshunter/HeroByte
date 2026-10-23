// ============================================================================
// SHAPE RIBBONS — band space warped onto a polygon (C5b)
// ============================================================================
// The polygon version of bandSpace.ts's circle warp. A band between levels r0
// and r1 is a RIBBON: the shape's outline at r0 and at r1, vertex for vertex
// (shapes.ts). `u` runs along the band in band heights, each segment as long
// as the mean of its inner and outer edges; a point (u, v) is found on its
// segment at that length, then taken the same share along the inner and outer
// outlines' matching segments and `v` of the way between them. A corner is therefore
// one straight mitre line across the band at a fixed `u`, which the corner-
// aware generators end their motifs on.

import { outlineLength, shapeCorners, shapeOutline, type PolygonShape } from "./shapes.js";

/** Steps per full turn when a band-space edge is cut before the warp (as the circle's). */
const STEPS_PER_TURN = 180;

export interface Ribbon {
  shape: PolygonShape;
  inner: number[];
  outer: number[];
  /** Length along the band (the mean of its edges) up to each vertex, token units, and once round. */
  along: number[];
  perimeter: number;
  /** The band's thickness, token units: u is measured in these. */
  thickness: number;
  /** u once round, in band heights. */
  length: number;
  /** u of every corner, ascending. */
  corners: number[];
  /** u of every vertex, ascending (an edge is cut at each, so it bends where the shape does). */
  vertexU: number[];
}

export function makeRibbon(shape: PolygonShape, r0: number, r1: number): Ribbon {
  const inner = shapeOutline(shape, r0);
  const outer = shapeOutline(shape, r1);
  const count = inner.length / 2;
  const along: number[] = [0];
  const span = (points: number[], index: number, next: number) =>
    Math.hypot(
      points[next * 2]! - points[index * 2]!,
      points[next * 2 + 1]! - points[index * 2 + 1]!,
    );
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    // The mean of the inner and outer edges' lengths: the middle's own for a
    // mitred polygon, and still a real length where the middle has shrunk to
    // a point (a shield's side, a squircle's corner) but the outer edge has
    // not, so the warp never skips the outer corner.
    along.push(along[index]! + (span(inner, index, next) + span(outer, index, next)) / 2);
  }
  const perimeter = along[count]!;
  const thickness = r1 - r0;
  const vertexU = along.slice(0, count).map((length) => length / thickness);
  return {
    shape,
    inner,
    outer,
    along,
    perimeter,
    thickness,
    length: perimeter / thickness,
    corners: shapeCorners(shape).map((index) => vertexU[index]!),
    vertexU,
  };
}

/** The outline's length at `level` over its length at `reference`: a course's u is shorter inside. */
export function levelScale(shape: PolygonShape, level: number, reference: number): number {
  return outlineLength(shapeOutline(shape, level)) / outlineLength(shapeOutline(shape, reference));
}

/** One band-space point onto the ribbon (token units). */
export function ribbonPoint(ribbon: Ribbon, u: number, v: number): [number, number] {
  const { along, inner, outer } = ribbon;
  const count = inner.length / 2;
  let s = (((u % ribbon.length) + ribbon.length) % ribbon.length) * ribbon.thickness;
  if (s >= ribbon.perimeter) s -= ribbon.perimeter;
  // The segment holding `s`: binary search over the lengths to each vertex.
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (along[mid]! <= s) low = mid;
    else high = mid - 1;
  }
  const span = along[low + 1]! - along[low]!;
  const t = span > 0 ? (s - along[low]!) / span : 0;
  const next = (low + 1) % count;
  const ix = inner[low * 2]! + (inner[next * 2]! - inner[low * 2]!) * t;
  const iy = inner[low * 2 + 1]! + (inner[next * 2 + 1]! - inner[low * 2 + 1]!) * t;
  const ox = outer[low * 2]! + (outer[next * 2]! - outer[low * 2]!) * t;
  const oy = outer[low * 2 + 1]! + (outer[next * 2 + 1]! - outer[low * 2 + 1]!) * t;
  return [ix + (ox - ix) * v, iy + (oy - iy) * v];
}

/** Where an edge from u0 to u1 must be cut: every vertex u it crosses (unwrapped), ascending. */
function crossings(ribbon: Ribbon, u0: number, u1: number): number[] {
  const low = Math.min(u0, u1);
  const high = Math.max(u0, u1);
  const out: number[] = [];
  const first = Math.floor(low / ribbon.length);
  const last = Math.floor(high / ribbon.length);
  for (let turn = first; turn <= last; turn += 1) {
    for (const vertex of ribbon.vertexU) {
      const at = vertex + turn * ribbon.length;
      if (at > low && at < high) out.push(at);
    }
  }
  out.sort((a, b) => a - b);
  return u1 >= u0 ? out : out.reverse();
}

/** A band-space polygon onto the ribbon, its edges cut at the shape's vertices and in short steps. */
export function ribbonPolygon(ribbon: Ribbon, points: readonly number[]): number[] {
  const out: number[] = [];
  const count = points.length / 2;
  for (let index = 0; index < count; index += 1) {
    const u0 = points[index * 2]!;
    const v0 = points[index * 2 + 1]!;
    const next = (index + 1) % count;
    const u1 = points[next * 2]!;
    const v1 = points[next * 2 + 1]!;
    const steps = Math.max(1, Math.ceil((Math.abs(u1 - u0) / ribbon.length) * STEPS_PER_TURN));
    const cuts = new Set<number>();
    for (let step = 0; step < steps; step += 1) cuts.add(step / steps);
    if (u1 !== u0) for (const at of crossings(ribbon, u0, u1)) cuts.add((at - u0) / (u1 - u0));
    for (const t of [...cuts].sort((a, b) => a - b)) {
      const [x, y] = ribbonPoint(ribbon, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
      out.push(x, y);
    }
  }
  return out;
}

/** The ring between two levels as one polygon (its two seam edges coincide and cancel). */
export function shapeBand(shape: PolygonShape, level0: number, level1: number): number[] {
  const inner = shapeOutline(shape, level0);
  const outer = shapeOutline(shape, level1);
  const points = [...inner, inner[0]!, inner[1]!];
  for (let index = outer.length / 2; index >= 0; index -= 1) {
    const at = index % (outer.length / 2);
    points.push(outer[at * 2]!, outer[at * 2 + 1]!);
  }
  return points;
}
