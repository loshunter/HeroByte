// Visibility-polygon computation over compiled occlusion segments — the math
// behind fog of war. Lives in shared so the client can paint fog instantly
// from its snapshot and the server can later filter entities with the exact
// same geometry.
//
// Algorithm: angular sweep. Cast rays from the origin toward every segment
// endpoint (nudged a hair to either side to peek past corners), keep the
// nearest hit per ray, and connect the hits in angle order. Scene bounds are
// injected as segments so every ray terminates.
//
// S7 added an optional sight RADIUS. The clip happens HERE, inside the one
// function both halves of the app already share, and the world->document
// conversion happens in `tokenVisionRadius` (visionRadius.ts), which both
// halves also share. That is deliberate: client fog and server entity filtering agree
// because they run the same code on the same numbers, not because two
// implementations were carefully kept in step. Every production caller should
// go through `computeViewerVisionPolygon`, which does both steps in one place.

import type { BlockingSegment } from "./sceneCompiler.js";
import type { ScenePoint, SceneTransform } from "./sceneGeometry.js";
import { inverseTransformScenePoint } from "./sceneGeometry.js";
import { tokenVisionRadius, type VisionRadius } from "./visionRadius.js";

interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const CORNER_NUDGE = 1e-4;
const EPSILON = 1e-9;

/**
 * How many extra rays trace the radius arc, chosen so the chord between two
 * neighbouring samples sits about ONE document pixel inside the true arc
 * (sagitta ~= r * pi^2 / (2 N^2), so N ~= pi * sqrt(r / 2)). Small radii stay
 * cheap; a huge one stays smooth. Deterministic — both halves derive the same
 * count from the same radius, which is what keeps their polygons identical.
 */
function arcSampleCount(radius: VisionRadius): number {
  const longest = Math.max(radius.x, radius.y);
  if (!Number.isFinite(longest)) return MIN_ARC_SAMPLES;
  const ideal = Math.ceil(Math.PI * Math.sqrt(longest / 2));
  return Math.min(MAX_ARC_SAMPLES, Math.max(MIN_ARC_SAMPLES, ideal));
}

const MIN_ARC_SAMPLES = 32;
const MAX_ARC_SAMPLES = 192;

export interface ViewerVisionInput {
  /** Viewer origin in WORLD pixels — a token's cell centre. */
  origin: ScenePoint;
  /** `Token.visionRadius`, in feet. Undefined means unlimited. */
  radiusFeet?: number | null;
  /** Vision-blocking segments, in document space. */
  segments: readonly BlockingSegment[];
  /** The compiled scene's document bounds. */
  bounds: { width: number; height: number };
  /** World pixels per grid square (`RoomState.gridSize`). */
  gridSize: number;
  /** Feet per grid square (`RoomState.gridSquareSize`, default 5). */
  gridSquareSize: number;
  /** The live map transform, when the DM has moved or scaled the published art. */
  mapTransform?: SceneTransform;
}

/**
 * One viewer's sight polygon, in document space — origin conversion, radius
 * conversion and sweep in a single call.
 *
 * This is the entry point every PRODUCTION caller uses (the client's FogLayer
 * and the server's vision filter), so the two can only ever produce the same
 * polygon for the same viewer. `computeVisionPolygon` stays exported for the
 * geometry's own tests; reaching for it from product code puts a second
 * conversion site back and forfeits the invariant.
 */
export function computeViewerVisionPolygon(input: ViewerVisionInput): ScenePoint[] {
  const { origin, radiusFeet, segments, bounds, gridSize, gridSquareSize, mapTransform } = input;
  const documentOrigin = mapTransform ? inverseTransformScenePoint(mapTransform, origin) : origin;
  const radius = tokenVisionRadius({ radiusFeet, gridSize, gridSquareSize, mapTransform });
  return computeVisionPolygon(documentOrigin, segments, bounds, radius);
}

