// Spline painter — ribbons, filigree, rope, chain (spline arc). Pins: every
// kind paints deterministic fillRect(+alpha)-only art, rope grows posts and
// X-lashings at anchors, chain leaves link gaps, the ribbon band is an order
// wider than the filigree line, and the SVG recorder is byte-deterministic.

import { describe, expect, it } from "vitest";
import { paintSpline, SPLINE_ART, type SplineKind } from "../splineDetail";
import { splineSvgMarkup } from "../splineSvg";
import type { WearStampContext2D } from "../wearStampDetail";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

const POINTS = [
  { x: 0, y: 0 },
  { x: 150, y: 60 },
  { x: 320, y: 20 },
];
const CELL = 50;

function paint(kind: SplineKind, seed = 7): RecordedCall[] {
  const r = createRecordingContext();
  paintSpline(r.context as unknown as WearStampContext2D, POINTS, kind, seed, CELL);
  return r.calls;
}

function rectsWithStyle(calls: RecordedCall[]): { style: string; rect: number[] }[] {
  let style = "";
  const out: { style: string; rect: number[] }[] = [];
  for (const call of calls) {
    if (call[0] === "set:fillStyle") style = call[1] as string;
    else if (call[0] === "fillRect") out.push({ style, rect: call.slice(1) as number[] });
  }
  return out;
}

describe("spline painter", () => {
  it("paints all four kinds, deterministic, fillRect(+alpha)-only", () => {
    for (const kind of ["ribbon", "filigree", "rope", "chain"] as const) {
      const calls = paint(kind);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toEqual(paint(kind));
      const ops = new Set(calls.map(([op]) => op));
      ops.delete("fillRect");
      ops.delete("set:fillStyle");
      ops.delete("set:globalAlpha");
      expect([...ops]).toEqual([]);
    }
  });

  it("rope grows posts and X-lashings at every anchor", () => {
    const rects = rectsWithStyle(paint("rope"));
    expect(rects.filter((r) => r.style === SPLINE_ART.ropePost).length).toBe(POINTS.length);
    expect(rects.filter((r) => r.style === SPLINE_ART.ropeLash).length).toBeGreaterThan(0);
  });

  it("chain leaves link gaps (sparser line than rope)", () => {
    const ropeLine = rectsWithStyle(paint("rope")).filter(
      (r) => r.style === SPLINE_ART.ropeLine,
    ).length;
    const chainLine = rectsWithStyle(paint("chain")).filter(
      (r) => r.style === SPLINE_ART.chainLink,
    ).length;
    expect(chainLine).toBeLessThan(ropeLine);
    expect(chainLine).toBeGreaterThan(0);
  });

  it("the ribbon band dwarfs the filigree line", () => {
    const bandW = Math.max(
      ...rectsWithStyle(paint("ribbon"))
        .filter((r) => r.style === SPLINE_ART.ribbonStone)
        .map((r) => r.rect[2]!),
    );
    const lineW = Math.max(
      ...rectsWithStyle(paint("filigree"))
        .filter((r) => r.style === SPLINE_ART.filigreeGold)
        .map((r) => r.rect[2]!),
    );
    expect(bandW).toBeGreaterThan(lineW * 4);
  });

  it("SVG recorder is byte-deterministic and carries the art", () => {
    const markup = splineSvgMarkup(POINTS, "filigree", 7, CELL);
    expect(markup).toBe(splineSvgMarkup(POINTS, "filigree", 7, CELL));
    expect(markup).toContain(SPLINE_ART.filigreeGold);
  });
});
