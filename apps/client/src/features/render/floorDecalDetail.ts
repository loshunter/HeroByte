// Floor decals & inlays (Czepeku taxonomy catalog rank 7) — oversized
// low-contrast floor graphics that unify rooms and aim the eye: the tessera
// sun medallion (SacredBallcourt), the translucent tracery panel
// (PrintingPress). Rug and ceremony kinds join in the arc's second phase.
//
// These are decal KINDS on the wear-stamp machinery (wearStampDetail owns the
// kind union and dispatch): same deterministic seeding per element, same
// fillStyle/globalAlpha/fillRect contract so one painter drives the live
// Konva shape, the SVG export shim and the tests. Only TYPES are imported
// from wearStampDetail — the runtime dependency points the other way (its
// dispatch calls paintFloorDecal), so there is no module cycle. Inlay
// colours, like all prop art, are deliberately NOT night-graded.

import { hash2 } from "./valueNoise";
import type { WearDecalSpec, WearStampContext2D } from "./wearStampDetail";

/** The inlay art's colour set — data, like the terrain palettes. */
export const FLOOR_DECAL_ART = {
  /** The tessera emblem's three golds, light → dark (SacredBallcourt). */
  medallionGolds: ["#e0b147", "#d4a93e", "#c1922e"],
  /** Grout showing between tesserae and as each tessera's dark rim. */
  medallionGrout: "#6f5626",
  /** The pale tracery lattice, drawn at ~30% opacity. */
  tracery: "#e8dcc0",
} as const;

/** Hex value shift (positive lightens) — the tone-on-tone workhorse. */
export function shadeHex(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, v + delta));
  const rgb = ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)) >>> 0;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/** fillRect clamped to the stamp footprint (skips empty/negative rects). */
function rect(
  ctx: WearStampContext2D,
  x: number,
  y: number,
  rw: number,
  rh: number,
  w: number,
  h: number,
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(w, x + rw);
  const y1 = Math.min(h, y + rh);
  if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** Route one floor-decal kind (called by wearStampDetail's dispatch). */
export function paintFloorDecal(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  spec: WearDecalSpec,
  tint?: string,
): void {
  void tint; // P2's rug/ceremony kinds are tint-recolourable; P1's are fixed art
  if (spec.kind === "medallion") paintMedallion(ctx, w, h, seed);
  else if (spec.kind === "tracery") paintTracery(ctx, w, h, seed);
}

/**
 * Tessera sun medallion: a region mask — centre disc, sixteen alternating
 * ray wedges, an outer ring, in the three golds — sampled by a jittered
 * tessera lattice. Each tessera draws grout, a light top-left bevel, then
 * its value-jittered face offset down-right, so the mosaic reads as raised
 * hand-set stone; sparse dropout is the centuries of foot traffic.
 */
function paintMedallion(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.48;
  const pitch = Math.max(3, Math.min(w, h) * 0.045);
  const golds = FLOOR_DECAL_ART.medallionGolds;
  const cols = Math.ceil(w / pitch);
  const rows = Math.ceil(h / pitch);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (hash2(i, j, seed + 301) < 0.07) continue; // wear dropout
      const x = i * pitch + (hash2(i * 3, j * 5, seed + 302) - 0.5) * pitch * 0.4;
      const y = j * pitch + (hash2(i * 7, j * 3, seed + 303) - 0.5) * pitch * 0.4;
      const u = (x + pitch / 2 - cx) / R;
      const v = (y + pitch / 2 - cy) / R;
      const r = Math.hypot(u, v);
      let tone: string | null = null;
      if (r < 0.2) tone = golds[0]!;
      else if (r < 0.68) {
        const wedge = Math.floor(((Math.atan2(v, u) + Math.PI) / (Math.PI * 2)) * 16);
        tone = wedge % 2 === 0 ? golds[1]! : golds[2]!;
      } else if (r >= 0.76 && r < 0.9) tone = golds[0]!;
      if (!tone) continue; // between band and ring — the floor shows through
      const s = pitch * 0.9;
      const val = Math.round((hash2(i, j, seed + 304) - 0.5) * 16);
      ctx.fillStyle = FLOOR_DECAL_ART.medallionGrout;
      rect(ctx, x, y, s, s, w, h);
      ctx.fillStyle = shadeHex(tone, val + 24);
      rect(ctx, x + 1, y + 1, s - 2, s - 2, w, h);
      ctx.fillStyle = shadeHex(tone, val);
      rect(ctx, x + 2, y + 2, s - 3, s - 3, w, h);
    }
  }
}

/**
 * Tracery panel: an oversized diamond lattice in one pale tone at 30%
 * opacity — big enough to unify a whole room, faint enough that tokens and
 * scatter stay readable over it. Diamonds run midpoint-to-midpoint per
 * lattice cell as stepped dab chains (the fillRect curve idiom); shared
 * chain endpoints double their alpha where cells meet, which reads as the
 * quatrefoil stud at every lattice crossing for free.
 */
function paintTracery(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const p = Math.min(w, h) / 4.5;
  const dab = Math.max(1, p * 0.09);
  const steps = 8;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = FLOOR_DECAL_ART.tracery;
  const chain = (x: number, y: number, jx: number, jy: number): void => {
    const wob = (hash2(Math.round(x + jx * 977), Math.round(y + jy * 397), seed + 311) - 0.5) * dab;
    rect(ctx, x - dab / 2 + wob, y - dab / 2 + wob, dab, dab, w, h);
  };
  const cols = Math.max(1, Math.round(w / p));
  const rows = Math.max(1, Math.round(h / p));
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x0 = i * p;
      const y0 = j * p;
      for (let k = 0; k < steps; k += 1) {
        const t = (k / steps) * (p / 2);
        chain(x0 + p / 2 + t, y0 + t, i, j); // top → right
        chain(x0 + p - t, y0 + p / 2 + t, i + 1, j); // right → bottom
        chain(x0 + p / 2 - t, y0 + p - t, i, j + 1); // bottom → left
        chain(x0 + t, y0 + p / 2 - t, i, j + 2); // left → top
      }
      // Centre stud, one size up — the motif's heart.
      rect(ctx, x0 + p / 2 - dab, y0 + p / 2 - dab, dab * 2, dab * 2, w, h);
    }
  }
  ctx.globalAlpha = 1;
}
