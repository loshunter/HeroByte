// groundDecal wear stamps (Czepeku taxonomy catalog rank 8) — human activity
// written into the floor with zero objects: sparring rings of scuffed dabs,
// scorch craters with radial streak spokes, and process-stain blobs in a
// prop-declared colour. Pure deterministic fillRect art, like every other
// painter, seeded per placed element so each stamp is unique yet stable on
// every client, surface and redraw.
//
// The painter deliberately touches ONLY fillStyle, globalAlpha and fillRect:
// that subset is what lets ONE implementation drive the live Konva shape
// (MapElementsLayer), the SVG export shim (wearStampSvg), and the recording
// context in tests without forking the art. Geometry is fractions of the
// stamp footprint, so a scattered 2×2 stain and a placed 3×3 ring both read
// correctly at any grid size. Decal colours are intentionally NOT night-graded
// — props keep their warmth under the grade (catalog rank 3's accent rule).

import { hash2 } from "./valueNoise";
import { paintFloorDecal } from "./floorDecalDetail";

/** The context slice the wear painter draws through (see module note). */
export interface WearStampContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  fillRect(x: number, y: number, width: number, height: number): void;
}

/** All decal art kinds. "Wear" in the surrounding names is historical — the
 * floor-decal kinds (catalog rank 7, floorDecalDetail) joined the same
 * machinery; kinds are bundled asset data, never wire data, so the union
 * grows freely with zero schema impact. */
export type WearStampKind = "ring" | "scorch" | "stain" | "medallion" | "tracery";

/** Per-asset decal declaration (starterTileAssets `decal`). `color` is the
 * stain hue a prop declares; ring/scorch art is fixed. */
export interface WearDecalSpec {
  kind: WearStampKind;
  color?: string;
}

/** The wear art's colour set — data, kept in one place like the terrain
 * palettes (exported so tests pin colours instead of magic literals). */
export const WEAR_STAMP_ART = {
  /** Sparring-ring scuff tans, light → dark. */
  ringScuff: ["#d8a76c", "#c9925f", "#a8713f"],
  /** The red flecks breaking the ring's circumference. */
  ringSplatter: "#8e2f22",
  scorchCore: "#241d18",
  scorchMid: "#5b4c3e",
  scorchStreak: "#2b241e",
  /** Displaced-earth lumps around the crater rim. */
  scorchEarth: "#91785c",
  /** Translucent cool wash over the burnt interior. */
  scorchCool: "#4a5568",
  /** Stain hue when neither the asset nor a tint declares one. */
  stainFallback: "#6b4a86",
} as const;

/** FNV-1a over the element id — the per-placement seed. */
export function wearStampSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** fillRect clamped to the stamp footprint, so no dab pokes past the bounds
 * the hit-test and the exporter advertise. */
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

/** A scuff dab: 2–3 overlapping rects clustered on a centre — the hand-worn
 * irregular mark that stops the geometry reading as vector art. */
function dab(
  ctx: WearStampContext2D,
  cx: number,
  cy: number,
  r: number,
  w: number,
  h: number,
  k: number,
  seed: number,
): void {
  const n = 2 + Math.floor(hash2(k, 101, seed) * 1.999);
  for (let i = 0; i < n; i += 1) {
    const ox = (hash2(k * 5 + i, 102, seed) - 0.5) * r;
    const oy = (hash2(k * 7 + i, 103, seed) - 0.5) * r;
    const s = r * (0.6 + hash2(k * 3 + i, 104, seed) * 0.6);
    rect(ctx, cx + ox - s / 2, cy + oy - s / 2, s, s, w, h);
  }
}

/**
 * Paint one wear stamp into local coords (0,0)–(w,h). `tint` (the element's
 * inspector tint) recolours a STAIN; ring/scorch ignore it — their art is a
 * material, not a hue.
 */
export function paintWearStamp(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  spec: WearDecalSpec,
  tint?: string,
): void {
  if (spec.kind === "ring") paintRing(ctx, w, h, seed);
  else if (spec.kind === "scorch") paintScorch(ctx, w, h, seed);
  else if (spec.kind === "stain")
    paintStain(ctx, w, h, seed, tint ?? spec.color ?? WEAR_STAMP_ART.stainFallback);
  // Every other kind is a floor decal (rank 7) — routed, never fallen into.
  else paintFloorDecal(ctx, w, h, seed, spec, tint);
}

/** Sparring ring: a dab circle with worn gaps, faint interior scuffs, and 2–3
 * splatter-fleck arcs breaking the circumference (TrainingGrounds). */
