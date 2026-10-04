import { describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { setup } from "./generateRegion.fixtures";
describe("Generate region baseline (before extraction)", () => {
  it("rounds each axis and each size independently on the asymmetric lattice", () => {
    const { result, generate } = setup();
    // (3.5, 5.49) cells, size (21.5, 20.49) cells: preserve Math.round.
    act(() => result.current.onRegionDragged({ x: 237, y: 358.36, width: 1376, height: 1311.36 }));
    act(() => result.current.onGenerate());
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: { x: 4, y: 5, cols: 22, rows: 20 } }),
    );
  });

  it("retains the one-cell floor for zero/tiny dimensions and explains the minimum", () => {
    const { result, generate } = setup();
    act(() => result.current.onRegionDragged({ x: 13, y: 7, width: 0, height: 12 }));
    expect(result.current.region).toEqual({ cols: 1, rows: 1 });
    expect(result.current.hint).toMatch(/at least 20×20/);
    expect(result.current.canGenerate).toBe(false);
    act(() => result.current.onGenerate());
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    [20, 20, true, null],
    [19, 20, false, "at least"],
    [20, 19, false, "at least"],
    [128, 128, true, null],
    [128, 129, false, "too big"],
  ] as const)("keeps %i×%i size eligibility %s", (cols, rows, eligible, hint) => {
    const { result, generate } = setup();
    act(() => result.current.onRegionDragged({ x: 13, y: 7, width: cols * 64, height: rows * 64 }));
    expect(result.current.canGenerate).toBe(eligible);
    if (hint) expect(result.current.hint).toContain(hint);
    else expect(result.current.hint).toBeNull();
    act(() => result.current.onGenerate());
    expect(generate).toHaveBeenCalledTimes(eligible ? 1 : 0);
  });
});
