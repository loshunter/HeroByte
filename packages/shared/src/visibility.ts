// Visibility-polygon computation over compiled occlusion segments — the math
// behind fog of war. Lives in shared so the client can paint fog instantly
// from its snapshot and the server can later filter entities with the exact
// same geometry.
//
// Algorithm: angular sweep. Cast rays from the origin toward every segment
// endpoint (nudged a hair to either side to peek past corners), keep the
// nearest hit per ray, and connect the hits in angle order. Scene bounds are
// injected as segments so every ray terminates.

import type { BlockingSegment } from "./sceneCompiler.js";
import type { ScenePoint } from "./sceneGeometry.js";

interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CORNER_NUDGE = 1e-4;
const EPSILON = 1e-9;

export function computeVisionPolygon(
  origin: ScenePoint,
  segments: readonly BlockingSegment[],
  bounds: { width: number; height: number },
): ScenePoint[] {
  // The boundary box exists so rays terminate — it is NOT an occluder. The
  // live table is an infinite canvas, so a viewer can legitimately stand
  // OUTSIDE the document rect (tokens spawn at its top-left corner cell; one
  // drag up or left exits it). The box must strictly contain the origin or
  // the sweep degenerates to a zero-area polygon and fog swallows the
  // viewer's own token. Origins inside the rect keep the exact original box.
  const minX = origin.x <= 0 ? origin.x - 1 : 0;
  const minY = origin.y <= 0 ? origin.y - 1 : 0;
  const maxX = origin.x >= bounds.width ? origin.x + 1 : bounds.width;
  const maxY = origin.y >= bounds.height ? origin.y + 1 : bounds.height;
  const all: RawSegment[] = [
    ...segments,
    { x1: minX, y1: minY, x2: maxX, y2: minY },
    { x1: maxX, y1: minY, x2: maxX, y2: maxY },
    { x1: maxX, y1: maxY, x2: minX, y2: maxY },
    { x1: minX, y1: maxY, x2: minX, y2: minY },
  ];

  const angles: number[] = [];
  for (const segment of all) {
    for (const [x, y] of [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ]) {
      const angle = Math.atan2(y! - origin.y, x! - origin.x);
      angles.push(angle - CORNER_NUDGE, angle, angle + CORNER_NUDGE);
    }
  }

  const hits: { angle: number; x: number; y: number }[] = [];
  for (const angle of angles) {
    const hit = castRay(origin, angle, all);
    if (hit) {
      hits.push({ angle, x: hit.x, y: hit.y });
    }
  }

  hits.sort((a, b) => a.angle - b.angle);
  return hits.map((hit) => ({ x: hit.x, y: hit.y }));
}

/** Standard ray-casting parity test. Degenerate polygons contain nothing. */
export function pointInPolygon(point: ScenePoint, polygon: readonly ScenePoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y) {
      const crossX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < crossX) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function castRay(
  origin: ScenePoint,
  angle: number,
  segments: readonly RawSegment[],
): ScenePoint | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let nearest: number | null = null;

  for (const segment of segments) {
    const t = raySegmentDistance(origin, dx, dy, segment);
    if (t !== null && (nearest === null || t < nearest)) {
      nearest = t;
    }
  }

  if (nearest === null) return null;
  return { x: origin.x + dx * nearest, y: origin.y + dy * nearest };
}

// Distance t along the ray (origin + t * direction) where it crosses the
// segment, or null if it misses.
function raySegmentDistance(
  origin: ScenePoint,
  dx: number,
  dy: number,
  segment: RawSegment,
): number | null {
  const ex = segment.x2 - segment.x1;
  const ey = segment.y2 - segment.y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < EPSILON) return null;

  const ox = segment.x1 - origin.x;
  const oy = segment.y1 - origin.y;
  const t = (ox * ey - oy * ex) / denom;
  const u = (ox * dy - oy * dx) / denom;

  if (t >= EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return t;
  }
  return null;
}
