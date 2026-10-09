import { describe, expect, it } from "vitest";
import { colorToOkLab, isInGamut, okLabToOkLch, okLabToRgb, okLchToOkLab } from "../colorSpace.js";
import {
  COLOR_WINDOW,
  cellIndexAt,
  maxChroma,
  windowCells,
  windowColorAt,
  windowDistance,
  windowLightness,
  windowPointOf,
  windowSize,
} from "../colorWindow.js";

describe("maxChroma", () => {
  it("returns the gamut edge: in gamut there, out just past it", () => {
    for (const [L, h] of [
      [0.7, 250],
      [0.85, 30],
      [0.65, 140],
    ] as const) {
      const C = maxChroma(L, h);
      expect(isInGamut(okLabToRgb(okLchToOkLab({ L, C, h })))).toBe(true);
      expect(isInGamut(okLabToRgb(okLchToOkLab({ L, C: C + 0.002, h })))).toBe(false);
    }
  });

  it("returns the ceiling when the ceiling itself fits", () => {
    expect(maxChroma(0.7, 120, 0.01)).toBe(0.01);
  });
});

describe("windowColorAt", () => {
  it("keeps every cell inside the lightness band and at or under the target chroma", () => {
    for (const cell of windowCells()) {
      const { L, C } = okLabToOkLch(cell.lab);
      expect(L).toBeGreaterThan(COLOR_WINDOW.lightMin - 0.01);
      expect(L).toBeLessThan(COLOR_WINDOW.lightMax + 0.01);
      expect(C).toBeLessThan(COLOR_WINDOW.chroma + 0.01);
    }
  });

  it("puts light at the top and dark at the bottom", () => {
    expect(windowLightness(0)).toBe(COLOR_WINDOW.lightMax);
    expect(windowLightness(1)).toBe(COLOR_WINDOW.lightMin);
    expect(windowLightness(-3)).toBe(COLOR_WINDOW.lightMax);
  });

  it("wraps hue: the left and right edges are one colour", () => {
    expect(windowColorAt({ u: 0, v: 0.5 }).hex).toBe(windowColorAt({ u: 1, v: 0.5 }).hex);
    expect(windowColorAt({ u: -0.25, v: 0.5 }).hex).toBe(windowColorAt({ u: 0.75, v: 0.5 }).hex);
  });

  it("measures the stored (rounded) colour", () => {
    const { hex, lab } = windowColorAt({ u: 0.3, v: 0.4 });
    expect(colorToOkLab(hex)).toEqual(lab);
  });
});

describe("windowPointOf", () => {
  it("finds a window colour back at its own point", () => {
    const point = { u: 0.42, v: 0.5 };
    const back = windowPointOf(windowColorAt(point).hex)!;
    expect(Math.abs(back.u - point.u)).toBeLessThan(0.01);
    expect(Math.abs(back.v - point.v)).toBeLessThan(0.05);
  });

  it("clamps a colour outside the band to the nearest edge", () => {
    expect(windowPointOf("#101010")!.v).toBe(1);
    expect(windowPointOf("#ffffff")!.v).toBe(0);
  });

  it("gives a legacy hsl colour a position", () => {
    expect(windowPointOf("hsl(200, 70%, 50%)")).not.toBeNull();
  });

  it("has no position for an unparseable colour", () => {
    expect(windowPointOf("junk")).toBeNull();
  });
});

describe("windowCells", () => {
  it("is row-major, built once", () => {
    const cells = windowCells();
    expect(cells).toHaveLength(COLOR_WINDOW.columns * COLOR_WINDOW.rows);
    expect(cells[1]!.column).toBe(1);
    expect(cells[COLOR_WINDOW.columns]!.row).toBe(1);
    expect(windowCells()).toBe(cells);
  });
});

describe("cellIndexAt", () => {
  it("wraps u and clamps v", () => {
    expect(cellIndexAt({ u: 1, v: 0 })).toBe(0);
    expect(cellIndexAt({ u: -0.001, v: 0 })).toBe(COLOR_WINDOW.columns - 1);
    expect(cellIndexAt({ u: 0, v: 5 })).toBe((COLOR_WINDOW.rows - 1) * COLOR_WINDOW.columns);
  });

  it("finds the cell a point lies in", () => {
    const cell = windowCells()[cellIndexAt({ u: 0.501, v: 0.251 })]!;
    expect(Math.abs(cell.u - 0.501)).toBeLessThan(1 / COLOR_WINDOW.columns);
    expect(Math.abs(cell.v - 0.251)).toBeLessThan(1 / COLOR_WINDOW.rows);
  });
});

describe("window geometry", () => {
  it("is 2πC wide and as tall as the band, in ΔE units", () => {
    const { width, height } = windowSize();
    expect(width).toBeCloseTo(2 * Math.PI * COLOR_WINDOW.chroma, 12);
    expect(height).toBeCloseTo(COLOR_WINDOW.lightMax - COLOR_WINDOW.lightMin, 12);
  });

  it("measures across the hue seam the short way", () => {
    const across = windowDistance({ u: 0.01, v: 0.5 }, { u: 0.99, v: 0.5 });
    expect(across).toBeCloseTo(0.02 * windowSize().width, 10);
    expect(windowDistance({ u: 0.2, v: 0 }, { u: 0.2, v: 1 })).toBeCloseTo(windowSize().height, 10);
  });
});
