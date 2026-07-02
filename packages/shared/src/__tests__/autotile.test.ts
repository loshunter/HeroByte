import { describe, expect, it } from "vitest";
import {
  BLOB_MASKS,
  NEIGHBOR,
  blobIndex,
  packNeighbors,
  quarterKind,
  quartersFor,
  suppressCorners,
} from "../index.js";

describe("packNeighbors", () => {
  it("packs flags into the canonical clockwise bit layout", () => {
    expect(
      packNeighbors({
        n: true,
        ne: false,
        e: true,
        se: false,
        s: false,
        sw: false,
        w: false,
        nw: true,
      }),
    ).toBe(NEIGHBOR.N | NEIGHBOR.E | NEIGHBOR.NW);
  });
});

describe("suppressCorners", () => {
  it("keeps a corner only when both adjacent edges are present", () => {
    // NE without N and E contributes nothing.
    expect(suppressCorners(NEIGHBOR.NE)).toBe(0);
    expect(suppressCorners(NEIGHBOR.NE | NEIGHBOR.N)).toBe(NEIGHBOR.N);
    expect(suppressCorners(NEIGHBOR.NE | NEIGHBOR.N | NEIGHBOR.E)).toBe(
      NEIGHBOR.NE | NEIGHBOR.N | NEIGHBOR.E,
    );
  });

  it("is idempotent", () => {
    for (let mask = 0; mask < 256; mask += 1) {
      const once = suppressCorners(mask);
      expect(suppressCorners(once)).toBe(once);
    }
  });

  it("collapses all 256 neighborhoods into exactly the 47 blob classes", () => {
    const classes = new Set<number>();
    for (let mask = 0; mask < 256; mask += 1) {
      classes.add(suppressCorners(mask));
    }
    expect(classes.size).toBe(47);
    expect([...classes].sort((a, b) => a - b)).toEqual([...BLOB_MASKS]);
  });
});

describe("blobIndex", () => {
  it("maps every neighborhood to a stable index in 0..46", () => {
    const seen = new Set<number>();
    for (let mask = 0; mask < 256; mask += 1) {
      const index = blobIndex(mask);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(47);
      seen.add(index);
    }
    expect(seen.size).toBe(47);
  });

  it("anchors the extremes: isolated is 0, fully surrounded is 46", () => {
    expect(blobIndex(0)).toBe(0);
    expect(blobIndex(255)).toBe(46);
  });
});

describe("quarterKind", () => {
  it("classifies the five sub-tile cases", () => {
    expect(quarterKind(false, false, false)).toBe("outer-corner");
    expect(quarterKind(false, false, true)).toBe("outer-corner"); // diagonal alone means nothing
    // Connected vertically, open horizontally: the vertical seam shows.
    expect(quarterKind(true, false, false)).toBe("edge-vertical");
    expect(quarterKind(false, true, false)).toBe("edge-horizontal");
    expect(quarterKind(true, true, false)).toBe("inner-corner");
    expect(quarterKind(true, true, true)).toBe("interior");
  });
});

describe("quartersFor", () => {
  it("renders an isolated cell as four outer corners", () => {
    expect(quartersFor(0)).toEqual({
      nw: "outer-corner",
      ne: "outer-corner",
      sw: "outer-corner",
      se: "outer-corner",
    });
  });

  it("renders a fully surrounded cell as four interiors", () => {
    expect(quartersFor(255)).toEqual({
      nw: "interior",
      ne: "interior",
      sw: "interior",
      se: "interior",
    });
  });

  it("renders a vertical strip as vertical edges on both sides", () => {
    const mask = NEIGHBOR.N | NEIGHBOR.S;
    expect(quartersFor(mask)).toEqual({
      nw: "edge-vertical",
      ne: "edge-vertical",
      sw: "edge-vertical",
      se: "edge-vertical",
    });
  });

  it("renders an inner corner where two edges meet without their diagonal", () => {
    // Neighbors north, east, south, west but no NE diagonal: the NE quarter
    // needs an inner corner; the others (with diagonals) are interior.
    const mask =
      NEIGHBOR.N | NEIGHBOR.E | NEIGHBOR.S | NEIGHBOR.W | NEIGHBOR.SE | NEIGHBOR.SW | NEIGHBOR.NW;
    expect(quartersFor(mask)).toEqual({
      nw: "interior",
      ne: "inner-corner",
      sw: "interior",
      se: "interior",
    });
  });
});
