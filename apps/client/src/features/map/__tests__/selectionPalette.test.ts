import { describe, expect, it } from "vitest";
import {
  KEYLINE_DARK,
  KEYLINE_LIGHT,
  contrastRatio,
  parseColor,
  windowCells,
} from "@herobyte/shared";
import { DEFAULT_SELECTION, selectionPalette } from "../selectionPalette";

describe("selectionPalette", () => {
  it("keeps today's blue exactly for a viewer with no colour", () => {
    expect(selectionPalette(null)).toBe(DEFAULT_SELECTION);
    expect(selectionPalette("not a colour")).toBe(DEFAULT_SELECTION);
    expect(DEFAULT_SELECTION).toEqual({
      stroke: "#447DF7",
      drag: "#44f",
      handleFill: "rgba(68, 125, 247, 0.25)",
      glow: "#447DF7",
      keyline: null,
      badgeText: "#FFFFFF",
    });
  });

  it("paints a pastel viewer's selection in their colour with a dark keyline", () => {
    expect(selectionPalette("#FFC2D3")).toEqual({
      stroke: "#ffc2d3",
      // The drag shade: lightness moved 0.12 away from the dark keyline (lighter).
      drag: "#ffe9fb",
      handleFill: "rgba(255, 194, 211, 0.85)",
      glow: "#ffc2d3",
      keyline: KEYLINE_DARK,
      badgeText: "#000000",
    });
  });

  it("gives a deep shade a light keyline, a darker drag shade and a glow lifted for a dark map", () => {
    const palette = selectionPalette("#390076");
    expect(palette.keyline).toBe(KEYLINE_LIGHT);
    expect(palette.drag).toBe("#1f0051");
    expect(palette.badgeText).toBe("#ffffff");
    expect(palette.glow).toBe("#7d5bca");
    expect(contrastRatio(parseColor(palette.glow)!, parseColor("#2a2622")!)).toBeGreaterThanOrEqual(
      3,
    );
    expect(selectionPalette("hsl(120, 70%, 50%)").stroke).toBe("#26d926");
  });

  it("numbers the badge white on #c64475, where keyline-based black would be 4.48:1", () => {
    expect(selectionPalette("#c64475").badgeText).toBe("#ffffff");
  });

  it("keeps the drag shade at least 6.7:1 from the keyline it is drawn over", () => {
    for (const cell of windowCells()) {
      const palette = selectionPalette(cell.hex);
      const ratio = contrastRatio(parseColor(palette.drag)!, parseColor(palette.keyline!)!);
      expect(ratio).toBeGreaterThanOrEqual(6.7);
    }
  });
});
