// SVG adapter for the spline painter (spline arc): drives paintSpline through
// a rect-recording context and returns the calls as `<rect …/>` markup, so
// the map export draws the SAME deterministic art the live Konva layer does.
// Mirrors wearStampSvg — kept beside the painter for the 350-LOC cap and so
// the recorded subset stays pinned to the painter's contract in one place.

import { paintSpline, type SplineKind } from "./splineDetail";
import type { WearStampContext2D } from "./wearStampDetail";

const esc = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/** Trim float noise so export bytes stay small and stable. */
const num = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

/**
 * The spline art for one element as SVG rect markup (no wrapper group — the
 * exporter owns the transform). Pure and deterministic on
 * (points, kind, seed, cellSize, tint), byte-for-byte.
 */
export function splineSvgMarkup(
  points: readonly { x: number; y: number }[],
  kind: SplineKind,
  seed: number,
  cellSize: number,
  tint?: string,
): string {
  let fill = "#000000";
  let alpha = 1;
  const parts: string[] = [];
  const ctx: WearStampContext2D = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(value) {
      if (typeof value === "string") fill = value;
    },
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value) {
      alpha = value;
    },
    fillRect(x, y, rw, rh) {
      const opacity = alpha < 1 ? ` fill-opacity="${num(alpha)}"` : "";
      parts.push(
        `<rect x="${num(x)}" y="${num(y)}" width="${num(rw)}" height="${num(rh)}" fill="${esc(fill)}"${opacity}/>`,
      );
    },
  };
  paintSpline(ctx, points, kind, seed, cellSize, tint);
  return parts.join("");
}
