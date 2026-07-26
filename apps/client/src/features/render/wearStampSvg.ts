// SVG adapter for the wear-stamp painter (catalog rank 8): drives
// paintWearStamp through a rect-recording context and returns the calls as
// `<rect …/>` markup, so the map export draws the SAME deterministic art the
// live Konva layer does instead of the flat-rect fallback. Kept beside the
// painter (not in exportMapDocument) for the 350-LOC cap and so the recorded
// subset stays pinned to the painter's contract in one place.

import { paintWearStamp, type WearDecalSpec, type WearStampContext2D } from "./wearStampDetail";

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
 * The wear art for one stamp as SVG rect markup (no wrapper group — the
 * exporter owns the footprint transform). Pure and deterministic on
 * (spec, w, h, seed, tint), byte-for-byte.
 */
export function wearStampSvgMarkup(
  spec: WearDecalSpec,
  w: number,
  h: number,
  seed: number,
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
  paintWearStamp(ctx, w, h, seed, spec, tint);
  return parts.join("");
}
