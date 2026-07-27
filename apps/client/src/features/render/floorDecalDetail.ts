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
  /** Rug hue when neither the asset nor a tint declares one. */
  rugFallback: "#b25665",
  /** Ceremonial-stain hue fallback (the dread-red radial). */
  ceremonyFallback: "#6e2318",
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

/** Route one floor-decal kind (called by wearStampDetail's dispatch). The
 * rug and ceremony hues are prop-declared and tint-overridable (the stain
 * rule); medallion and tracery are fixed art — materials, not hues. */
export function paintFloorDecal(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  spec: WearDecalSpec,
  tint?: string,
): void {
  if (spec.kind === "medallion") paintMedallion(ctx, w, h, seed);
  else if (spec.kind === "tracery") paintTracery(ctx, w, h, seed);
  else if (spec.kind === "rug")
    paintRug(ctx, w, h, seed, tint ?? spec.color ?? FLOOR_DECAL_ART.rugFallback);
  else if (spec.kind === "ceremony")
    paintCeremony(ctx, w, h, seed, tint ?? spec.color ?? FLOOR_DECAL_ART.ceremonyFallback);
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

/**
 * Tone-on-tone rug (portrait; R rotates a runner sideways): value-jittered
 * weave rows between ragged fringe ends, a darker border band carrying
 * alternating light scroll dashes and corner squares, and a lighter centre
 * sigil diamond. Everything derives from ONE declared hue by value shifts,
 * so a tint recolours the whole rug coherently.
 */
function paintRug(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  color: string,
): void {
  const inset = Math.max(1, Math.min(w, h) * 0.03);
  const fringe = Math.max(2, h * 0.035);
  const rowH = Math.max(2, h * 0.045);
  for (let y = fringe, row = 0; y < h - fringe; y += rowH, row += 1) {
    ctx.fillStyle = shadeHex(color, Math.round((hash2(row, 3, seed + 403) - 0.5) * 14));
    rect(ctx, inset, y, w - 2 * inset, Math.min(rowH, h - fringe - y), w, h);
  }
  // Ragged fringe ticks off both short ends — the hand-worn edge.
  const tick = Math.max(1, w * 0.025);
  ctx.fillStyle = shadeHex(color, -8);
  for (let x = inset, k = 0; x < w - inset - tick; x += tick * 1.6, k += 1) {
    if (hash2(k, 5, seed + 404) > 0.25) {
      rect(ctx, x, fringe * (1 - hash2(k, 6, seed + 405)), tick, fringe, w, h);
    }
    if (hash2(k, 7, seed + 406) > 0.25) {
      rect(ctx, x, h - fringe, tick, fringe * hash2(k, 8, seed + 407), w, h);
    }
  }
  // Border band with scroll dashes and corner squares.
  const border = shadeHex(color, -30);
  const light = shadeHex(color, +26);
  const bIn = Math.min(w, h) * 0.1;
  const bT = Math.max(2, Math.min(w, h) * 0.055);
  const bx0 = inset + bIn;
  const bx1 = w - inset - bIn;
  const by0 = fringe + bIn;
  const by1 = h - fringe - bIn;
  ctx.fillStyle = border;
  rect(ctx, bx0, by0, bx1 - bx0, bT, w, h);
  rect(ctx, bx0, by1 - bT, bx1 - bx0, bT, w, h);
  rect(ctx, bx0, by0, bT, by1 - by0, w, h);
  rect(ctx, bx1 - bT, by0, bT, by1 - by0, w, h);
  ctx.fillStyle = light;
  const dash = bT * 0.5;
  for (let x = bx0 + bT * 1.6, k = 0; x < bx1 - bT * 1.6; x += bT * 1.7, k += 1) {
    if (k % 2 === 0) {
      rect(ctx, x, by0 + bT * 0.28, dash, dash, w, h);
      rect(ctx, x, by1 - bT * 0.72, dash, dash, w, h);
    }
  }
  for (let y = by0 + bT * 1.6, k = 0; y < by1 - bT * 1.6; y += bT * 1.7, k += 1) {
    if (k % 2 === 0) {
      rect(ctx, bx0 + bT * 0.28, y, dash, dash, w, h);
      rect(ctx, bx1 - bT * 0.72, y, dash, dash, w, h);
    }
  }
  const corner = bT * 1.35;
  rect(ctx, bx0, by0, corner, corner, w, h);
  rect(ctx, bx1 - corner, by0, corner, corner, w, h);
  rect(ctx, bx0, by1 - corner, corner, corner, w, h);
  rect(ctx, bx1 - corner, by1 - corner, corner, corner, w, h);
  // Centre sigil: a lighter diamond of stepped dabs (~15% lift).
  const cx = w / 2;
  const cy = (by0 + by1) / 2;
  const sig = Math.min(bx1 - bx0, by1 - by0) * 0.17;
  const sdab = Math.max(1, sig * 0.24);
  for (let k = 0; k < 8; k += 1) {
    const t = (k / 8) * sig;
    for (const [dx, dy] of [
      [t, -sig + t],
      [sig - t, t],
      [-t, sig - t],
      [-sig + t, -t],
    ]) {
      rect(ctx, cx + dx! - sdab / 2, cy + dy! - sdab / 2, sdab, sdab, w, h);
    }
  }
  rect(ctx, cx - sdab, cy - sdab, sdab * 2, sdab * 2, w, h);
}

/**
 * Radial ceremonial stain: translucent dab rings fading outward — the
 * multiply gradient that marks a story focal point (ExecutionSquare's
 * dread-red). Overlaps build the darker heart organically.
 */
function paintCeremony(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  color: string,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.46;
  const rings = 7;
  ctx.fillStyle = color;
  for (let q = 0; q < rings; q += 1) {
    ctx.globalAlpha = 0.26 * (1 - q / rings) + 0.03;
    const rr = (R * (q + 1)) / rings;
    const dabs = 6 + q * 5;
    const s = R * 0.3 * (1 - q / (rings * 2));
    for (let i = 0; i < dabs; i += 1) {
      const a = (i / dabs) * Math.PI * 2 + hash2(i, q, seed + 501) * 0.8;
      const rj = rr * (0.8 + hash2(i * 3, q, seed + 502) * 0.35);
      rect(ctx, cx + Math.cos(a) * rj - s / 2, cy + Math.sin(a) * rj - s / 2, s, s, w, h);
    }
  }
  ctx.globalAlpha = 1;
}
