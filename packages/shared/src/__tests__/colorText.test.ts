import { describe, expect, it } from "vitest";
import { colorToOkLab, contrastRatio, okLabToOkLch, parseColor } from "../colorSpace.js";
import { KEYLINE_DARK, KEYLINE_LIGHT, keylineFor, readableOn, textOn } from "../colorText.js";
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
    // Every cell is checked; what is wrong is collected and asserted once.
    let lifted = 0;
    const wrong: string[] = [];
    for (const cell of windowCells()) {
      const text = readableOn(cell.hex, NAVY)!;
      const reached = ratio(text, NAVY);
      if (reached < 4.5) wrong.push(`${cell.hex} reaches ${reached}`);
      if (ratio(cell.hex, NAVY) < 4.5) {
        lifted += 1;
        // Each lift stops at the target, not past it.
        if (reached >= 4.6) wrong.push(`${cell.hex} overshoots to ${reached}`);
      }
      // A coloured cell stays coloured (never lifted to grey), with its hue.
      const source = okLabToOkLch(colorToOkLab(cell.hex)!).C;
      const chroma = okLabToOkLch(colorToOkLab(text)!).C;
      if (source > 0.04) {
        if (chroma <= 0.04) wrong.push(`${cell.hex} greys to ${text}`);
        if (hueGap(hueOf(text), hueOf(cell.hex)) >= 12) wrong.push(`${cell.hex} turns to ${text}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(lifted).toBeGreaterThan(0); // the window does reach below the target
  }, 30_000);

  it("lifts the darkest window colour and the worst older colour", () => {
    for (const dark of ["#390076", "#2626d9", "hsl(240, 70%, 50%)", "#0b0b41"]) {
      expect(ratio(readableOn(dark, NAVY)!, NAVY)).toBeGreaterThanOrEqual(4.5);
    }
    // The values the record states.
    expect(readableOn("#390076", NAVY)).toBe("#8867d7");
    expect(readableOn("#2626d9", NAVY)).toBe("#4d6eff");
  });

  it("goes as far as it can when the target is out of reach", () => {
    // Black is only 4.7:1 on mid grey: the darkest it can go, not null.
    expect(readableOn("#ff0000", "#777777", 7)).toBe("#000000");
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

  it("gives every window colour a keyline of at least 4.16:1, the record's figure", () => {
    let worst = Infinity;
    for (const cell of windowCells())
      worst = Math.min(worst, ratio(cell.hex, keylineFor(cell.hex)));
    expect(worst).toBeGreaterThanOrEqual(4.16);
    expect(worst).toBeLessThan(4.5); // why text on a colour uses textOn, not the keyline
  });
});

describe("textOn", () => {
  it("puts black or white text on any colour at 4.5:1 or better", () => {
    const colours = [
      ...windowCells().map((cell) => cell.hex),
      ...Array.from({ length: 360 }, (_, hue) => `hsl(${hue}, 70%, 50%)`),
    ];
    expect(colours.filter((colour) => ratio(colour, textOn(colour)) < 4.5)).toEqual([]);
  }, 30_000);

  it("picks white on a red ring the keyline pair leaves at 4.36:1, black on the default green", () => {
    expect(textOn("#d9262c")).toBe("#ffffff");
    expect(textOn("#5AFFAD")).toBe("#000000");
    expect(textOn("#008183")).toBe("#ffffff");
  });
});
