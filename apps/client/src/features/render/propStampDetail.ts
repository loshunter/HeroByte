// Prop stamp art (island benchmark arc) — the first pieces of the prop-kit
// roadmap, riding the wear-stamp machinery: kinds are bundled asset data, so
// the union grows with zero wire impact, and one painter serves Konva, the
// SVG export and tests. fillRect-only like every stamp painter, seeded from
// the element id, geometry in fractions of the stamp footprint.

import { hash2 } from "./valueNoise";
import type { WearStampContext2D } from "./wearStampDetail";

/** Prop art colour sets — data, kept in one place like the terrain palettes
 * (exported so tests pin colours instead of magic literals). */
export const PROP_STAMP_ART = {
  /** Rowboat: gunwale timber, deck tans, thwart benches, wake foam. */
  boatGunwale: "#5f4630",
  boatDeck: "#b08a55",
  boatDeckLight: "#c39a63",
  boatThwart: "#6d5138",
  boatWake: "#e8f4f6",
  /** Gull: white body/wings with a slate wingtip. */
  gullBody: "#f2f6f6",
  gullTip: "#8f9ba0",
  /** Menhir: lit/shade granite over an ink underlay, moss flecks. */
  menhirLit: "#949b9e",
  menhirShade: "#5c6469",
  menhirInk: "#383e44",
  menhirMoss: "#6a7a34",
  menhirShadow: "#2c3138",
} as const;

const rect = (ctx: WearStampContext2D, x: number, y: number, w: number, h: number): void => {
  if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
};

/** Route one prop stamp kind to its painter. */
export function paintPropStamp(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  kind: "boat" | "gull" | "menhir",
): void {
  if (kind === "boat") paintBoat(ctx, w, h, seed);
  else if (kind === "gull") paintGull(ctx, w, h, seed);
  else paintMenhir(ctx, w, h, seed);
}

/** Rowboat, bow up: pointed-oval hull sliced into rows — gunwale timber ring
 * around a plank deck — two thwart benches, and two faint wake slivers off
 * the starboard side (the boat-hull grammar's dinghy tier). */
function paintBoat(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const pad = h * 0.06;
  const maxHalf = w * 0.34;
  const gw = Math.max(1.5, w * 0.09);
  const slices = 16;
  const sliceH = (h - 2 * pad) / slices;
  const halfAt = (t: number): number => {
    const taper = t < 0.55 ? 0.08 + 0.92 * (t / 0.55) : 1 - 0.28 * ((t - 0.55) / 0.45);
    const jitter = 1 + (hash2(Math.round(t * slices), 1, seed) - 0.5) * 0.08;
    return maxHalf * taper * jitter;
  };
  for (let i = 0; i < slices; i += 1) {
    const t = (i + 0.5) / slices;
    const y = pad + i * sliceH;
    const half = halfAt(t);
    ctx.fillStyle = PROP_STAMP_ART.boatGunwale;
    rect(ctx, cx - half, y, half * 2, sliceH + 0.5);
    const inner = half - gw;
    if (inner > 0) {
      ctx.fillStyle =
        hash2(i, 2, seed) < 0.35 ? PROP_STAMP_ART.boatDeckLight : PROP_STAMP_ART.boatDeck;
      rect(ctx, cx - inner, y, inner * 2, sliceH + 0.5);
    }
  }
  // Thwart benches across the interior.
  ctx.fillStyle = PROP_STAMP_ART.boatThwart;
  for (const t of [0.38, 0.64]) {
    const half = halfAt(t) - gw * 0.6;
    rect(ctx, cx - half, pad + t * (h - 2 * pad) - h * 0.025, half * 2, h * 0.05);
  }
  // Wake slivers: faint foam trailing off one side.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = PROP_STAMP_ART.boatWake;
  for (const t of [0.3, 0.58]) {
    const half = halfAt(t);
    rect(ctx, cx + half + w * 0.05, pad + t * (h - 2 * pad), Math.max(1, w * 0.05), h * 0.1);
  }
  ctx.globalAlpha = 1;
}

/** Gull from above: two wing bars stepping out from a body dot — the classic
 * distant-bird chevron, slate tip on the outer step. */
function paintGull(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const step = Math.max(1, w * 0.14);
  const bar = Math.max(1, h * 0.12);
  const rise = (hash2(1, 3, seed) - 0.5) * bar; // slight wing-slope variety
  ctx.fillStyle = PROP_STAMP_ART.gullBody;
  rect(ctx, cx - step / 2, cy - bar / 2, step, bar * 1.3);
  for (let s = 1; s <= 3; s += 1) {
    ctx.fillStyle = s === 3 ? PROP_STAMP_ART.gullTip : PROP_STAMP_ART.gullBody;
    const lift = s * bar * 0.55 + rise * s * 0.4;
    rect(ctx, cx - step / 2 - s * step, cy - bar / 2 - lift, step, bar);
    rect(ctx, cx + step / 2 + (s - 1) * step, cy - bar / 2 - lift, step, bar);
  }
}

/** Standing stone: an ink-underlay boulder in stacked jittered slices, split
 * lit (sun side, up-right) / shade, seated by a soft ground-shadow blob and
 * aged by sparse moss flecks. */
function paintMenhir(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const pad = h * 0.08;
  const maxHalf = w * 0.3;
  const slices = 9;
  const sliceH = (h - 2 * pad) / slices;
  // Ground shadow first, so the stone overdraws its upper edge.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = PROP_STAMP_ART.menhirShadow;
  rect(ctx, cx - maxHalf * 1.2, h - pad - sliceH * 1.6, maxHalf * 1.9, sliceH * 1.6);
  ctx.globalAlpha = 1;
  for (let i = 0; i < slices; i += 1) {
    const t = (i + 0.5) / slices;
    const y = pad + i * sliceH;
    const profile = 0.55 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.12));
    const half = maxHalf * profile * (1 + (hash2(i, 5, seed) - 0.5) * 0.3);
    const lean = (hash2(i, 6, seed) - 0.5) * w * 0.06;
    // Ink underlay slightly wider than the lit/shade fill = the contour.
    ctx.fillStyle = PROP_STAMP_ART.menhirInk;
    rect(ctx, cx + lean - half - 1, y, half * 2 + 2, sliceH + 1);
    const split = 0.35 + (hash2(i, 7, seed) - 0.5) * 0.2;
    ctx.fillStyle = PROP_STAMP_ART.menhirShade;
    rect(ctx, cx + lean - half, y + 1, half * 2 * split, sliceH - 1);
    ctx.fillStyle = PROP_STAMP_ART.menhirLit;
    rect(ctx, cx + lean - half + half * 2 * split, y + 1, half * 2 * (1 - split), sliceH - 1);
  }
  // Moss flecks near the base.
  ctx.fillStyle = PROP_STAMP_ART.menhirMoss;
  for (let m = 0; m < 3; m += 1) {
    if (hash2(m, 8, seed) > 0.5) continue;
    const p = Math.max(1, w * 0.05);
    rect(
      ctx,
      cx + (hash2(m, 9, seed) - 0.5) * maxHalf,
      h - pad - sliceH * (1.2 + hash2(m, 10, seed)),
      p,
      p,
    );
  }
}
