import { describe, expect, it } from "vitest";
import { paintPlacementBounds } from "../components/mapStudioWorkspaceUtils";

describe("paintPlacementBounds", () => {
  it("keeps the raw fit range when snapping is off", () => {
    expect(paintPlacementBounds(2048, 1, 50, 0, false)).toEqual({ min: 0, max: 1998 });
  });

  it("lands the max on the lattice when the document is not a grid multiple", () => {
    // 2048px doc, 50px grid: the old clamp minted off-lattice tiles at 1998.
    expect(paintPlacementBounds(2048, 1, 50, 0, true)).toEqual({ min: 0, max: 1950 });
  });

  it("keeps grid-multiple documents unchanged", () => {
    expect(paintPlacementBounds(2000, 1, 50, 0, true)).toEqual({ min: 0, max: 1950 });
    expect(paintPlacementBounds(200, 2, 50, 0, true)).toEqual({ min: 0, max: 100 });
  });

  it("respects grid offsets on both ends", () => {
    // Offset 25: lattice runs 25, 75, ..., so min is 25 and max is the last
    // lattice point that still fits a one-cell tile inside 2048.
    expect(paintPlacementBounds(2048, 1, 50, 25, true)).toEqual({ min: 25, max: 1975 });
  });

  it("falls back to the raw range when no lattice position fits", () => {
    expect(paintPlacementBounds(40, 1, 50, 0, true)).toEqual({ min: 0, max: -10 });
  });
});
