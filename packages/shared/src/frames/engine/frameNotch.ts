// ============================================================================
// THE FACING NOTCH — one arrow gem at the top of the frame (C5b)
// ============================================================================
// Tokens have no facing yet, so the notch always points up: one faceted
// arrowhead at the top centre of the frame, across all its bands, in the
// frame's colour and lit by the table's one light. It is a field on the frame
// (`notch`), not a band: a band would count against the 0.34 weight cap and
// scale with the weight slider. Slice C5c's `bezel` generator (other gems,
// other counts) can take it over.

import type { Rgb } from "../../colorSpace.js";
import type { FrameLayout } from "./bandSpace.js";
import { personalRoleColor, shade, slopeNormal, UP, type ResolvedPalette } from "./shading.js";
import { isPolygonShape, shapeOutline } from "./shapes.js";

export interface NotchPaint {
  points: number[];
  color: Rgb;
  alpha: number;
}

/** The gem's height at least, token units: a skinny frame still shows it. */
const MIN_GEM = 0.14;
/** The dark rim round the faces, as a share of the gem from its ridge. */
const RIM = 1.18;
/** How far the gem's facets slope from its ridge, degrees. */
const FACET_PITCH = 38;

/** The top centre of the frame at `level`, where the gem sits. */
function topAt(layout: FrameLayout, level: number): number {
  return isPolygonShape(layout.shape) ? shapeOutline(layout.shape, level)[1]! : -level;
}

/**
 * The gem's facets in token units: a dark rim, then four lit faces round a
 * ridge point, pointing up out of the frame. `accent` is the frame's colour.
 */
export function notchPaints(
  layout: FrameLayout,
  accent: string,
  palette: ResolvedPalette,
): NotchPaint[] {
  const height = Math.max(MIN_GEM, layout.outer - layout.window);
  // The rim's tip sits on the frame's outer edge: the gem grows inward from it,
  // so it never reaches past the bitmap, over the picture's edge on a skinny frame.
  const reach = 0.5 * height; // the ridge to the tip
  const ridgeY = topAt(layout, layout.outer) + RIM * reach;
  const width = 0.62 * height;
  const ridge: [number, number] = [0, ridgeY];
  const tip: [number, number] = [0, ridgeY - reach];
  const right: [number, number] = [width / 2, ridgeY + 0.2 * reach];
  const tail: [number, number] = [0, ridgeY + 0.9 * reach];
  const left: [number, number] = [-width / 2, ridgeY + 0.2 * reach];
  const grow = (point: [number, number], by: number): number[] => [
    ridge[0] + (point[0] - ridge[0]) * by,
    ridge[1] + (point[1] - ridge[1]) * by,
  ];
  const base = personalRoleColor(accent, "top");
  const rim = personalRoleColor(accent, "outline");
  const paints: NotchPaint[] = [
    {
      points: [...grow(tip, RIM), ...grow(right, RIM), ...grow(tail, RIM), ...grow(left, RIM)],
      color: shade(rim, UP, palette, "outline"),
      alpha: 1,
    },
  ];
  for (const [a, b] of [
    [tip, right],
    [right, tail],
    [tail, left],
    [left, tip],
  ] as const) {
    // Each face slopes away from the ridge, toward its own outer edge.
    const mx = (a[0] + b[0]) / 2 - ridge[0];
    const my = (a[1] + b[1]) / 2 - ridge[1];
    paints.push({
      points: [...ridge, ...a, ...b],
      color: shade(base, slopeNormal(mx, my, FACET_PITCH), palette, "top"),
      alpha: 1,
    });
  }
  return paints;
}
