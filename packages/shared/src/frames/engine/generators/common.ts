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
  /** 1, or 2 when the slivers rule lays the band in two courses. */
  courses: number;
  /** Middle radius of each course over the band's middle radius (a course's u is shorter inside). */
  courseScale: (course: number) => number;
  params: Record<string, FrameParamValue>;
  rng: SeededRng;
}

export type FrameGenerator = (context: GeneratorContext) => Facet[];

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
