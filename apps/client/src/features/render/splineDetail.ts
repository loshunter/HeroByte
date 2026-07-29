// Spline element art (spline arc) — persistent authored curves: path ribbons
// and gold filigree (catalog rank 7's deferred devices) sweep a Catmull-Rom
// through the anchors; rope and chain hang each segment as a sagged span
// (rank 11's deferred sag arcs). Same fillStyle/globalAlpha/fillRect contract
// as the wear stamps, so Konva, the SVG export, the headless harness and
// tests share one implementation. Deterministic from the element-id seed;
// widths are bundled data in fractions of the grid cell, never wire data.

import { hash2 } from "./valueNoise";
import type { WearStampContext2D } from "./wearStampDetail";
import type { MapSplineElement } from "@herobyte/shared";

export type SplineKind = MapSplineElement["data"]["kind"];

/** Spline art colour sets — data, like the terrain palettes. */
export const SPLINE_ART = {
  ribbonStone: "#d8cba8",
  ribbonStoneAlt: "#cabb95",
  ribbonEdge: "#a3966f",
  ribbonTick: "#b8a97f",
  filigreeGold: "#d8a84a",
  filigreeBead: "#e8c06a",
  filigreeUnder: "#9a7428",
  ropeLine: "#8a6f4a",
  ropeLash: "#6d5138",
  ropePost: "#5f4630",
  chainLink: "#6a6d72",
  chainPost: "#4a4d52",
} as const;

interface SplineSample {
  x: number;
  y: number;
  /** unit tangent */
  tx: number;
  ty: number;
}

/** Catmull-Rom through the anchors, ~3px steps (ribbon/filigree). */
function sampleSmooth(points: readonly { x: number; y: number }[]): SplineSample[] {
  const out: SplineSample[] = [];
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let seg = 0; seg < points.length - 1; seg += 1) {
    const p0 = p(seg - 1);
    const p1 = p(seg);
    const p2 = p(seg + 1);
    const p3 = p(seg + 2);
    const span = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(span / 3));
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (p2.x - p0.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (p2.y - p0.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y, tx: 0, ty: 0 });
    }
  }
  const last = points[points.length - 1]!;
  out.push({ x: last.x, y: last.y, tx: 0, ty: 0 });
  return withTangents(out);
}

/** Per-segment parabolic sag (rope/chain): depth scales with span length. */
function sampleSagged(points: readonly { x: number; y: number }[]): SplineSample[] {
  const out: SplineSample[] = [];
  for (let seg = 0; seg < points.length - 1; seg += 1) {
    const a = points[seg]!;
    const b = points[seg + 1]!;
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = Math.min(span * 0.14, 40);
    const steps = Math.max(4, Math.ceil(span / 3));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t + sag * 4 * t * (1 - t),
        tx: 0,
        ty: 0,
      });
    }
  }
  return withTangents(out);
}

