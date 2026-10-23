// ============================================================================
// FRAME GENERATORS — what they share (C5a)
// ============================================================================
// The context a generator is handed, and the motif pieces several of them
// build from: a bevelled block (a stone, a plank, a plate), a dome (a rivet,
// a nail head), a thin stroke (a crack, a grain line), and the courses a
// thick band is laid in. Everything is band space (bandSpace.ts).

import type { SeededRng } from "../../../rng.js";
import type { FrameParamValue } from "../../types.js";
import type { Facet } from "../bandSpace.js";

export interface GeneratorContext {
  /** The u range once round, in band heights. */
  length: number;
  /** 1, 2, or 3 near the weight cap (courseCount: the slivers rule). */
  courses: number;
  /** Middle radius of each course over the band's middle radius (a course's u is shorter inside). */
  courseScale: (course: number) => number;
  params: Record<string, FrameParamValue>;
  rng: SeededRng;
  /** Motifs a course may hold: the frame's whole budget shared by its bands and courses. */
  maxMotifs: number;
  /** The band's thickness in this bitmap's pixels: details under a pixel are left out. */
  bandPx: number;
  /** A polygon's corners, u ascending: corner-aware motifs end on them (absent on a circle). */
  corners?: number[];
}

export type FrameGenerator = (context: GeneratorContext) => Facet[];

/** Motifs per course at most: a backstop under the band-weight floor (MIN_BAND_WEIGHT). */
export const MAX_MOTIFS = 256;

/**
 * Facets a whole frame's motifs may draw, across all its bands and courses:
 * six crafted bands of tiny rivetted plates were 145k facets and half a second
 * a bake on every client with no budget, and still 62k with a budget counted
 * in plates (each rivet is ten facets). Counted at full detail (motifFacets),
 * so how many stones a band holds never depends on the tier it is baked at.
 */
export const FRAME_FACET_BUDGET = 12_000;

/** The motifs a course of this band may hold under the frame's facet budget (3 at least). */
export function motifBudget(
  bandCount: number,
  courses: number,
  generator: string,
  params: Record<string, FrameParamValue>,
): number {
  const share = bandCount * courses * motifFacets(generator, params);
  return Math.max(3, Math.floor(FRAME_FACET_BUDGET / share));
}

/** The most facets one motif draws with these params, every detail shown. */
export function motifFacets(generator: string, params: Record<string, FrameParamValue>): number {
  switch (generator) {
    case "plate": // a block, its lip or a six-ripple bead, a ten-facet rivet per row at up to 3 places
      return 6 + (params.weld === true ? 6 : 1) + 30 * num(params, "rivetRows");
    case "plank": // a block, three ten-step grain lines, a knot, two nails a row
      return 6 + 30 + 10 + 20 * num(params, "nails");
    case "masonry": // a cobble's ten facets and a two-step crack
      return 12;
    default:
      return 1;
  }
}

/** How many motifs `length` holds at `motif` each, by the repeat rule: at least 3, at most `max`. */
export function motifCount(length: number, motif: number, max = MAX_MOTIFS): number {
  return Math.min(max, MAX_MOTIFS, Math.max(3, Math.round(length / motif)));
}

/** A shape's v coordinates held inside the band (jitter must not leave the bitmap). */
export function clampAcross(points: number[], top = 0, bottom = 1): number[] {
  for (let index = 1; index < points.length; index += 2) {
    points[index] = Math.min(bottom, Math.max(top, points[index]!));
  }
  return points;
}

export const num = (params: Record<string, FrameParamValue>, name: string): number =>
  params[name] as number;

/** `count` draws at once, ALWAYS all of them: a motif's stream never depends on its params. */
export function draws(rng: SeededRng, count: number): number[] {
  const out: number[] = new Array(count);
  for (let index = 0; index < count; index += 1) out[index] = rng();
  return out;
}

