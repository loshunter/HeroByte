// ============================================================================
// SELECTION IN YOUR COLOUR — one palette for every selection surface (C3)
// ============================================================================
// Everything YOU select (tokens, props, drawings, templates, the move and
// rotate handles, the multi-select count) shows in YOUR colour on your screen.
// Selection is drawn only on the selecting person's own screen, so the colour
// means "you". MapBoard provides the palette inside the stage (Konva cannot
// resolve CSS variables, so every value is a literal); a viewer with no colour
// (a spectator, a DM with no PC) gets today's blue, exactly.

import { createContext, useContext } from "react";
import {
  colorToOkLab,
  keylineFor,
  normalizeColor,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  parseColor,
  readableOn,
  rgbToHex,
} from "@herobyte/shared";

export interface SelectionPalette {
  /** The outline and the handles. */
  stroke: string;
  /** The outline while dragging: a shade of the stroke. */
  drag: string;
  /** The move handle's translucent fill. */
  fill: string;
  /** The pulsing glow (full motion only): lifted to 3:1 on a dark map, or a deep colour's glow vanishes. */
  glow: string;
  /**
   * The edge around the outline, dark or light (keylineFor), so it reads on its
   * own fill (your picture-less token is filled with your colour), light maps,
   * dark maps and fog. Null: today's plain blue outline.
   */
  keyline: string | null;
  /** Text on the multi-select badge, which is filled with `stroke`. */
  badgeText: string;
}

/** A dark map floor (the picker preview's): the glow must show on it. */
const DARK_MAP = "#2a2622";

export const DEFAULT_SELECTION: SelectionPalette = {
  stroke: "#447DF7",
  drag: "#44f",
  fill: "rgba(68, 125, 247, 0.25)",
  glow: "#447DF7",
  keyline: null,
  badgeText: "#FFFFFF",
};

/** The palette for a viewer's colour; the default blue when there is none. */
export function selectionPalette(color: string | null): SelectionPalette {
  const hex = color ? normalizeColor(color) : null;
  const rgb = hex ? parseColor(hex) : null;
  const lab = hex ? colorToOkLab(hex) : null;
  if (!hex || !rgb || !lab) return DEFAULT_SELECTION;
  // The drag shade moves the lightness toward the middle, so it never vanishes.
  const { L, C, h } = okLabToOkLch(lab);
  const moved = okLabToRgb(okLchToOkLab({ L: L > 0.5 ? L - 0.12 : L + 0.12, C, h }));
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const drag = rgbToHex({ r: clamp(moved.r), g: clamp(moved.g), b: clamp(moved.b) });
  const channel = (value: number) => Math.round(value * 255);
  const keyline = keylineFor(hex);
  return {
    stroke: hex,
    drag,
    fill: `rgba(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)}, 0.25)`,
    glow: readableOn(hex, DARK_MAP, 3) ?? hex,
    keyline,
    badgeText: keyline,
  };
}

export const SelectionPaletteContext = createContext<SelectionPalette>(DEFAULT_SELECTION);

/** The viewer's selection palette (the default blue outside a provider, as in tests). */
export function useSelectionPalette(): SelectionPalette {
  return useContext(SelectionPaletteContext);
}

/** Konva props for a thin keyline halo around a selected line or shape; none for the default blue. */
export function keylineHalo(
  palette: SelectionPalette,
  scale: number,
): { shadowColor?: string; shadowBlur?: number; shadowOpacity?: number } {
  return palette.keyline
    ? { shadowColor: palette.keyline, shadowBlur: 3 / scale, shadowOpacity: 1 }
    : {};
}