function withTangents(samples: SplineSample[]): SplineSample[] {
  for (let i = 0; i < samples.length; i += 1) {
    const a = samples[Math.max(0, i - 1)]!;
    const b = samples[Math.min(samples.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    samples[i]!.tx = (b.x - a.x) / len;
    samples[i]!.ty = (b.y - a.y) / len;
  }
  return samples;
}

const dot = (ctx: WearStampContext2D, x: number, y: number, s: number): void => {
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
};

/**
 * Paint one spline element. `points` are in the ctx's coordinate space,
 * `cellSize` scales the bundled widths, `seed` comes from the element id.
 */
export function paintSpline(
  ctx: WearStampContext2D,
  points: readonly { x: number; y: number }[],
  kind: SplineKind,
  seed: number,
  cellSize: number,
  tint?: string,
): void {
  if (points.length < 2) return;
  if (kind === "ribbon") paintRibbon(ctx, sampleSmooth(points), seed, cellSize, tint);
  else if (kind === "filigree") paintFiligree(ctx, sampleSmooth(points), seed, cellSize, tint);
  else paintHungLine(ctx, sampleSagged(points), points, kind, seed, cellSize, tint);
}

/** Pale stone path ribbon with edge contour dashes and perpendicular
 * cross-tick stones (rank 7's plaza-arc grammar). */
function paintRibbon(
  ctx: WearStampContext2D,
  samples: SplineSample[],
  seed: number,
  cellSize: number,
  tint?: string,
): void {
  const band = cellSize * 0.55;
  const step = Math.max(2, cellSize * 0.06);
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    ctx.fillStyle =
      tint ?? (hash2(i, 1, seed) < 0.5 ? SPLINE_ART.ribbonStone : SPLINE_ART.ribbonStoneAlt);
    dot(ctx, s.x, s.y, band);
    // Edge contour dashes on both sides, hash-thinned so they read hand-set.
    if (hash2(i, 2, seed) < 0.6) {
      ctx.fillStyle = SPLINE_ART.ribbonEdge;
      dot(ctx, s.x - s.ty * (band / 2), s.y + s.tx * (band / 2), step);
      dot(ctx, s.x + s.ty * (band / 2), s.y - s.tx * (band / 2), step);
    }
  }
  // Cross-tick stones every ~0.5t, perpendicular to travel.
  const tickEvery = Math.max(2, Math.round(cellSize * 0.5) / 3);
  for (let i = 0; i < samples.length; i += Math.round(tickEvery)) {
    const s = samples[i]!;
    ctx.fillStyle = SPLINE_ART.ribbonTick;
    const half = band * 0.38;
    const n = 4;
    for (let k = -n; k <= n; k += 1) {
      const f = (k / n) * half;
      dot(ctx, s.x - s.ty * f, s.y + s.tx * f, Math.max(1.5, cellSize * 0.05));
    }
  }
}

/** Thin gold double-line with bead dots — the filigree causeway inlay. */
function paintFiligree(
  ctx: WearStampContext2D,
  samples: SplineSample[],
  seed: number,
  cellSize: number,
  tint?: string,
): void {
  const line = Math.max(1.5, cellSize * 0.05);
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    ctx.fillStyle = SPLINE_ART.filigreeUnder;
    dot(ctx, s.x, s.y + 1, line);
    ctx.fillStyle = tint ?? SPLINE_ART.filigreeGold;
    dot(ctx, s.x, s.y, line);
  }
  const beadEvery = Math.max(4, Math.round(cellSize * 0.4) / 3);
  for (let i = 0; i < samples.length; i += Math.round(beadEvery)) {
    const s = samples[i]!;
    if (hash2(i, 3, seed) < 0.25) continue;
    ctx.fillStyle = SPLINE_ART.filigreeBead;
    dot(ctx, s.x, s.y, Math.max(2, cellSize * 0.08));
  }
}

/** Rope or chain: the sagged line, post dots at every anchor, and for rope a
 * pair of X-lashing ticks beside each post; chain draws alternating link
 * dashes instead of a continuous line. */
function paintHungLine(
  ctx: WearStampContext2D,
  samples: SplineSample[],
  anchors: readonly { x: number; y: number }[],
  kind: "rope" | "chain",
  seed: number,
  cellSize: number,
  tint?: string,
): void {
  const line = Math.max(1.5, cellSize * (kind === "chain" ? 0.07 : 0.055));
  ctx.fillStyle = tint ?? (kind === "chain" ? SPLINE_ART.chainLink : SPLINE_ART.ropeLine);
  for (let i = 0; i < samples.length; i += 1) {
    if (kind === "chain" && i % 4 === 3) continue; // link gaps
    const s = samples[i]!;
    dot(ctx, s.x, s.y, line);
  }
  const postSize = Math.max(3, cellSize * (kind === "chain" ? 0.16 : 0.13));
  for (const [ai, a] of anchors.entries()) {
    ctx.fillStyle = kind === "chain" ? SPLINE_ART.chainPost : SPLINE_ART.ropePost;
    dot(ctx, a.x, a.y, postSize);
    if (kind === "rope") {
      // X-lashing: two short diagonal tick runs crossing at the post.
      ctx.fillStyle = SPLINE_ART.ropeLash;
      const l = Math.max(1.5, cellSize * 0.045);
      for (let k = -2; k <= 2; k += 1) {
        if (k === 0) continue;
        const off = k * l * 1.2 * (1 + (hash2(ai, k + 5, seed) - 0.5) * 0.2);
        dot(ctx, a.x + off, a.y + off, l);
        dot(ctx, a.x + off, a.y - off, l);
      }
    }
  }
}
