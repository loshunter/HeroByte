import { describe, expect, it } from "vitest";
import {
  colorToOkLab,
  contrastRatio,
  deltaE,
  hslToRgb,
  isHexColor,
  isInGamut,
  normalizeColor,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  parseColor,
  relativeLuminance,
  rgbToHex,
  rgbToOkLab,
} from "../colorSpace.js";

describe("parseColor", () => {
  it("reads the stored hex form, either case", () => {
    expect(parseColor("#ff8000")).toEqual({ r: 1, g: 128 / 255, b: 0 });
    expect(parseColor("#FF8000")).toEqual(parseColor("#ff8000"));
  });

  it("reads short hex", () => {
    expect(parseColor("#f80")).toEqual({ r: 1, g: 136 / 255, b: 0 });
  });

  it("reads the token service's legacy hsl strings", () => {
    const green = parseColor("hsl(120, 70%, 50%)")!;
    expect(rgbToHex(green)).toBe("#26d926");
  });

  it("reads hand-edited hsl forms: hsla, deg, space separated, decimals", () => {
    const base = rgbToHex(parseColor("hsl(200, 50%, 40%)")!);
    expect(rgbToHex(parseColor("hsla(200, 50%, 40%, 0.5)")!)).toBe(base);
    expect(rgbToHex(parseColor("hsl(200deg 50% 40%)")!)).toBe(base);
    expect(rgbToHex(parseColor("  hsl(200.0, 50.0%, 40.0%)  ")!)).toBe(base);
  });

  it("returns null for anything else", () => {
    for (const junk of [
      "",
      "red",
      "var(--hero-gold)",
      "#12345",
      "#gggggg",
      "rgb(1,2,3)",
      "hsl(x)",
    ]) {
      expect(parseColor(junk)).toBeNull();
    }
  });
});

describe("normalizeColor / isHexColor", () => {
  it("normalises every accepted form to lower-case #rrggbb", () => {
    expect(normalizeColor("#ABCDEF")).toBe("#abcdef");
    expect(normalizeColor("#abc")).toBe("#aabbcc");
    expect(normalizeColor("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(normalizeColor("nope")).toBeNull();
  });

  it("accepts only the six-digit stored form as hex", () => {
    expect(isHexColor("#a1b2c3")).toBe(true);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("hsl(0, 100%, 50%)")).toBe(false);
  });
});

describe("hslToRgb", () => {
  it("wraps hue and clamps saturation and lightness", () => {
    expect(hslToRgb(-120, 1, 0.5)).toEqual(hslToRgb(240, 1, 0.5));
    expect(hslToRgb(480, 1, 0.5)).toEqual(hslToRgb(120, 1, 0.5));
    expect(hslToRgb(30, 5, 0.5)).toEqual(hslToRgb(30, 1, 0.5));
    expect(hslToRgb(30, 1, 2)).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("covers every hue sector", () => {
    const hexes = [0, 60, 120, 180, 240, 300].map((hue) => rgbToHex(hslToRgb(hue, 1, 0.5)));
    expect(hexes).toEqual(["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"]);
  });
});

describe("OKLab", () => {
  it("matches Ottosson's published value for sRGB red", () => {
    const red = rgbToOkLab({ r: 1, g: 0, b: 0 });
    expect(red.L).toBeCloseTo(0.62796, 4);
    expect(red.a).toBeCloseTo(0.22486, 4);
    expect(red.b).toBeCloseTo(0.12585, 4);
  });

  it("puts white at L 1 and black at L 0, both without chroma", () => {
    const white = rgbToOkLab({ r: 1, g: 1, b: 1 });
    const black = rgbToOkLab({ r: 0, g: 0, b: 0 });
    expect(white.L).toBeCloseTo(1, 4);
    expect(Math.hypot(white.a, white.b)).toBeLessThan(1e-4);
    expect(black.L).toBeCloseTo(0, 6);
  });

  it("round-trips sRGB through OKLab", () => {
    for (const hex of ["#123456", "#ff8000", "#7fc23f", "#ffffff", "#000000", "#0a0b0c"]) {
      expect(rgbToHex(okLabToRgb(colorToOkLab(hex)!))).toBe(hex);
    }
  });

  it("round-trips OKLab through OKLCH with hue in [0, 360)", () => {
    const lab = colorToOkLab("#3050c0")!;
    const lch = okLabToOkLch(lab);
    expect(lch.h).toBeGreaterThanOrEqual(0);
    expect(lch.h).toBeLessThan(360);
    const back = okLchToOkLab(lch);
    expect(back.a).toBeCloseTo(lab.a, 10);
    expect(back.b).toBeCloseTo(lab.b, 10);
  });

  it("gives a negative-b colour a hue past 180, not a negative one", () => {
    expect(okLabToOkLch({ L: 0.5, a: 0.1, b: -0.1 }).h).toBeCloseTo(315, 6);
  });

  it("knows what sRGB cannot show", () => {
    expect(isInGamut(okLabToRgb(okLchToOkLab({ L: 0.7, C: 0.05, h: 250 })))).toBe(true);
    expect(isInGamut(okLabToRgb(okLchToOkLab({ L: 0.7, C: 0.35, h: 250 })))).toBe(false);
  });

  it("measures distance symmetrically and zero for the same colour", () => {
    const a = colorToOkLab("#ff0000")!;
    const b = colorToOkLab("#00ff00")!;
    expect(deltaE(a, a)).toBe(0);
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 12);
    expect(deltaE(a, b)).toBeGreaterThan(0.3);
  });

  it("has no OKLab for an unparseable string", () => {
    expect(colorToOkLab("var(--x)")).toBeNull();
  });
});

describe("contrast", () => {
  it("is 21 for black on white, whichever way round", () => {
    const white = { r: 1, g: 1, b: 1 };
    const black = { r: 0, g: 0, b: 0 };
    expect(contrastRatio(white, black)).toBeCloseTo(21, 6);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 6);
  });

  it("clamps channels outside 0..1 before measuring", () => {
    expect(relativeLuminance({ r: 1.4, g: 1.2, b: 2 })).toBeCloseTo(1, 10);
    expect(relativeLuminance({ r: -0.2, g: 0, b: 0 })).toBe(0);
  });
});
