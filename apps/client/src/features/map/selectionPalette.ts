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
  KEYLINE_DARK,
  colorToOkLab,
  keylineFor,
  normalizeColor,
  okLabToOkLch,
  okLabToRgb,
  okLchToOkLab,
  parseColor,
  readableOn,
  rgbToHex,
  textOn,
} from "@herobyte/shared";

export interface SelectionPalette {
  /** The outline and the handles. */
  stroke: string;
  /** The outline while dragging: a shade of the stroke. */
  drag: string;
  /** The centre move handle's fill: the colour at 85% (it carries the keyline cross), today's translucent blue without one. */
  handleFill: string;
  /** The pulsing glow (full motion only): lifted to 3:1 on a dark map, or a deep colour's glow vanishes. */
  glow: string;
  /**
   * The edge around the outline, dark or light (keylineFor), so it reads on its
   * own fill (your picture-less token is filled with your colour), light maps,
   * dark maps and fog. Null: today's plain blue outline.
   */
  keyline: string | null;
  /** The number on the multi-select badge, which is filled with `stroke` (textOn: black or white). */
  badgeText: string;
}

/** A dark map floor (the picker preview's): the glow must show on it. */
const DARK_MAP = "#2a2622";

export const DEFAULT_SELECTION: SelectionPalette = {
  stroke: "#447DF7",
  drag: "#44f",
  handleFill: "rgba(68, 125, 247, 0.25)",
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
  const keyline = keylineFor(hex);
  // The drag shade moves the lightness 0.12 AWAY from the keyline (lighter over a
  // dark keyline, darker over a light one), so the dashed drag line drawn over the
  // keyline contrasts with it at least as much as the colour does.
  const { L, C, h } = okLabToOkLch(lab);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const dragL = clamp(keyline === KEYLINE_DARK ? L + 0.12 : L - 0.12);
  const moved = okLabToRgb(okLchToOkLab({ L: dragL, C, h }));
  const drag = rgbToHex({ r: clamp(moved.r), g: clamp(moved.g), b: clamp(moved.b) });
  const channel = (value: number) => Math.round(value * 255);
  return {
    stroke: hex,
    drag,
    handleFill: `rgba(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)}, 0.85)`,
    glow: readableOn(hex, DARK_MAP, 3) ?? hex,
    keyline,
    badgeText: textOn(hex),
  };
}

export const SelectionPaletteContext = createContext<SelectionPalette>(DEFAULT_SELECTION);

/** The viewer's selection palette (the default blue outside a provider, as in tests). */
export function useSelectionPalette(): SelectionPalette {
  return useContext(SelectionPaletteContext);
}
