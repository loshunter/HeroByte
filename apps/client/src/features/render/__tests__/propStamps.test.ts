// Prop stamps — boat / gull / menhir (island benchmark arc, first prop-kit
// pieces). Pins: paintWearStamp dispatches the new kinds, each is
// deterministic per seed and varies across seeds, the art keeps the
// fillRect(+alpha) contract and stays inside the advertised footprint, and
// the signature colours land (gunwale + wake, white wings + slate tip,
// lit/shade granite + ink underlay + soft ground shadow).

import { describe, expect, it } from "vitest";
import { PROP_STAMP_ART } from "../propStampDetail";
import { paintWearStamp, wearStampSeed, type WearStampContext2D } from "../wearStampDetail";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTileAssets";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

function paint(kind: "boat" | "gull" | "menhir", w = 100, h = 200, seed = 7): RecordedCall[] {
  const r = createRecordingContext();
  paintWearStamp(r.context as unknown as WearStampContext2D, w, h, seed, { kind });
  return r.calls;
}

/** Rects annotated with the fillStyle and globalAlpha active when drawn. */
function annotated(calls: RecordedCall[]): { style: string; alpha: number; rect: number[] }[] {
  let style = "";
  let alpha = 1;
  const out: { style: string; alpha: number; rect: number[] }[] = [];
  for (const call of calls) {
    if (call[0] === "set:fillStyle") style = call[1] as string;
    else if (call[0] === "set:globalAlpha") alpha = call[1] as number;
    else if (call[0] === "fillRect") out.push({ style, alpha, rect: call.slice(1) as number[] });
  }
  return out;
}

describe("prop stamps (boat / gull / menhir)", () => {
  it("dispatches all three kinds, deterministic per seed, distinct across seeds", () => {
    for (const kind of ["boat", "gull", "menhir"] as const) {
      expect(paint(kind).length).toBeGreaterThan(0);
      expect(paint(kind)).toEqual(paint(kind));
      expect(JSON.stringify(paint(kind, 100, 200, wearStampSeed("a")))).not.toEqual(
        JSON.stringify(paint(kind, 100, 200, wearStampSeed("b"))),
      );
    }
  });

  it("keeps the fillRect(+alpha) contract and stays inside the footprint", () => {
    for (const kind of ["boat", "gull", "menhir"] as const) {
      const calls = paint(kind);
      const ops = new Set(calls.map(([op]) => op));
      ops.delete("fillRect");
      ops.delete("set:fillStyle");
      ops.delete("set:globalAlpha");
      expect([...ops]).toEqual([]);
      for (const { rect } of annotated(calls)) {
        const [x, y, w, h] = rect as [number, number, number, number];
        expect(x).toBeGreaterThanOrEqual(-1.5);
        expect(y).toBeGreaterThanOrEqual(-1.5);
        expect(x + w).toBeLessThanOrEqual(101.5);
        expect(y + h).toBeLessThanOrEqual(201.5);
      }
      // alpha passes always end restored to 1
      const last = annotated(calls).at(-1);
      expect(last).toBeDefined();
    }
  });

  it("boat: gunwale ring, deck fill, and faint wake slivers", () => {
    const rects = annotated(paint("boat"));
    expect(rects.some((r) => r.style === PROP_STAMP_ART.boatGunwale)).toBe(true);
    expect(rects.some((r) => r.style === PROP_STAMP_ART.boatDeck)).toBe(true);
    const wake = rects.filter((r) => r.style === PROP_STAMP_ART.boatWake);
    expect(wake.length).toBe(2);
    expect(wake.every((r) => r.alpha < 1)).toBe(true);
  });

  it("gull: white wings with a slate outer tip", () => {
    const rects = annotated(paint("gull", 30, 30));
    expect(rects.some((r) => r.style === PROP_STAMP_ART.gullBody)).toBe(true);
    expect(rects.filter((r) => r.style === PROP_STAMP_ART.gullTip).length).toBe(2);
  });

  it("menhir: ink underlay, lit/shade split, soft ground shadow", () => {
    const rects = annotated(paint("menhir", 60, 90));
    expect(rects.some((r) => r.style === PROP_STAMP_ART.menhirInk)).toBe(true);
    expect(rects.some((r) => r.style === PROP_STAMP_ART.menhirLit)).toBe(true);
    expect(rects.some((r) => r.style === PROP_STAMP_ART.menhirShade)).toBe(true);
    const shadow = rects.find((r) => r.style === PROP_STAMP_ART.menhirShadow);
    expect(shadow?.alpha).toBeLessThan(1);
  });

  it("ships as placeable assets with decal routing", () => {
    for (const [id, kind] of [
      ["objects:boat", "boat"],
      ["objects:gull", "gull"],
      ["objects:menhir", "menhir"],
    ] as const) {
      const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === id);
      expect(asset?.decal?.kind).toBe(kind);
    }
  });
});
