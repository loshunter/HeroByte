/**
 * Point-to-geometry distances for element selection.
 *
 * Pure arithmetic, tested in isolation because every interesting way these can
 * fail is arithmetic rather than wiring — and two of those ways (the clamp and
 * the zero-length segment) are invisible in any test that only checks a click
 * that already lands on a wall.
 */
import { describe, it, expect } from "vitest";
import { distanceToSegment, distanceToPolyline } from "../elementGeometry";

const p = (x: number, y: number) => ({ x, y });

describe("distanceToSegment", () => {
  it("measures perpendicular distance to a horizontal segment", () => {
    expect(distanceToSegment(p(5, 3), p(0, 0), p(10, 0))).toBe(3);
  });

  it("is zero for a point ON the segment", () => {
    expect(distanceToSegment(p(4, 0), p(0, 0), p(10, 0))).toBe(0);
  });

  it("CLAMPS past the end rather than measuring to the infinite line", () => {
    // The whole difference between this and distance-to-line. Without the
    // clamp, a click 40 units past the end of a short wall measures as 0 —
    // the nearest point on the INFINITE line is right there — and the wall
    // becomes selectable from far off its own end.
    expect(distanceToSegment(p(50, 0), p(0, 0), p(10, 0))).toBe(40);
    expect(distanceToSegment(p(-10, 0), p(0, 0), p(10, 0))).toBe(10);
  });

  it("handles a diagonal segment", () => {
    // (0,0)->(10,10); the point (10,0) is 5√2 from the line at its midpoint.
    expect(distanceToSegment(p(10, 0), p(0, 0), p(10, 10))).toBeCloseTo(Math.sqrt(50), 6);
  });

  it("treats a ZERO-LENGTH segment as a point instead of dividing by zero", () => {
    // Two identical points really do occur — a degenerate drag can commit one —
    // and the naive projection divides by exactly this value.
    const d = distanceToSegment(p(3, 4), p(0, 0), p(0, 0));
    expect(d).toBe(5);
    expect(Number.isNaN(d)).toBe(false);
  });
});

describe("distanceToPolyline", () => {
  it("returns the nearest of several segments", () => {
    // An L: the point sits 2 from the vertical leg and further from the rest.
    const line = [p(0, 0), p(10, 0), p(10, 10)];
    expect(distanceToPolyline(p(8, 5), line)).toBe(2);
  });

  it("is zero on any vertex or edge", () => {
    const line = [p(0, 0), p(10, 0), p(10, 10)];
    expect(distanceToPolyline(p(10, 0), line)).toBe(0);
    expect(distanceToPolyline(p(10, 7), line)).toBe(0);
  });

  it("treats a single point as a point", () => {
    expect(distanceToPolyline(p(3, 4), [p(0, 0)])).toBe(5);
  });

  it("is INFINITELY far when there is no geometry at all", () => {
    // So a caller comparing against a tolerance rejects it without its own
    // emptiness check — returning 0 here would make an empty element select
    // from anywhere on the map.
    expect(distanceToPolyline(p(1, 1), [])).toBe(Number.POSITIVE_INFINITY);
  });
});
