import { describe, expect, it } from "vitest";
import { computeShoreDistances } from "../terrainDistanceField";

const key = (x: number, y: number): string => `${x},${y}`;

function block(x0: number, y0: number, w: number, h: number): Set<string> {
  const cells = new Set<string>();
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) cells.add(key(x, y));
  }
  return cells;
}

describe("computeShoreDistances", () => {
  it("rings a solid block: edge cells 1, deepening by Chebyshev distance inward", () => {
    const d = computeShoreDistances(block(0, 0, 5, 5));
    // Edge ring (any cell touching outside, corners included) is 1.
    expect(d.get(key(0, 0))).toBe(1);
    expect(d.get(key(2, 0))).toBe(1);
    expect(d.get(key(4, 4))).toBe(1);
    // Next ring is 2; the single centre cell is 3.
    expect(d.get(key(1, 1))).toBe(2);
    expect(d.get(key(3, 2))).toBe(2);
    expect(d.get(key(2, 2))).toBe(3);
  });

  it("treats any missing 8-neighbour as shore, diagonals included", () => {
    // A 7x3 pool with a bite taken out of the middle of the top edge. The
    // cells under (orthogonal) and beside-under (diagonal) the bite become
    // shore; a cell fully shielded on all 8 sides stays depth 2.
    const cells = block(0, 0, 7, 3);
    cells.delete(key(3, 0));
    const d = computeShoreDistances(cells);
    expect(d.get(key(3, 1))).toBe(1); // directly under the bite
    expect(d.get(key(2, 1))).toBe(1); // diagonal to the bite
    expect(d.get(key(1, 1))).toBe(2); // all 8 neighbours present
  });

  it("returns an empty map for an empty set", () => {
    expect(computeShoreDistances(new Set()).size).toBe(0);
  });
});