function paintRing(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  const R = m * 0.36;
  const dabR = m * 0.055;
  const n = 26;
  for (let i = 0; i < n; i += 1) {
    if (hash2(i, 7, seed) < 0.14) continue; // worn unevenly — gaps
    const a = (i / n) * Math.PI * 2 + (hash2(i, 8, seed) - 0.5) * 0.25;
    const rr = R * (0.88 + hash2(i, 9, seed) * 0.24);
    const shade = hash2(i, 10, seed);
    ctx.fillStyle = WEAR_STAMP_ART.ringScuff[shade < 0.34 ? 0 : shade < 0.72 ? 1 : 2]!;
    dab(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, dabR, w, h, i, seed);
  }
  // Faint interior scuffs — the ground inside the ring is walked too.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = WEAR_STAMP_ART.ringScuff[1]!;
  for (let i = 0; i < 7; i += 1) {
    const a = hash2(i, 11, seed) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i, 12, seed)) * R * 0.7;
    dab(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, dabR * 0.8, w, h, 40 + i, seed);
  }
  ctx.globalAlpha = 1;
  // Splatter flecks in 2–3 tight arcs — the marks that break the circle.
  ctx.fillStyle = WEAR_STAMP_ART.ringSplatter;
  const clusters = 2 + (hash2(3, 13, seed) > 0.5 ? 1 : 0);
  for (let c = 0; c < clusters; c += 1) {
    const ca = hash2(c, 14, seed) * Math.PI * 2;
    const flecks = 4 + Math.floor(hash2(c, 15, seed) * 4);
    for (let f = 0; f < flecks; f += 1) {
      const a = ca + (hash2(c * 17 + f, 16, seed) - 0.5) * 0.7;
      const rr = R * (0.8 + hash2(c * 19 + f, 17, seed) * 0.45);
      const s = Math.max(1, m * (0.012 + hash2(c * 23 + f, 18, seed) * 0.014));
      rect(ctx, cx + Math.cos(a) * rr - s / 2, cy + Math.sin(a) * rr - s / 2, s, s, w, h);
    }
  }
}

/** Scorch crater: charred dab disc, near-black streak spokes past the rim as
 * stepped dab-chains, pale displaced-earth lumps, cool wash (GnomeMinefield). */
function paintScorch(ctx: WearStampContext2D, w: number, h: number, seed: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  const coreR = m * 0.3;
  for (let i = 0; i < 34; i += 1) {
    const a = hash2(i, 21, seed) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i, 22, seed)) * coreR;
    ctx.fillStyle = rr < coreR * 0.6 ? WEAR_STAMP_ART.scorchCore : WEAR_STAMP_ART.scorchMid;
    dab(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, m * 0.06, w, h, 60 + i, seed);
  }
  // Radial streak spokes: dab-chains thinning outward (fillRect has no
  // rotation, so a stepped chain of small squares IS the streak — the same
  // pixel idiom as the rest of the corpus art).
  ctx.fillStyle = WEAR_STAMP_ART.scorchStreak;
  const spokes = 10 + Math.floor(hash2(1, 23, seed) * 4);
  for (let s = 0; s < spokes; s += 1) {
    const a = (s / spokes) * Math.PI * 2 + (hash2(s, 24, seed) - 0.5) * 0.4;
    const len = m * (0.38 + hash2(s, 25, seed) * 0.14);
    for (let rr = coreR * 0.85; rr < len; rr += m * 0.045) {
      // Thin toward the tip: drop more steps the further out the chain gets.
      if (hash2(s * 31 + Math.round(rr), 26, seed) < (rr / len) * 0.55) continue;
      const jx = (hash2(s * 37 + Math.round(rr), 27, seed) - 0.5) * m * 0.03;
      const size = Math.max(1, m * 0.024 * (1.2 - rr / len));
      rect(
        ctx,
        cx + Math.cos(a) * rr + jx - size / 2,
        cy + Math.sin(a) * rr - size / 2,
        size,
        size,
        w,
        h,
      );
    }
  }
  // Displaced-earth lumps around the rim.
  ctx.fillStyle = WEAR_STAMP_ART.scorchEarth;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + (hash2(i, 28, seed) - 0.5) * 0.5;
    const rr = coreR * (1.02 + hash2(i, 29, seed) * 0.18);
    dab(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, m * 0.035, w, h, 80 + i, seed);
  }
  // Cool interior wash — translucent, over the char.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = WEAR_STAMP_ART.scorchCool;
  for (let i = 0; i < 5; i += 1) {
    const a = hash2(i, 30, seed) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i, 31, seed)) * coreR * 0.6;
    const s = m * 0.16;
    rect(ctx, cx + Math.cos(a) * rr - s / 2, cy + Math.sin(a) * rr - s / 2, s, s, w, h);
  }
  ctx.globalAlpha = 1;
}

/** Process stain: 2–4 irregular translucent blobs whose overlaps build the
 * darker heart — dye, ink or wax in the declared colour. */
function paintStain(
  ctx: WearStampContext2D,
  w: number,
  h: number,
  seed: number,
  color: string,
): void {
  const m = Math.min(w, h);
  const blobs = 2 + Math.floor(hash2(1, 41, seed) * 2.999);
  ctx.fillStyle = color;
  for (let b = 0; b < blobs; b += 1) {
    const bx = w * (0.25 + hash2(b, 42, seed) * 0.5);
    const by = h * (0.25 + hash2(b, 43, seed) * 0.5);
    const bR = m * (0.12 + hash2(b, 44, seed) * 0.1);
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 12; i += 1) {
      const a = hash2(b * 13 + i, 45, seed) * Math.PI * 2;
      const rr = Math.sqrt(hash2(b * 17 + i, 46, seed)) * bR;
      const s = bR * (0.5 + hash2(b * 19 + i, 47, seed) * 0.3);
      rect(ctx, bx + Math.cos(a) * rr - s / 2, by + Math.sin(a) * rr - s / 2, s, s, w, h);
    }
    // A denser heart where the spill pooled.
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 3; i += 1) {
      const a = hash2(b * 23 + i, 48, seed) * Math.PI * 2;
      const rr = Math.sqrt(hash2(b * 29 + i, 49, seed)) * bR * 0.4;
      const s = bR * 0.5;
      rect(ctx, bx + Math.cos(a) * rr - s / 2, by + Math.sin(a) * rr - s / 2, s, s, w, h);
    }
  }
  ctx.globalAlpha = 1;
}
