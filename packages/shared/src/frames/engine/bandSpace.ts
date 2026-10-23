// ============================================================================
// BAND SPACE AND THE CIRCLE WARP (C5a)
// ============================================================================
// Every band is generated flat, in BAND SPACE: `u` runs along the band, in
// band heights measured at the band's middle radius, from 0 to `length`
// (once round); `v` runs across it, 0 at the inner edge to 1 at the outer.
// Generators know only where a polygon's corners fall (to end motifs on them). The warp then bends that strip round the
// circle — u becomes angle, v radius — so a rectangle comes out a wedge with
// exactly the taper its radius demands, and long edges are cut into short
// steps first so they bend into arcs instead of chords.
//
// Token units throughout: the token box is 1 across, centred on 0, so its
// edge sits at radius 0.5.

import type { TokenSize } from "../../index.js";
import { FRAME_LIMITS, frameSizeScale } from "../frameLimits.js";
import type { FrameBand, FrameRole, FrameShape, TokenFrame } from "../types.js";
import { isPolygonShape, shapeReach } from "./shapes.js";

/** A polygon in band space, tagged with what it is. */
export interface Facet {
  role: FrameRole;
  /** Flat [u0, v0, u1, v1, …]. */
  points: number[];
  /**
   * A sloped facet: it falls away from `from` (a band-space point, usually its
   * motif's centre) at `pitch` degrees from flat. Absent: it faces straight up.
   */
  tilt?: { pitch: number; from: [number, number] };
  /** 0–1, for shadows and faint grain; default 1. */
  alpha?: number;
}

export interface BandRing {
  band: FrameBand;
  /** Inner and outer radius, token units. */
  r0: number;
  r1: number;
}

export interface FrameLayout {
  rings: BandRing[];
  /** The picture's window: the innermost band's inner radius. */
  window: number;
  /** The frame's outer radius. */
  outer: number;
  /** How far the frame reaches outside the token box (0 for grow in). */
  outset: number;
  /** Half the bitmap's edge, token units: the outer radius plus room for shadows and smoothing. */
  extent: number;
  /** What the bands are laid round; the levels above are radii for a circle (shapes.ts). */
  shape: FrameShape;
}

/** Where the bands sit for this token: weight scaled for its size, growth applied. */
export function layoutFrame(frame: TokenFrame, size?: TokenSize): FrameLayout {
  const scale = frameSizeScale(size);
  const weights = frame.bands.map((band) => band.weight * scale);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const growth = frame.growth ?? "in";
  const outset =
    growth === "out"
      ? Math.min(total, FRAME_LIMITS.MAX_OUTSET)
      : growth === "mid"
        ? Math.min(total / 2, FRAME_LIMITS.MAX_OUTSET)
        : 0;
  const outer = 0.5 + outset;
  const window = outer - total;
  let radius = window;
  const rings = frame.bands.map((band, index) => {
    const r0 = radius;
    radius += weights[index]!;
    return { band, r0, r1: radius };
  });
  // A grown-out frame casts a soft shadow on the map; room for it, and for smoothing.
  // A polygon's corners and the shield's point reach past its level, its
  // shadow's too: measured at the level the shadow reaches, a pixel to spare.
  const shape = frame.shape ?? "circle";
  const margin = outset > 0 ? 0.045 : 0.012;
  const extent = isPolygonShape(shape) ? shapeReach(shape, outer + margin) + 0.012 : outer + margin;
  return { rings, window, outer, outset, extent, shape };
}

/** The ring's length once round, in its own band heights (the u range). */
export function bandLength(ring: BandRing): number {
  const middle = (ring.r0 + ring.r1) / 2;
  return (2 * Math.PI * middle) / (ring.r1 - ring.r0);
}

/** One band-space point onto the circle (token units, y down, 0 at the top, clockwise). */
export function warpPoint(ring: BandRing, length: number, u: number, v: number): [number, number] {
  const angle = (2 * Math.PI * u) / length - Math.PI / 2;
  const radius = ring.r0 + v * (ring.r1 - ring.r0);
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Steps per full turn when an edge is cut before the warp: one every 2°. */
const STEPS_PER_TURN = 180;

/** A band-space polygon onto the circle, its edges cut so they bend. Flat [x0, y0, …]. */
export function warpPolygon(ring: BandRing, length: number, points: readonly number[]): number[] {
  const out: number[] = [];
  const count = points.length / 2;
  for (let index = 0; index < count; index += 1) {
    const u0 = points[index * 2]!;
    const v0 = points[index * 2 + 1]!;
    const next = (index + 1) % count;
    const u1 = points[next * 2]!;
    const v1 = points[next * 2 + 1]!;
    const steps = Math.max(1, Math.ceil((Math.abs(u1 - u0) / length) * STEPS_PER_TURN));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const [x, y] = warpPoint(ring, length, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
      out.push(x, y);
    }
  }
  return out;
}

/** The band from u0 to u1 between v0 and v1, as one band-space quad. */
export function bandQuad(u0: number, u1: number, v0: number, v1: number): number[] {
  return [u0, v0, u1, v0, u1, v1, u0, v1];
}

/**
 * The slivers rule: a band so thick for its radius that a cell's inner edge
 * would fall under 0.6 of its outer edge is laid in two courses, and under
 * 0.36 in three (only near the 0.34 cap), so every course's inner edge stays
 * over half its outer and stones never come to a point.
 */
export function courseCount(ring: BandRing): number {
  const ratio = ring.r0 / ring.r1;
  return ratio < 0.36 ? 3 : ratio < 0.6 ? 2 : 1;
}
