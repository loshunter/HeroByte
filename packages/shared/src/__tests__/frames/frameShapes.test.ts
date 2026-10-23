/**
 * Frame shapes (C5b): the outlines a frame is laid round, the warp onto them,
 * and the corner-aware motifs. Each outline must fit the token box at level
 * 0.5, keep its vertices at every level, and move its edges in parallel; the
 * warp must put a corner on one straight mitre across the band; planks, plates
 * and stones must end on every corner; and a mitre must never let the map show
 * through.
 */

import { describe, expect, it } from "vitest";
import { bakeFrame, frameSeed, presetFrame, type FrameShape } from "../../index.js";
import { shapeCorners, shapeOutline, type PolygonShape } from "../../frames/engine/shapes.js";
import { makeRibbon, ribbonPoint } from "../../frames/engine/shapeRibbon.js";
import { layCourse } from "../../frames/engine/generators/common.js";

const SHAPES: PolygonShape[] = ["squircle", "square", "hexagon", "octagon", "shield"];
const LEVELS = [0.16, 0.26, 0.4, 0.5, 0.58, 0.65];

const vertex = (points: number[], index: number): [number, number] => [
  points[index * 2]!,
  points[index * 2 + 1]!,
];
/** The turn at vertex `index`, degrees (0: straight on), past any points that coincide with it. */
function turn(points: number[], index: number): number {
  const count = points.length / 2;
  const [bx, by] = vertex(points, index);
  const apart = (step: number) => {
    for (let at = index + step, n = 1; n < count; at += step, n += 1) {
      const [x, y] = vertex(points, (at + count) % count);
      if (Math.hypot(x - bx, y - by) > 1e-9) return [x, y] as const;
    }
    return [bx, by] as const;
  };
  const [ax, ay] = apart(-1);
  const [cx, cy] = apart(1);
  const a = Math.atan2(by - ay, bx - ax);
  const b = Math.atan2(cy - by, cx - bx);
  return Math.abs(((((b - a) * 180) / Math.PI + 540) % 360) - 180);
}
/** Distance from (x, y) to the segment a-b. */
function toSegment(x: number, y: number, a: [number, number], b: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}
const toOutline = (points: number[], x: number, y: number) => {
  let best = Infinity;
  const count = points.length / 2;
  for (let index = 0; index < count; index += 1) {
    best = Math.min(
      best,
      toSegment(x, y, vertex(points, index), vertex(points, (index + 1) % count)),
    );
  }
  return best;
};

describe("the shapes' outlines", () => {
  it("fit the token box at level 0.5, touching it, and start at the top centre", () => {
    for (const shape of SHAPES) {
      const points = shapeOutline(shape, 0.5);
      expect(Math.max(...points.map(Math.abs)), shape).toBeCloseTo(0.5, 9);
      expect(points[0]).toBeCloseTo(0, 12);
      expect(points[1]!).toBeLessThan(0);
    }
  });

  it("keep the same vertices at every level, so a band's edges correspond point for point", () => {
    for (const shape of SHAPES) {
      const count = shapeOutline(shape, 0.5).length;
      for (const level of LEVELS) expect(shapeOutline(shape, level).length, shape).toBe(count);
    }
  });

  it("move every edge in parallel: each point of one level is the level difference from the other", () => {
    for (const shape of SHAPES) {
      for (const [low, high] of [
        [0.16, 0.5],
        [0.4, 0.65],
      ] as const) {
        const outer = shapeOutline(shape, high);
        const inner = shapeOutline(shape, low);
        // every edge midpoint of the inner outline sits (high - low) from the outer outline
        for (let index = 0; index < inner.length / 2; index += 1) {
          const [ax, ay] = vertex(inner, index);
          const [bx, by] = vertex(inner, (index + 1) % (inner.length / 2));
          if (Math.hypot(bx - ax, by - ay) < 1e-6) continue; // a squircle corner shrunk to a point
          expect(
            toOutline(outer, (ax + bx) / 2, (ay + by) / 2),
            `${shape} ${low}-${high}`,
          ).toBeCloseTo(high - low, 2);
        }
      }
    }
  });

  it("turn sharply only at their corners, and never fold back on themselves", () => {
    for (const shape of SHAPES) {
      const corners = new Set(shapeCorners(shape));
      for (const level of LEVELS) {
        const points = shapeOutline(shape, level);
        for (let index = 0; index < points.length / 2; index += 1) {
          const angle = turn(points, index);
          expect(angle, `${shape} at ${level}, vertex ${index}`).toBeLessThan(150);
          if (!corners.has(index) && level === 0.5)
            expect(angle, `${shape} vertex ${index}`).toBeLessThan(31);
        }
      }
      for (const index of corners)
        expect(turn(shapeOutline(shape, 0.5), index)).toBeGreaterThan(40);
    }
  });
});

