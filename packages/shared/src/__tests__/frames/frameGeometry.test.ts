import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../rng.js";
import { presetFrame, resolveFrameParams, type TokenFrame, type TokenSize } from "../../index.js";
import {
  bandLength,
  courseCount,
  layoutFrame,
  warpPoint,
  warpPolygon,
  type BandRing,
  type Facet,
} from "../../frames/engine/bandSpace.js";
import { FRAME_GENERATORS } from "../../frames/engine/generators/index.js";
import { centroid } from "../../frames/engine/generators/common.js";

const ring = (r0: number, r1: number): BandRing => ({
  band: { generator: "plain", palette: "personal", weight: r1 - r0, depth: 0.5 },
  r0,
  r1,
});

function generate(generator: string, frame: TokenFrame, seed = 7, size?: TokenSize) {
  const layout = layoutFrame(frame, size);
  const target = layout.rings.find((entry) => entry.band.generator === generator)!;
  const length = bandLength(target);
  const courses = courseCount(target);
  const middle = (target.r0 + target.r1) / 2;
  const facets = FRAME_GENERATORS[generator]!({
    length,
    courses,
    courseScale: (course) =>
      (target.r0 + (target.r1 - target.r0) * ((course + 0.5) / courses)) / middle,
    params: resolveFrameParams(generator, target.band.params),
    rng: createSeededRng(seed),
  });
  return { facets, length, courses, ring: target };
}
const tops = (facets: Facet[]) => facets.filter((facet) => facet.role === "top");

describe("the frame layout", () => {
  it("keeps the outer edge on the token box when growing in", () => {
    const layout = layoutFrame(presetFrame("metal.welded")!);
    expect(layout.outer).toBe(0.5);
    expect(layout.window).toBeCloseTo(0.4);
    expect(layout.outset).toBe(0);
    expect(layout.rings.map((entry) => entry.r1 - entry.r0)).toEqual([
      expect.closeTo(0.015),
      expect.closeTo(0.07),
      expect.closeTo(0.015),
    ]);
  });

  it("keeps the window on the box growing out, the reach capped at 0.15", () => {
    const out = layoutFrame({ ...presetFrame("plain.ring", 0.24)!, growth: "out" });
    expect(out.outset).toBe(0.15);
    expect(out.outer).toBeCloseTo(0.65);
    expect(out.window).toBeCloseTo(0.41);
    const mid = layoutFrame({ ...presetFrame("plain.ring")!, growth: "mid" });
    expect(mid.outset).toBeCloseTo(0.05);
    expect(mid.extent).toBeGreaterThan(mid.outer);
  });

  it("thins the frame on a Gargantuan token", () => {
    const layout = layoutFrame(presetFrame("plain.ring")!, "gargantuan");
    expect(0.5 - layout.window).toBeCloseTo(0.1 / Math.sqrt(3));
  });
});

