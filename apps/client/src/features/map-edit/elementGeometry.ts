// Pure point-to-geometry distances for the "select" sub-tool.
//
// Its own module, and not merely for the LOC guard: nothing here knows what a
// MapDocument is. These are the two functions the hit test needs and the only
// two that are worth testing in isolation, because every interesting failure
// they have is arithmetic rather than wiring.
//
// Everything is DOCUMENT space. Callers convert local element points with
// `toWorld` from @herobyte/shared before handing them over — see the note on
// that export for why a second copy of that transform must never appear.

export interface Point {
  x: number;
  y: number;
}

/**
 * Shortest distance from `p` to the segment `a`→`b`.
 *
 * Projects onto the segment and CLAMPS to it, which is the whole difference
 * between this and distance-to-infinite-line: without the clamp, a click far
 * past the end of a short wall still measures as "on" it, because the nearest
 * point on the infinite line is nearby even though the wall is not.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  // A zero-length segment is a POINT, not a division by zero. Two identical
  // points really do occur — a degenerate drag can commit one — and the naive
  // projection divides by this exact value.
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Shortest distance from `p` to a polyline through `points`.
 *
 * A single point is a point (there is no segment to project onto); an empty
 * list is infinitely far, so a caller comparing against a tolerance rejects it
 * without needing its own emptiness check.
 */
export function distanceToPolyline(p: Point, points: readonly Point[]): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y);

  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = distanceToSegment(p, points[i]!, points[i + 1]!);
    if (d < nearest) nearest = d;
  }
  return nearest;
}
