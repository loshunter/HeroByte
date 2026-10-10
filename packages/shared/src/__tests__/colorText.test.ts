import { describe, expect, it } from "vitest";
import { colorToOkLab, contrastRatio, okLabToOkLch, parseColor } from "../colorSpace.js";
import { KEYLINE_DARK, KEYLINE_LIGHT, keylineFor, readableOn } from "../colorText.js";
import { windowCells } from "../colorWindow.js";

const NAVY = "#0f0e1e";
const ratio = (first: string, second: string) =>
  contrastRatio(parseColor(first)!, parseColor(second)!);
const hueOf = (color: string) => okLabToOkLch(colorToOkLab(color)!).h;
const hueGap = (first: number, second: number) => {
  const gap = Math.abs(first - second) % 360;
  return Math.min(gap, 360 - gap);
};

describe("readableOn", () => {
  it("lifts every window colour to 4.5:1 on the navy panel, keeping its hue", () => {
    let worst = Infinity;
    for (const cell of windowCells()) {
      const text = readableOn(cell.hex, NAVY)!;
      const reached = ratio(text, NAVY);
      worst = Math.min(worst, reached);
      expect(reached).toBeGreaterThanOrEqual(4.5);
      // Hue is only meaningful with some chroma left after the lift.
      const chroma = okLabToOkLch(colorToOkLab(text)!).C;
      if (chroma > 0.04) expect(hueGap(hueOf(text), hueOf(cell.hex))).toBeLessThan(12);
    }
    expect(worst).toBeLessThan(4.6); // the lift stops at the target, not far past it
  });

  it("lifts the darkest window colour and the worst older colour", () => {
    for (const dark of ["#390076", "#2626d9", "hsl(240, 70%, 50%)", "#0b0b41"]) {
      expect(ratio(readableOn(dark, NAVY)!, NAVY)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a colour that already reads, as #rrggbb", () => {
    expect(readableOn("#FFC2D3", NAVY)).toBe("#ffc2d3");
  });

  it("darkens instead on a light background", () => {
    const text = readableOn("#ffe680", "#f4f1e8")!;
    expect(ratio(text, "#f4f1e8")).toBeGreaterThanOrEqual(4.5);
    expect(colorToOkLab(text)!.L).toBeLessThan(colorToOkLab("#ffe680")!.L);
  });

  it("returns null for a colour or background it cannot read", () => {
    expect(readableOn("not a colour", NAVY)).toBeNull();
    expect(readableOn("#ff0000", "var(--jrpg-navy)")).toBeNull();
  });
});

describe("keylineFor", () => {
  it("edges a pastel in dark and a deep shade in light", () => {
    expect(keylineFor("#ffc2d3")).toBe(KEYLINE_DARK);
    expect(keylineFor("#390076")).toBe(KEYLINE_LIGHT);
  });

  it("gives every window colour a keyline of at least 4:1", () => {
    for (const cell of windowCells()) {
      expect(ratio(cell.hex, keylineFor(cell.hex))).toBeGreaterThanOrEqual(4);
    }
  });
});
