// ============================================================================
// FRAME EDGES, STEPS AND SHADOWS (C5a)
// ============================================================================
// What belongs to the stack rather than to one generator, built straight in
// token space as thin arcs cut into short segments (each lit by its own
// normal, so a round edge shades smoothly round the ring):
//
//  - each band's edge profile (round, chamfer, step, flat) along both edges;
//  - a STEP where a taller band meets a lower one: a lit side face on the
//    taller band and a contact shadow on the lower, deepest on the side away
//    from the light;
//  - the window's contact shadow, so the picture sits IN the frame;
//  - a soft drop shadow on the map under a frame grown outward.

import type { FrameBevelProfile } from "../types.js";
import { LIGHT, UP, slopeNormal, type Vec3 } from "./shading.js";
import { edgeNormalsOf, shapeOutline, type PolygonShape } from "./shapes.js";

/** A facet in token space, its normal already known. */
export interface EdgeFacet {
  kind: "edge" | "shadow";
  points: number[];
  normal: Vec3;
  alpha: number;
}

/** Segments round the ring: 3° each, so a lit edge's chords sag under 0.2 px at 1024. */
export const EDGE_SEGMENTS = 120;
/** Shadows fall away from the light: the screen direction they are cast in. */
const CAST: [number, number] = (() => {
  const length = Math.hypot(LIGHT[0], LIGHT[1]);
  return [-LIGHT[0] / length, -LIGHT[1] / length];
})();
/** The window's contact shadow reaches this far into the picture (3% of the token edge). */
export const WINDOW_SHADOW_WIDTH = 0.03;
/** The darkest a contact shadow gets, on the side facing straight away from the light. */
export const CONTACT_SHADOW_STRENGTH = 0.5;

/** One segment of the ring between radii r0 and r1 (token units), as a quad. */
function arcQuad(r0: number, r1: number, a0: number, a1: number, cx = 0, cy = 0): number[] {
  return [
    cx + r0 * Math.cos(a0),
    cy + r0 * Math.sin(a0),
    cx + r1 * Math.cos(a0),
    cy + r1 * Math.sin(a0),
    cx + r1 * Math.cos(a1),
    cy + r1 * Math.sin(a1),
    cx + r0 * Math.cos(a1),
    cy + r0 * Math.sin(a1),
  ];
}

/** How far a lit segment runs on under its neighbour, so no seam of background shows between. */
const OVERLAP = 0.004;

/** One piece of the edge round the shape: its quad between two levels, and its outward direction. */
export interface EdgeSegment {
  /** Between levels l0 and l1; `extra` runs a lit piece on under its neighbour; (cx, cy) shifts it. */
  quad: (l0: number, l1: number, extra?: number, cx?: number, cy?: number) => number[];
  dx: number;
  dy: number;
}

/**
 * The pieces round a shape, facing as the outline does at `level` (a
 * shield's curves turn with level). Lit pieces overlap their neighbour a
 * hair (`overlap`); shadows never do.
 */
export type EdgePath = (overlap?: number, level?: number) => Iterable<EdgeSegment>;

/**
 * Round the circle: each segment's start and end angle, and its outward
 * direction. Lit segments overlap their neighbour a hair (`overlap`);
 * shadows never do, or each joint would darken twice.
 */
export const CIRCLE_PATH: EdgePath = function* (overlap = 0) {
  for (let index = 0; index < EDGE_SEGMENTS; index += 1) {
    const a0 = (index / EDGE_SEGMENTS) * Math.PI * 2;
    const a1 = ((index + 1) / EDGE_SEGMENTS) * Math.PI * 2 + overlap;
    const middle = (a0 + a1) / 2;
    yield {
      quad: (l0, l1, extra = 0, cx = 0, cy = 0) => arcQuad(l0, l1, a0, a1 + extra, cx, cy),
      dx: Math.cos(middle),
      dy: Math.sin(middle),
    };
  }
};

/**
 * Round a polygon: one piece per edge of its outline (a corner is the mitre
 * between two). Pieces share their corners exactly, and the band's base
 * polygon lies under them, so they need no overlap.
 */
export function shapePath(shape: PolygonShape): EdgePath {
  const levels = new Map<number, number[]>();
  const at = (level: number) => {
    let points = levels.get(level);
    if (!points) levels.set(level, (points = shapeOutline(shape, level)));
    return points;
  };
  const box = edgeNormalsOf(shapeOutline(shape, 0.5));
  const count = box.length / 2;
  return function* (_overlap = 0, level = 0.5) {
    const facing = edgeNormalsOf(at(level));
    for (let index = 0; index < count; index += 1) {
      // A piece shrunk to a point at this level faces as it does at the token box.
      const shrunk = facing[index * 2] === 0 && facing[index * 2 + 1] === 0;
      const normals = shrunk ? box : facing;
      const next = (index + 1) % count;
      yield {
        quad: (l0, l1, _extra = 0, cx = 0, cy = 0) => {
          const a = at(l0);
          const b = at(l1);
          return [
            cx + a[index * 2]!,
            cy + a[index * 2 + 1]!,
            cx + b[index * 2]!,
            cy + b[index * 2 + 1]!,
            cx + b[next * 2]!,
            cy + b[next * 2 + 1]!,
            cx + a[next * 2]!,
            cy + a[next * 2 + 1]!,
          ];
        },
        dx: normals[index * 2]!,
        dy: normals[index * 2 + 1]!,
      };
    }
  };
}