/** Plain lengths that sum to `total`, each varied by up to ±`spread` (0–1) of its share. */
export function splitLength(
  total: number,
  count: number,
  spread: number,
  rolls: number[],
): number[] {
  const raw = Array.from({ length: count }, (_, index) => 1 + spread * (rolls[index]! * 2 - 1));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return raw.map((value) => (value / sum) * total);
}

/** One motif's place along a course: where it starts and how long it is, in u. */
export interface Laid {
  at: number;
  length: number;
  /** On a polygon, the side it lies on: jitter must keep the motif inside it (clampAlong). */
  side?: [number, number];
}

/**
 * A course's motifs end to end, `count` of them by the repeat rule, their
 * lengths varied by `spread` with `rolls`. Round a circle they start at a
 * seeded `phase` and a `shift`ed course starts half a motif on (a running
 * bond). Round a polygon (CORNER-AWARE) every side between two corners gets
 * its own share, so a joint falls on every corner and no motif folds round
 * one; a shifted course there starts and ends each side with a half motif,
 * as a quoin would.
 */
export function layCourse(
  context: Pick<GeneratorContext, "length" | "corners">,
  count: number,
  spread: number,
  rolls: number[],
  phase: number,
  shift: boolean,
): Laid[] {
  const { length, corners } = context;
  const laid: Laid[] = [];
  if (!corners || corners.length === 0) {
    const lengths = splitLength(length, count, spread, rolls);
    let u = phase * (length / count) + (shift ? lengths[0]! / 2 : 0);
    for (const piece of lengths) {
      laid.push({ at: u, length: piece });
      u += piece;
    }
    return laid;
  }
  const spans = corners.map(
    (corner, index) =>
      (index + 1 < corners.length ? corners[index + 1]! : corners[0]! + length) - corner,
  );
  // A shifted course lays each side with a half motif at both ends (one more
  // piece a side), so it takes one fewer whole share a side: the course keeps
  // its budget either way (motifBudget).
  const shares = shareOut(spans, Math.max(corners.length, shift ? count - corners.length : count));
  let used = 0;
  corners.forEach((corner, index) => {
    const share = shares[index]!;
    const own = Array.from({ length: share }, (_, at) => rolls[(used + at) % rolls.length]!);
    used += share;
    const lengths = splitLength(spans[index]!, share, spread, own);
    const pieces = shift ? [lengths[0]! / 2, ...lengths.slice(1), lengths[0]! / 2] : lengths;
    const side: [number, number] = [corner, corner + spans[index]!];
    let u = corner;
    for (const piece of pieces) {
      laid.push({ at: u, length: piece, side });
      u += piece;
    }
  });
  return laid;
}

/** `total` shares among sides by length, at least one each (largest remainder): they sum to `total`. */
function shareOut(spans: readonly number[], total: number): number[] {
  const length = spans.reduce((sum, span) => sum + span, 0);
  const extra = Math.max(0, total - spans.length);
  const exact = spans.map((span) => (extra * span) / length);
  const shares = exact.map((value) => 1 + Math.floor(value));
  let left = total - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    shares[index]! += 1;
    left -= 1;
  }
  return shares;
}

/** A shape's u coordinates held inside its side (jitter must not carry it round a corner). */
export function clampAlong(points: number[], side: [number, number] | undefined): number[] {
  if (!side) return points;
  for (let index = 0; index < points.length; index += 2) {
    points[index] = Math.min(side[1], Math.max(side[0], points[index]!));
  }
  return points;
}

/** A polygon's centroid (vertex mean: motifs are convex enough for lighting). */
export function centroid(points: readonly number[]): [number, number] {
  let u = 0;
  let v = 0;
  const count = points.length / 2;
  for (let index = 0; index < count; index += 1) {
    u += points[index * 2]!;
    v += points[index * 2 + 1]!;
  }
  return [u / count, v / count];
}

