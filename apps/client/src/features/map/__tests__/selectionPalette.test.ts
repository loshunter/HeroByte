import { describe, expect, it } from "vitest";
import { KEYLINE_DARK, KEYLINE_LIGHT, contrastRatio, parseColor } from "@herobyte/shared";
import { DEFAULT_SELECTION, selectionPalette } from "../selectionPalette";

describe("selectionPalette", () => {
  it("keeps today's blue exactly for a viewer with no colour", () => {
    expect(selectionPalette(null)).toBe(DEFAULT_SELECTION);
    expect(selectionPalette("not a colour")).toBe(DEFAULT_SELECTION);
    expect(DEFAULT_SELECTION).toEqual({
      stroke: "#447DF7",
      drag: "#44f",
      fill: "rgba(68, 125, 247, 0.25)",
      handleFill: "rgba(68, 125, 247, 0.25)",
      glow: "#447DF7",
      keyline: null,
      badgeText: "#FFFFFF",
    });
  });

  it("paints a pastel viewer's selection in their colour with a dark keyline", () => {
    expect(selectionPalette("#FFC2D3")).toEqual({
      stroke: "#ffc2d3",
      // The drag shade: lightness moved 0.12 toward the middle (down for a light colour).
      drag: "#d79cad",
      fill: "rgba(255, 194, 211, 0.25)",
      handleFill: "rgba(255, 194, 211, 0.85)",
      glow: "#ffc2d3",
      keyline: KEYLINE_DARK,
      badgeText: KEYLINE_DARK,
    });
  });

  it("gives a deep shade a light keyline, a lighter drag shade and a glow lifted for a dark map", () => {
    const palette = selectionPalette("#390076");
    expect(palette.keyline).toBe(KEYLINE_LIGHT);
    expect(palette.drag).toBe("#57309c");
    expect(palette.glow).toBe("#7d5bca");
    expect(contrastRatio(parseColor(palette.glow)!, parseColor("#2a2622")!)).toBeGreaterThanOrEqual(
      3,
    );
    expect(selectionPalette("hsl(120, 70%, 50%)").stroke).toBe("#26d926");
  });
});