describe("the warp onto a polygon", () => {
  it("puts v = 0 on the inner outline, v = 1 on the outer, and u = 0 at the top centre", () => {
    for (const shape of SHAPES) {
      const ribbon = makeRibbon(shape, 0.4, 0.5);
      for (let step = 0; step < 50; step += 1) {
        const u = (step / 50) * ribbon.length;
        expect(toOutline(ribbon.inner, ...ribbonPoint(ribbon, u, 0)), shape).toBeLessThan(1e-9);
        expect(toOutline(ribbon.outer, ...ribbonPoint(ribbon, u, 1)), shape).toBeLessThan(1e-9);
      }
      const [x, y] = ribbonPoint(ribbon, 0, 1);
      expect(x).toBeCloseTo(0, 9);
      expect(y).toBeLessThan(0);
      // u is length along the band's middle: an eighth of the way round a square is its corner
      if (shape === "square") {
        const [cx, cy] = ribbonPoint(ribbon, ribbon.length / 8, 0.5);
        expect(cx).toBeCloseTo(0.45, 9);
        expect(cy).toBeCloseTo(-0.45, 9);
        const [mx, my] = ribbonPoint(ribbon, ribbon.length / 16, 0.5);
        expect(mx).toBeCloseTo(0.225, 9);
        expect(my).toBeCloseTo(-0.45, 9);
      }
      // once round closes on itself
      const [x1, y1] = ribbonPoint(ribbon, ribbon.length, 0.5);
      const [x0, y0] = ribbonPoint(ribbon, 0, 0.5);
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(1e-9);
    }
  });

  it("lays a corner on one straight line across the band, from inner corner to outer corner", () => {
    for (const shape of ["square", "hexagon", "octagon", "shield"] as const) {
      const ribbon = makeRibbon(shape, 0.3, 0.5);
      shapeCorners(shape).forEach((corner, at) => {
        const u = ribbon.corners[at]!;
        const inner = vertex(ribbon.inner, corner);
        const outer = vertex(ribbon.outer, corner);
        for (const v of [0, 0.25, 0.5, 0.75, 1]) {
          const [x, y] = ribbonPoint(ribbon, u, v);
          expect(toSegment(x, y, inner, outer), `${shape} corner ${corner}`).toBeLessThan(1e-9);
        }
      });
    }
  });
});

describe("corner-aware motifs", () => {
  it("end on every corner, and no motif runs round one", () => {
    const ribbon = makeRibbon("hexagon", 0.4, 0.5);
    for (const shift of [false, true]) {
      const laid = layCourse(ribbon, 20, 0.15, [0.1, 0.9, 0.4, 0.7, 0.2], 0.37, shift);
      const joints = laid.map((piece) => piece.at);
      for (const corner of ribbon.corners) {
        expect(
          joints.some((joint) => Math.abs(joint - corner) < 1e-9),
          `joint at ${corner}`,
        ).toBe(true);
      }
      for (const piece of laid) {
        for (const corner of ribbon.corners) {
          const inside = corner > piece.at + 1e-9 && corner < piece.at + piece.length - 1e-9;
          expect(inside, `a piece from ${piece.at} runs over ${corner}`).toBe(false);
        }
      }
      // the course still goes once round
      const total = laid.reduce((sum, piece) => sum + piece.length, 0);
      expect(total).toBeCloseTo(ribbon.length, 9);
    }
  });

  it("leave the circle's course as it was (no corners: the seeded phase and the running bond)", () => {
    const laid = layCourse({ length: 30 }, 10, 0, Array(10).fill(0.5), 0.5, true);
    expect(laid[0]!.at).toBeCloseTo(0.5 * 3 + 1.5, 9);
    expect(laid).toHaveLength(10);
  });
});

describe("a polygon frame baked", () => {
  it("lets no map show through at a mitre", () => {
    for (const shape of ["square", "hexagon", "octagon", "shield"] as FrameShape[]) {
      for (const id of ["plain.ring", "stone.castle", "metal.welded"]) {
        const frame = { ...presetFrame(id, 0.16)!, shape };
        const tier = 256;
        const { pixels, layout } = bakeFrame({
          frame,
          accent: "#4f7cc4",
          seed: frameSeed("t"),
          tier,
        });
        const scale = tier / (2 * layout.extent);
        const ribbon = makeRibbon(shape as PolygonShape, layout.window, layout.outer);
        shapeCorners(shape as PolygonShape).forEach((corner) => {
          const inner = vertex(ribbon.inner, corner);
          const outer = vertex(ribbon.outer, corner);
          // along the mitre, two pixels in from each edge
          const span = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]);
          const margin = 2 / scale / span;
          for (let t = margin; t <= 1 - margin; t += 0.05) {
            const x = Math.floor((inner[0] + (outer[0] - inner[0]) * t + layout.extent) * scale);
            const y = Math.floor((inner[1] + (outer[1] - inner[1]) * t + layout.extent) * scale);
            expect(pixels[(y * tier + x) * 4 + 3], `${id} on a ${shape}, corner ${corner}`).toBe(
              255,
            );
          }
        });
      }
    }
  });

  it("reaches past the box only by its growth, and holds its shield point in the bitmap", () => {
    const frame = {
      ...presetFrame("stone.castle", 0.24)!,
      shape: "shield" as const,
      growth: "out" as const,
    };
    const { pixels, layout, tier } = bakeFrame({ frame, accent: "#4f7cc4", seed: 1, tier: 128 });
    for (let at = 0; at < tier; at += 1) {
      expect(pixels[((tier - 1) * tier + at) * 4 + 3]).toBe(0); // the bottom row stays clear
    }
    expect(layout.extent).toBeGreaterThan(layout.outer);
  });
});
