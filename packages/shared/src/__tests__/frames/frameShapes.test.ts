/**
 * Frame shapes (C5b): the outlines a frame is laid round, the warp onto them,
 * and the corner-aware motifs. Each outline must fit the token box at level
 * 0.5, keep its vertices at every level, and move its edges in parallel; the
 * warp must put a corner on one straight mitre across the band; planks, plates
 * and stones must end on every corner; and a mitre must never let the map show
 * through.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bakeFrame, frameSeed, presetFrame, type FrameShape } from "../../index.js";
import {
  edgeNormalsOf,
  shapeCorners,
  shapeOutline,
  type PolygonShape,
} from "../../frames/engine/shapes.js";
import { makeRibbon, ribbonPoint } from "../../frames/engine/shapeRibbon.js";
import { layCourse, FRAME_FACET_BUDGET, shareOut } from "../../frames/engine/generators/common.js";
import { coursesFor } from "../../frames/engine/bandSpace.js";
import { levelScale } from "../../frames/engine/shapeRibbon.js";
import { FRAME_GENERATORS } from "../../frames/engine/generators/index.js";
import { createSeededRng } from "../../rng.js";
import {
  framePaints,
  insideOutline,
  resolveFrameParams,
  shapeOutline as outlineOf,
} from "../../index.js";

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
      // a squircle's corners are its rounded corners' middles: gentle at the box, sharp in a heavy frame
      const level = shape === "squircle" ? 0.16 : 0.5;
      for (const index of corners) {
        expect(turn(shapeOutline(shape, level), index), shape).toBeGreaterThan(40);
      }
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

describe("polygon frames, after review round 1", () => {
  const opaque = (
    shape: PolygonShape,
    id: string,
    weight: number,
    growth: "in" | "out" | "mid" = "in",
  ) => {
    const frame = { ...presetFrame(id, weight)!, shape, growth };
    const tier = 256;
    const { pixels, layout } = bakeFrame({ frame, accent: "#4f7cc4", seed: frameSeed("t"), tier });
    const scale = tier / (2 * layout.extent);
    const pad = 2 / scale;
    // every pixel between the window and the outer edge, two pixels in from each, by the outlines alone
    const outer = outlineOf(shape, layout.outer - pad);
    const window = outlineOf(shape, layout.window + pad);
    let holes = 0;
    for (let y = 0; y < tier; y += 1) {
      for (let x = 0; x < tier; x += 1) {
        const tx = (x + 0.5) / scale - layout.extent;
        const ty = (y + 0.5) / scale - layout.extent;
        if (!insideOutline(outer, tx, ty) || insideOutline(window, tx, ty)) continue;
        if (pixels[(y * tier + x) * 4 + 3]! < 250) holes += 1;
      }
    }
    return holes;
  };

  it.each(["shield", "squircle", "square", "hexagon", "octagon"] as const)(
    "covers the whole band of a heavy %s, corners included",
    { timeout: 30_000 },
    (shape) => {
      for (const weight of [0.16, 0.28, 0.34]) {
        for (const growth of ["in", "out", "mid"] as const) {
          for (const id of ["stone.castle", "plain.ring", "wood.oak"]) {
            expect(
              opaque(shape, id, weight, growth),
              `${id} on a ${shape} at ${weight} ${growth}`,
            ).toBe(0);
          }
        }
      }
    },
  );

  it("keeps a jittered stone inside its side: rubble and cobble never cross a corner", () => {
    const ribbon = makeRibbon("square", 0.4, 0.5);
    for (const bond of ["rubble", "cobble"]) {
      const facets = FRAME_GENERATORS.masonry!({
        length: ribbon.length,
        courses: 1,
        courseScale: () => 1,
        params: resolveFrameParams("masonry", { bond, irregularity: 1, gap: 0 }),
        rng: createSeededRng(3),
        maxMotifs: 256,
        bandPx: 200,
        corners: ribbon.corners,
      });
      for (const facet of facets.slice(1)) {
        const us = facet.points.filter((_, index) => index % 2 === 0);
        for (const corner of ribbon.corners) {
          const across = Math.min(...us) < corner - 1e-9 && Math.max(...us) > corner + 1e-9;
          expect(across, `${bond} across ${corner}`).toBe(false);
        }
      }
    }
  });

  it("keeps a course to its budget on a many-sided shape", () => {
    const ribbon = makeRibbon("octagon", 0.4, 0.5);
    for (const shift of [false, true]) {
      const laid = layCourse(ribbon, 40, 0.1, [0.5], 0.5, shift);
      expect(laid.length, `shifted ${shift}`).toBeLessThanOrEqual(40);
    }
    const plates = [...Array(6)].map(() => ({
      generator: "plate",
      palette: "metal.iron",
      weight: 0.0333,
      depth: 0.6,
      params: { plateLength: 1, rivetRows: 3, rivetSize: 0.3 },
    }));
    const frame = { shape: "octagon" as const, bands: plates };
    const paints = framePaints({
      frame,
      size: "gargantuan",
      accent: "#000",
      seed: 1,
      tier: 1024,
    }).paints;
    expect(paints.length).toBeLessThan(FRAME_FACET_BUDGET + 8000);
  });

  it("lights a hexagon's bevel from the top left: its up-left edge brighter than its down-right", () => {
    const frame = { ...presetFrame("plain.chamfer", 0.16)!, shape: "hexagon" as const };
    const tier = 512;
    const { pixels, layout } = bakeFrame({ frame, accent: "#808080", seed: 1, tier });
    const scale = tier / (2 * layout.extent);
    const lum = (x: number, y: number) => {
      const at =
        (Math.floor((y + layout.extent) * scale) * tier + Math.floor((x + layout.extent) * scale)) *
        4;
      return pixels[at]! + pixels[at + 1]! + pixels[at + 2]!;
    };
    // just inside the outer edge, at the middle of the up-left side and of the down-right side
    const apothem = outlineOf("hexagon", layout.outer)[1]! * -1 - 1.5 / scale;
    const upLeft = lum(-apothem * Math.sin(Math.PI / 3), -apothem * Math.cos(Math.PI / 3));
    const downRight = lum(apothem * Math.sin(Math.PI / 3), apothem * Math.cos(Math.PI / 3));
    expect(upLeft).toBeGreaterThan(downRight + 30);
  });

  it("shades the window's edge along the hexagon's sides, and a grown-out square's corner on the map", () => {
    const hexagon = { ...presetFrame("plain.ring", 0.1)!, shape: "hexagon" as const };
    const tier = 512;
    const baked = bakeFrame({ frame: hexagon, accent: "#808080", seed: 1, tier });
    const scale = tier / (2 * baked.layout.extent);
    const alphaAt = (pixels: Uint8ClampedArray, extent: number, x: number, y: number) =>
      pixels[(Math.floor((y + extent) * scale) * tier + Math.floor((x + extent) * scale)) * 4 + 3]!;
    // inside the window, just under its top side: the contact shadow
    const top = outlineOf("hexagon", baked.layout.window)[1]!;
    expect(alphaAt(baked.pixels, baked.layout.extent, 0, top + 2 / scale)).toBeGreaterThan(0);
    const square = {
      ...presetFrame("plain.ring", 0.16)!,
      shape: "square" as const,
      growth: "out" as const,
    };
    const out = bakeFrame({ frame: square, accent: "#808080", seed: 1, tier });
    const outScale = tier / (2 * out.layout.extent);
    const corner = out.layout.outer + 1.5 / outScale; // past the bottom-right corner, where the shadow falls
    const at =
      (Math.floor((corner + out.layout.extent) * outScale) * tier +
        Math.floor((corner + out.layout.extent) * outScale)) *
      4;
    expect(out.pixels[at + 3]!).toBeGreaterThan(0);
  });

  it("gives the squircle straight sides 1 - 2 × 0.22 long at the token box", () => {
    const points = shapeOutline("squircle", 0.5);
    // the top side runs from the top-left arc's end to the top-right arc's start
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 === 1);
    const onTop = xs.filter((_, index) => Math.abs(ys[index]! + 0.5) < 1e-9);
    expect(Math.max(...onTop) - Math.min(...onTop)).toBeCloseTo(1 - 2 * 0.22, 9);
  });

  it("sets the notch's tip on the frame's top edge, for every shape", () => {
    for (const shape of ["circle", "squircle", "square", "hexagon", "octagon", "shield"] as const) {
      const frame = { ...presetFrame("plain.ring", 0.1)!, shape };
      const tier = 256;
      const plain = bakeFrame({ frame, accent: "#4f7cc4", seed: 1, tier });
      const gem = bakeFrame({
        frame: { ...frame, notch: { gem: "arrow" as const } },
        accent: "#4f7cc4",
        seed: 1,
        tier,
      });
      const { layout } = gem;
      const scale = tier / (2 * layout.extent);
      let topmost = tier;
      for (let y = 0; y < tier && topmost === tier; y += 1) {
        for (let x = 0; x < tier; x += 1) {
          const at = (y * tier + x) * 4;
          if (gem.pixels[at + 3] !== plain.pixels[at + 3] || gem.pixels[at] !== plain.pixels[at]) {
            topmost = y;
            break;
          }
        }
      }
      const edge = shape === "circle" ? -layout.outer : outlineOf(shape, layout.outer)[1]!;
      const edgePx = (edge + layout.extent) * scale;
      expect(Math.abs(topmost - edgePx), shape).toBeLessThan(1.5);
    }
  });
  it("puts a joint at each of the squircle's four rounded corners", () => {
    expect(shapeCorners("squircle")).toHaveLength(4);
    const ribbon = makeRibbon("squircle", 0.26, 0.5); // slab: the window's corners are sharp
    const laid = layCourse(ribbon, 24, 0.1, [0.4], 0.5, false);
    for (const corner of ribbon.corners) {
      expect(laid.some((piece) => Math.abs(piece.at - corner) < 1e-9)).toBe(true);
    }
  });

  it("draws a hexagon's depth steps inside its shape, along its own sides", () => {
    const welded = { ...presetFrame("metal.welded", 0.16)!, shape: "hexagon" as const };
    const flat = { ...welded, bands: welded.bands.map((band) => ({ ...band, depth: 0.6 })) };
    const tier = 256;
    const stepped = bakeFrame({ frame: welded, accent: "#808080", seed: 1, tier });
    const level = bakeFrame({ frame: flat, accent: "#808080", seed: 1, tier });
    const { layout } = stepped;
    const scale = tier / (2 * layout.extent);
    const outline = outlineOf("hexagon", layout.outer + 1 / scale);
    let changed = 0;
    for (let y = 0; y < tier; y += 1) {
      for (let x = 0; x < tier; x += 1) {
        const at = (y * tier + x) * 4;
        if (
          stepped.pixels[at + 3] === level.pixels[at + 3] &&
          stepped.pixels[at] === level.pixels[at]
        )
          continue;
        changed += 1;
        const tx = (x + 0.5) / scale - layout.extent;
        const ty = (y + 0.5) / scale - layout.extent;
        expect(insideOutline(outline, tx, ty), `a step at (${x}, ${y})`).toBe(true);
      }
    }
    expect(changed).toBeGreaterThan(50);
  });
  it("lights a shield's edges as they face at every level: a shrunk side has no normal of its own", () => {
    for (let level = 0.13; level < 0.37; level += 0.001) {
      const normals = edgeNormalsOf(shapeOutline("shield", level));
      const count = normals.length / 2;
      for (const side of [1, count - 2]) {
        // the straight sides, right then left: facing straight out, or shrunk to nothing (0, 0)
        const [nx, ny] = [normals[side * 2]!, normals[side * 2 + 1]!];
        const shrunk = nx === 0 && ny === 0;
        expect(
          shrunk || Math.abs(Math.abs(nx) - 1) < 1e-6,
          `level ${level.toFixed(3)}, side ${side}: ${nx}, ${ny}`,
        ).toBe(true);
        if (!shrunk) expect(Math.sign(nx), `level ${level.toFixed(3)}`).toBe(side === 1 ? 1 : -1);
      }
    }
  });

  it("lays a short shifted course unshifted, inside its budget", () => {
    const ribbon = makeRibbon("octagon", 0.4, 0.5);
    for (const count of [3, 5, 8, 10, 12, 15]) {
      const laid = layCourse(ribbon, count, 0.1, [0.5], 0.5, true);
      expect(laid.length, `count ${count}`).toBeLessThanOrEqual(Math.max(count, 8));
    }
  });

  it("ends steel's streaks at a corner", () => {
    const ribbon = makeRibbon("square", 0.4, 0.5);
    const facets = FRAME_GENERATORS.plain!({
      length: ribbon.length,
      courses: 1,
      courseScale: () => 1,
      params: resolveFrameParams("plain", { grain: 1 }),
      rng: createSeededRng(1),
      maxMotifs: 256,
      bandPx: 200,
      corners: ribbon.corners,
    });
    expect(facets.length).toBeGreaterThan(20);
    for (const facet of facets.slice(1)) {
      const us = facet.points.filter((_, index) => index % 2 === 0);
      for (const corner of [...ribbon.corners, ribbon.corners[0]! + ribbon.length]) {
        const across = Math.min(...us) < corner - 1e-6 && Math.max(...us) > corner + 1e-6;
        expect(across, `a streak across ${corner}`).toBe(false);
      }
    }
  });
});

describe("polygon frames, after review round 3", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shares a course's spare motifs among equal sides by index, never by the last bit", () => {
    // a square's sides as one engine's hypot sums them, and as another's might
    for (const nudge of [0, 1e-14, -1e-14]) {
      const spans = [9 + 3.6e-15, 9 + nudge, 9 + 3.6e-15 - nudge, 9];
      expect(shareOut(spans, 13), `nudged ${nudge}`).toEqual([4, 3, 3, 3]);
    }
    const octagon = [...Array(8)].map((_, index) => 3.72792206135786 - (index === 7 ? 5e-15 : 0));
    expect(shareOut(octagon, 31)).toEqual([4, 4, 4, 4, 4, 4, 4, 3]);
  });

  it("lays a polygon's courses by its own taper: a hexagon's thick band takes two where a circle's takes one", () => {
    // 0.30 to 0.5: the circle's inner edge is 0.6 of its outer (one course); the hexagon's 0.54
    expect(coursesFor(0.3 / 0.5)).toBe(1);
    expect(levelScale("hexagon", 0.3, 0.5)).toBeLessThan(0.6);
    const courses: Record<string, number> = {};
    const masonry = FRAME_GENERATORS.masonry!;
    for (const shape of ["circle", "hexagon"] as const) {
      const spy = vi.spyOn(FRAME_GENERATORS, "masonry").mockImplementation((context) => {
        courses[shape] = context.courses;
        return masonry(context);
      });
      const frame = { ...presetFrame("stone.castle", 0.2)!, shape, growth: "in" as const };
      bakeFrame({ frame, accent: "#4f7cc4", seed: 1, tier: 64 });
      spy.mockRestore();
    }
    expect(courses).toEqual({ circle: 1, hexagon: 2 });
  });
});