/** Strips from the edge inward: [start, end] as shares of the bevel width, and the slope. */
const PROFILES: Record<FrameBevelProfile, { from: number; to: number; pitch: number }[]> = {
  round: [
    { from: 0, to: 1 / 3, pitch: 62 },
    { from: 1 / 3, to: 2 / 3, pitch: 38 },
    { from: 2 / 3, to: 1, pitch: 14 },
  ],
  chamfer: [{ from: 0, to: 1, pitch: 45 }],
  step: [{ from: 0, to: 0.4, pitch: 74 }],
  flat: [],
};

/** A band's two edges, rounded or cut by its profile (`width` is a share of its thickness). */
export function bandEdgeFacets(
  r0: number,
  r1: number,
  profile: FrameBevelProfile,
  width: number,
  path: EdgePath = CIRCLE_PATH,
): EdgeFacet[] {
  const facets: EdgeFacet[] = [];
  const reach = (r1 - r0) * Math.min(0.5, width);
  if (reach <= 0) return facets;
  // Each edge faces as the outline does where it lies (the circle's are the same pieces).
  const outerEdge = [...path(OVERLAP, r1)];
  const innerEdge = [...path(OVERLAP, r0)];
  for (const strip of PROFILES[profile]) {
    for (let at = 0; at < outerEdge.length; at += 1) {
      const { quad, dx, dy } = outerEdge[at]!;
      const inner = innerEdge[at]!;
      // The outer edge slopes outward, the inner edge inward.
      facets.push({
        kind: "edge",
        points: quad(r1 - reach * strip.to, r1 - reach * strip.from),
        normal: slopeNormal(dx, dy, strip.pitch),
        alpha: 1,
      });
      facets.push({
        kind: "edge",
        points: inner.quad(r0 + reach * strip.from, r0 + reach * strip.to),
        normal: slopeNormal(-inner.dx, -inner.dy, strip.pitch),
        alpha: 1,
      });
    }
  }
  return facets;
}

/** How much a surface facing (dx, dy) is turned away from the light: 0 lit, 1 straight away. */
const awayFromLight = (dx: number, dy: number) => Math.max(0, dx * CAST[0] + dy * CAST[1]);

/**
 * Where the band at `boundary` changes height by `rise` (the taller band
 * inside when `tallerInside`): a side face on the taller band, `sideWidth`
 * wide, and a contact shadow on the lower one, `room` deep at most.
 */
export function stepFacets(
  boundary: number,
  rise: number,
  tallerInside: boolean,
  sideWidth: number,
  room: number,
  path: EdgePath = CIRCLE_PATH,
): { side: EdgeFacet[]; shadow: EdgeFacet[] } {
  const side: EdgeFacet[] = [];
  const shadow: EdgeFacet[] = [];
  const toward = tallerInside ? 1 : -1; // from the taller band toward the lower, radially
  for (const { quad, dx, dy } of path(0, boundary)) {
    const [ox, oy] = [dx * toward, dy * toward];
    const sideFrom = boundary - toward * sideWidth;
    side.push({
      kind: "edge",
      points: quad(Math.min(sideFrom, boundary), Math.max(sideFrom, boundary), OVERLAP),
      normal: slopeNormal(ox, oy, 76),
      alpha: 1,
    });
    const away = awayFromLight(ox, oy);
    const depth = Math.min(room, (0.006 + 0.05 * away) * rise);
    const alpha = CONTACT_SHADOW_STRENGTH * (0.25 + 0.75 * away) * Math.min(1, rise * 1.6);
    // Two strips, the near one darker: a soft edge rather than a painted line.
    for (const [from, to, share] of [
      [0, 0.5, 1],
      [0.5, 1, 0.45],
    ] as const) {
      const near = boundary + toward * depth * from;
      const far = boundary + toward * depth * to;
      shadow.push({
        kind: "shadow",
        points: quad(Math.min(near, far), Math.max(near, far)),
        normal: UP,
        alpha: alpha * share,
      });
    }
  }
  return { side, shadow };
}

/** The picture's edge, darkened where the frame stands between it and the light. */
export function windowShadowFacets(
  window: number,
  depth: number,
  path: EdgePath = CIRCLE_PATH,
): EdgeFacet[] {
  const facets: EdgeFacet[] = [];
  const strips = [
    [0, 1 / 3, 1],
    [1 / 3, 2 / 3, 0.5],
    [2 / 3, 1, 0.2],
  ] as const;
  for (const { quad, dx, dy } of path(0, window)) {
    const away = awayFromLight(-dx, -dy);
    const alpha = (0.16 + 0.5 * away * depth) * 0.9;
    for (const [from, to, share] of strips) {
      facets.push({
        kind: "shadow",
        points: quad(window - WINDOW_SHADOW_WIDTH * to, window - WINDOW_SHADOW_WIDTH * from),
        normal: UP,
        alpha: alpha * share,
      });
    }
  }
  return facets;
}

/** A soft shadow under a grown-out frame, cast away from the light. */
export function dropShadowFacets(outer: number, path: EdgePath = CIRCLE_PATH): EdgeFacet[] {
  const facets: EdgeFacet[] = [];
  const cx = CAST[0] * 0.012;
  const cy = CAST[1] * 0.012;
  const rings = [
    [outer - 0.02, outer + 0.008, 0.3],
    [outer + 0.008, outer + 0.02, 0.15],
    [outer + 0.02, outer + 0.032, 0.06],
  ] as const;
  for (const { quad } of path(0, outer)) {
    for (const [r0, r1, alpha] of rings) {
      facets.push({ kind: "shadow", points: quad(r0, r1, 0, cx, cy), normal: UP, alpha });
    }
  }
  return facets;
}
