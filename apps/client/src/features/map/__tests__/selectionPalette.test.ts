import { describe, expect, it } from "vitest";
import { KEYLINE_DARK, KEYLINE_LIGHT, contrastRatio, parseColor } from "@herobyte/shared";
import { DEFAULT_SELECTION, keylineHalo, selectionPalette } from "../selectionPalette";

describe("selectionPalette", () => {
  it("keeps today's blue exactly for a viewer with no colour", () => {
    expect(selectionPalette(null)).toBe(DEFAULT_SELECTION);
    expect(selectionPalette("not a colour")).toBe(DEFAULT_SELECTION);
    expect(DEFAULT_SELECTION).toEqual({
      stroke: "#447DF7",
      drag: "#44f",
      fill: "rgba(68, 125, 247, 0.25)",
      glow: "#447DF7",
      keyline: null,
      badgeText: "#FFFFFF",
    });
  });

  it("paints a pastel viewer's selection in their colour with a dark keyline", () => {
    const palette = selectionPalette("#FFC2D3");
    expect(palette.stroke).toBe("#ffc2d3");
    expect(palette.glow).toBe("#ffc2d3");
    expect(palette.keyline).toBe(KEYLINE_DARK);
    expect(palette.badgeText).toBe(KEYLINE_DARK);
    expect(palette.fill).toBe("rgba(255, 194, 211, 0.25)");
    expect(palette.drag).not.toBe(palette.stroke);
  });

  it("gives a deep shade a light keyline and a glow lifted to show on a dark map", () => {
    expect(selectionPalette("#390076").keyline).toBe(KEYLINE_LIGHT);
    const glow = selectionPalette("#390076").glow;
    expect(glow).not.toBe("#390076");
    expect(contrastRatio(parseColor(glow)!, parseColor("#2a2622")!)).toBeGreaterThanOrEqual(3);
    expect(selectionPalette("hsl(120, 70%, 50%)").stroke).toBe("#26d926");
  });

  it("adds a keyline halo only in a viewer's colour", () => {
    expect(keylineHalo(DEFAULT_SELECTION, 1)).toEqual({});
    expect(keylineHalo(selectionPalette("#ffc2d3"), 2)).toEqual({
      shadowColor: KEYLINE_DARK,
      shadowBlur: 1.5,
      shadowOpacity: 1,
    });
  });
});