export function computeVisionPolygon(
  origin: ScenePoint,
  segments: readonly BlockingSegment[],
  bounds: { width: number; height: number },
  /** Sight limit in DOCUMENT units. Omit (or null) for unlimited sight. */
  radius?: VisionRadius | null,
): ScenePoint[] {
  // A blind viewer has no polygon at all. Both consumers already handle an
  // empty one correctly — `pointInPolygon` rejects everything below three
  // vertices, and the fog renderer punches no hole — so this is the honest
  // representation of "sees nothing" rather than a special case.
  if (radius && (radius.x <= 0 || radius.y <= 0)) {
    return [];
  }

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
  // A segment entirely beyond the sight limit can neither be hit nor cast a
  // shadow that lands inside it — everything it hides is further away than it
  // is. Dropping it early is what makes a radius CHEAPER than unlimited sight
  // rather than dearer: the sweep costs 6*(M+4) rays each testing M+4
  // segments, so halving M quarters the work. The bounds box is never pruned;
  // it is what stops the rays.
  const reachable = radius
    ? segments.filter((s) => segmentWithinRadius(origin, radius, s))
    : segments;
  const all: RawSegment[] = [
    ...reachable,
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
  // Corner rays alone would render the sight limit as a polygon with as few
  // vertices as the room has corners — a four-walled room would clip a circle
  // to a square. These trace the arc itself, and are added ONLY when a radius
  // is set so an unlimited viewer's polygon is unchanged, vertex for vertex.
  if (radius) {
    const samples = arcSampleCount(radius);
    for (let i = 0; i < samples; i += 1) {
      angles.push((i * 2 * Math.PI) / samples - Math.PI);
    }
  }

  const hits: { angle: number; x: number; y: number }[] = [];
  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const wallDistance = nearestHitDistance(origin, dx, dy, all);
    const limit = radius ? rayDistanceToRadius(dx, dy, radius) : null;
    const distance =
      limit === null ? wallDistance : wallDistance === null ? limit : Math.min(wallDistance, limit);
    if (distance === null) continue;
    hits.push({ angle, x: origin.x + dx * distance, y: origin.y + dy * distance });
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

/**
 * Does any part of the segment fall inside the sight ellipse? Dividing both
 * endpoints by the semi-axes maps the ellipse to the unit circle, so this
 * reduces to the closest approach of a segment to the origin — exact, not a
 * bounding-box estimate, so no segment that could occlude is ever dropped.
 */
function segmentWithinRadius(
  origin: ScenePoint,
  radius: VisionRadius,
  segment: RawSegment,
): boolean {
  const ax = (segment.x1 - origin.x) / radius.x;
  const ay = (segment.y1 - origin.y) / radius.y;
  const bx = (segment.x2 - origin.x) / radius.x;
  const by = (segment.y2 - origin.y) / radius.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  // Clamped projection of the origin onto the segment; a degenerate segment
  // collapses to its first endpoint.
  const t = lengthSquared > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  const nearestX = ax + dx * t;
  const nearestY = ay + dy * t;
  return nearestX * nearestX + nearestY * nearestY <= 1;
}

/**
 * How far along a unit ray the sight ellipse is, or null when the ellipse is
 * unbounded in that direction. Normalising by the semi-axes turns the ellipse
 * back into a unit circle, where the crossing is just `1 / |normalised dir|`.
 */
function rayDistanceToRadius(dx: number, dy: number, radius: VisionRadius): number | null {
  const normalised = Math.hypot(dx / radius.x, dy / radius.y);
  if (!(normalised > 0) || !Number.isFinite(normalised)) return null;
  return 1 / normalised;
}

/** Distance to the nearest blocking segment along the ray, or null if it hits none. */
function nearestHitDistance(
  origin: ScenePoint,
  dx: number,
  dy: number,
  segments: readonly RawSegment[],
): number | null {
  let nearest: number | null = null;

  for (const segment of segments) {
    const t = raySegmentDistance(origin, dx, dy, segment);
    if (t !== null && (nearest === null || t < nearest)) {
      nearest = t;
    }
  }

  return nearest;
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
