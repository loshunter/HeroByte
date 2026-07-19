// Detail-pass context wrappers (split from proceduralTerrainSurface for the
// 350-LOC cap): the clip that keeps fillRect detail on the right side of a
// bumpy field seam, and the tint that drowns a sunken structure's detail
// colours toward the water. Both forward ONLY the members the detail painters
// touch (fillStyle + fillRect and the shared no-op surface), so painters are
// reused verbatim instead of forking their math.

import type { TileRenderContext2D } from "./tileRenderCore";

/**
 * Wrap a context so only fillRects whose CENTRE passes `keep` reach it — the
 * clip that keeps interior detail on the right side of a bumpy seam. The detail
 * painters (paintTerrainDetail / paintKeyClusterDetail) touch only `fillStyle`
 * and `fillRect`, so this reuses them verbatim instead of forking their math.
 */
export function makeClipCtx(
  real: TileRenderContext2D,
  keep: (worldX: number, worldY: number) => boolean,
): TileRenderContext2D {
  return {
    get fillStyle() {
      return real.fillStyle;
    },
    set fillStyle(value) {
      real.fillStyle = value;
    },
    get strokeStyle() {
      return real.strokeStyle;
    },
    set strokeStyle(value) {
      real.strokeStyle = value;
    },
    get lineWidth() {
      return real.lineWidth;
    },
    set lineWidth(value) {
      real.lineWidth = value;
    },
    get globalAlpha() {
      return real.globalAlpha;
    },
    set globalAlpha(value) {
      real.globalAlpha = value;
    },
    get imageSmoothingEnabled() {
      return real.imageSmoothingEnabled;
    },
    set imageSmoothingEnabled(value) {
      real.imageSmoothingEnabled = value;
    },
    fillRect(x, y, w, h) {
      if (keep(x + w / 2, y + h / 2)) real.fillRect(x, y, w, h);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    drawImage() {},
  };
}

/**
 * Wrap a context so every hex fillStyle a painter sets is remapped through
 * `map` before reaching the real context — how a sunken family reuses its dry
 * sibling's painters while every colour they draw is pulled toward the water.
 * Non-hex styles (none of the palette painters emit any) pass through.
 */
export function makeTintCtx(
  real: TileRenderContext2D,
  map: (hex: string) => string,
): TileRenderContext2D {
  return {
    get fillStyle() {
      return real.fillStyle;
    },
    set fillStyle(value) {
      real.fillStyle = typeof value === "string" && value.startsWith("#") ? map(value) : value;
    },
    get strokeStyle() {
      return real.strokeStyle;
    },
    set strokeStyle(value) {
      real.strokeStyle = value;
    },
    get lineWidth() {
      return real.lineWidth;
    },
    set lineWidth(value) {
      real.lineWidth = value;
    },
    get globalAlpha() {
      return real.globalAlpha;
    },
    set globalAlpha(value) {
      real.globalAlpha = value;
    },
    get imageSmoothingEnabled() {
      return real.imageSmoothingEnabled;
    },
    set imageSmoothingEnabled(value) {
      real.imageSmoothingEnabled = value;
    },
    fillRect(x, y, w, h) {
      real.fillRect(x, y, w, h);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    drawImage() {},
  };
}