/** Each vertex pulled toward the centre by up to `du` along u and `dv` across, never past it. */
export function insetPolygon(points: readonly number[], du: number, dv: number): number[] {
  const [cu, cv] = centroid(points);
  const out: number[] = [];
  for (let index = 0; index < points.length; index += 2) {
    const u = points[index]!;
    const v = points[index + 1]!;
    const pullU = Math.min(du, Math.abs(cu - u) * 0.8);
    const pullV = Math.min(dv, Math.abs(cv - v) * 0.8);
    out.push(u + Math.sign(cu - u) * pullU, v + Math.sign(cv - v) * pullV);
  }
  return out;
}

/**
 * A raised block: its outline (the dark edge), then a ring of bevel facets
 * falling away from its centre at `pitch`, then its flat top. `outline` and
 * `bevel` are the inward distances (u, v) of the bevel's outer edge and of
 * the top face.
 */
export function bevelledBlock(
  shape: readonly number[],
  outline: [number, number],
  bevel: [number, number],
  pitch: number,
): Facet[] {
  const facets: Facet[] = [{ role: "outline", points: [...shape] }];
  const rim = insetPolygon(shape, outline[0], outline[1]);
  const top = insetPolygon(shape, outline[0] + bevel[0], outline[1] + bevel[1]);
  const from = centroid(shape);
  const count = shape.length / 2;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    facets.push({
      role: "bevel",
      points: [
        rim[index * 2]!,
        rim[index * 2 + 1]!,
        rim[next * 2]!,
        rim[next * 2 + 1]!,
        top[next * 2]!,
        top[next * 2 + 1]!,
        top[index * 2]!,
        top[index * 2 + 1]!,
      ],
      tilt: { pitch, from },
    });
  }
  facets.push({ role: "top", points: top });
  return facets;
}

/**
 * A dome (rivet, nail head) of radius `r` at (u, v): a dark rim, sloped sides,
 * a lit cap. `uScale` widens it along u (a course's u units are shorter inside).
 */
export function dome(u: number, v: number, r: number, uScale = 1): Facet[] {
  const sides = 8;
  const ring = (radius: number) => {
    const points: number[] = [];
    for (let index = 0; index < sides; index += 1) {
      const angle = (index / sides) * Math.PI * 2;
      points.push(u + Math.cos(angle) * radius * uScale, v + Math.sin(angle) * radius);
    }
    return points;
  };
  const outer = ring(r);
  const inner = ring(r * 0.78);
  const cap = ring(r * 0.38);
  const facets: Facet[] = [{ role: "outline", points: outer }];
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    facets.push({
      role: "bevel",
      points: [
        inner[index * 2]!,
        inner[index * 2 + 1]!,
        inner[next * 2]!,
        inner[next * 2 + 1]!,
        cap[next * 2]!,
        cap[next * 2 + 1]!,
        cap[index * 2]!,
        cap[index * 2 + 1]!,
      ],
      tilt: { pitch: 42, from: [u, v] },
    });
  }
  facets.push({ role: "top", points: cap });
  return facets;
}

/** A thin stroke through `path` ([u0, v0, u1, v1, …]), `width` across, one quad per step. */
export function stroke(
  path: readonly number[],
  width: number,
  role: Facet["role"],
  alpha = 1,
): Facet[] {
  const facets: Facet[] = [];
  for (let index = 0; index + 3 < path.length; index += 2) {
    const u0 = path[index]!;
    const v0 = path[index + 1]!;
    const u1 = path[index + 2]!;
    const v1 = path[index + 3]!;
    const length = Math.hypot(u1 - u0, v1 - v0) || 1;
    const nu = (-(v1 - v0) / length) * (width / 2);
    const nv = ((u1 - u0) / length) * (width / 2);
    facets.push({
      role,
      points: [u0 + nu, v0 + nv, u1 + nu, v1 + nv, u1 - nu, v1 - nv, u0 - nu, v0 - nv],
      alpha,
    });
  }
  return facets;
}