describe("the circle warp", () => {
  it("bends a band-space rectangle into a wedge with the radius's taper", () => {
    const band = ring(0.3, 0.5);
    const length = bandLength(band);
    const wedge = warpPolygon(band, length, [0, 0, 1, 0, 1, 1, 0, 1]);
    const at = (u: number, v: number) => warpPoint(band, length, u, v);
    const inner = Math.hypot(at(1, 0)[0] - at(0, 0)[0], at(1, 0)[1] - at(0, 0)[1]);
    const outer = Math.hypot(at(1, 1)[0] - at(0, 1)[0], at(1, 1)[1] - at(0, 1)[1]);
    expect(inner / outer).toBeCloseTo(0.3 / 0.5, 3);
    // every vertex sits on one of the band's two circles or the radial sides between
    for (let index = 0; index < wedge.length; index += 2) {
      const radius = Math.hypot(wedge[index]!, wedge[index + 1]!);
      expect(radius).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(radius).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it("closes a full band with no seam, starting at the top and running clockwise", () => {
    const band = ring(0.4, 0.5);
    const length = bandLength(band);
    const start = warpPoint(band, length, 0, 0.5);
    const end = warpPoint(band, length, length, 0.5);
    expect(end[0]).toBeCloseTo(start[0], 12);
    expect(end[1]).toBeCloseTo(start[1], 12);
    expect(start[1]).toBeLessThan(0); // the top (y down)
    expect(warpPoint(band, length, length / 4, 0.5)[0]).toBeGreaterThan(0); // a quarter on: the right
  });

  it("cuts long edges into short steps so they bend", () => {
    const band = ring(0.4, 0.5);
    const length = bandLength(band);
    expect(warpPolygon(band, length, [0, 0, length / 2, 0, length / 2, 1, 0, 1]).length / 2).toBe(
      90 + 1 + 90 + 1,
    );
  });
});

describe("masonry", () => {
  it("lays a slab on a Small token in two courses, no slivers", () => {
    const { facets, courses } = generate("masonry", presetFrame("stone.castle", 0.24)!, 7, "small");
    expect(courses).toBe(2);
    const stones = tops(facets).map((facet) => centroid(facet.points)[1]);
    expect(stones.some((v) => v < 0.5)).toBe(true);
    expect(stones.some((v) => v > 0.5)).toBe(true);
  });

  it("keeps one course at regular weight, the count by the repeat rule", () => {
    const { facets, courses, length } = generate("masonry", presetFrame("stone.castle")!);
    expect(courses).toBe(1);
    expect(tops(facets)).toHaveLength(Math.round(length / 1.5));
  });

  it("shows many small stones at skinny weight on a Gargantuan", () => {
    const skinny = generate("masonry", presetFrame("stone.castle", 0.05)!, 7, "gargantuan");
    const regular = generate("masonry", presetFrame("stone.castle")!, 7, "medium");
    expect(tops(skinny.facets).length).toBeGreaterThan(3 * tops(regular.facets).length);
  });

  it("gives the same stones for the same seed, other stones for another", () => {
    const frame = presetFrame("stone.cave")!;
    expect(generate("masonry", frame, 11).facets).toEqual(generate("masonry", frame, 11).facets);
    expect(generate("masonry", frame, 11).facets).not.toEqual(
      generate("masonry", frame, 12).facets,
    );
  });

  it("cracks stones by crack density, and every bond draws stones", () => {
    expect(
      generate("masonry", presetFrame("stone.castle")!).facets.some((f) => f.role === "crack"),
    ).toBe(false);
    expect(
      generate("masonry", presetFrame("stone.cracked")!).facets.some((f) => f.role === "crack"),
    ).toBe(true);
    for (const bond of ["running", "stack", "rubble", "cobble"]) {
      const frame = presetFrame("stone.castle")!;
      frame.bands[0]!.params = { ...frame.bands[0]!.params, bond };
      expect(tops(generate("masonry", frame).facets).length).toBeGreaterThan(5);
    }
  });
});

describe("plank, plate and plain", () => {
  it("nails both ends of every board", () => {
    const { facets } = generate("plank", presetFrame("wood.oak")!);
    const boards = facets.filter((facet) => facet.role === "top" && facet.points.length === 8);
    const domes = facets.filter((facet) => facet.role === "top" && facet.points.length === 16);
    // two nails at each end; a knot is a dome too, with a crack-coloured cap
    expect(domes.length).toBe(boards.length * 4);
  });

  it("rivets plates by rows, and welds them under a bead", () => {
    const riveted = generate("plate", presetFrame("metal.riveted")!).facets;
    const rusted = generate("plate", presetFrame("metal.rusted")!).facets;
    const rivets = (facets: Facet[]) =>
      facets.filter((facet) => facet.role === "top" && facet.points.length === 16).length;
    expect(rivets(riveted)).toBeGreaterThan(rivets(rusted));
    const welded = generate("plate", presetFrame("metal.welded")!).facets;
    expect(rivets(welded)).toBe(0);
    expect(
      welded.filter((facet) => facet.role === "bevel" && facet.tilt?.pitch === 38).length,
    ).toBeGreaterThan(0);
  });

  it("draws a plain band as one flat top, its grain from a fixed stream", () => {
    const flat = generate("plain", presetFrame("plain.ring")!).facets;
    expect(flat).toHaveLength(1);
    expect(flat[0]!.tilt).toBeUndefined();
    const steel = presetFrame("metal.steel")!;
    expect(generate("plain", steel, 1).facets).toEqual(generate("plain", steel, 2).facets);
    expect(generate("plain", steel, 1).facets.length).toBeGreaterThan(1);
  });
});
