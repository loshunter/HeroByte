// groundDecal wear stamps (taxonomy catalog rank 8): the deterministic
// fillRect painter, its SVG shim, and the decal asset contract. The painter's
// narrow context subset (fillStyle / globalAlpha / fillRect ONLY) is load-
// bearing — it is what lets one implementation drive the live Konva shape,
// the export shim and this recording context — so it is pinned here.

import { describe, expect, it } from "vitest";
import { createRecordingContext, type RecordedCall } from "./recordingContext";
import {
  paintWearStamp,
  wearStampSeed,
  WEAR_STAMP_ART,
  type WearDecalSpec,
  type WearStampContext2D,
} from "../wearStampDetail";
import { wearStampSvgMarkup } from "../wearStampSvg";
import { getMapStudioTileAsset, MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTiles";

const KINDS: WearDecalSpec[] = [{ kind: "ring" }, { kind: "scorch" }, { kind: "stain" }];

function paint(spec: WearDecalSpec, seed: number, w = 150, h = 150, tint?: string): RecordedCall[] {
  const { context, calls } = createRecordingContext();
  paintWearStamp(context as unknown as WearStampContext2D, w, h, seed, spec, tint);
  return calls;
}

const fillRects = (calls: RecordedCall[]): [number, number, number, number][] =>
  calls
    .filter(([op]) => op === "fillRect")
    .map(([, x, y, w, h]) => [x, y, w, h] as [number, number, number, number]);

const fills = (calls: RecordedCall[]): string[] =>
  calls.filter(([op]) => op === "set:fillStyle").map(([, v]) => v as string);

describe("paintWearStamp (the deterministic painter)", () => {
  it("is deterministic per seed and varies across seeds", () => {
    for (const spec of KINDS) {
      expect(paint(spec, 77)).toEqual(paint(spec, 77));
      expect(JSON.stringify(paint(spec, 77))).not.toBe(JSON.stringify(paint(spec, 78)));
    }
  });

  it("emits ONLY fillStyle / globalAlpha / fillRect (the shared-context contract)", () => {
    for (const spec of KINDS) {
      const ops = new Set(paint(spec, 5).map(([op]) => op));
      for (const op of ops) {
        expect(["fillRect", "set:fillStyle", "set:globalAlpha"]).toContain(op);
      }
    }
  });

  it("keeps every rect inside the stamp footprint at several seeds and sizes", () => {
    for (const spec of KINDS) {
      for (const [seed, w, h] of [
        [1, 150, 150],
        [999, 100, 100],
        [wearStampSeed("el-abc"), 240, 160],
      ] as const) {
        for (const [x, y, rw, rh] of fillRects(paint(spec, seed, w, h))) {
          expect(x, spec.kind).toBeGreaterThanOrEqual(0);
          expect(y, spec.kind).toBeGreaterThanOrEqual(0);
          expect(x + rw, spec.kind).toBeLessThanOrEqual(w);
          expect(y + rh, spec.kind).toBeLessThanOrEqual(h);
          expect(rw, spec.kind).toBeGreaterThan(0);
          expect(rh, spec.kind).toBeGreaterThan(0);
        }
      }
    }
  });

  it("always restores globalAlpha to 1 (the next painter inherits the context)", () => {
    for (const spec of KINDS) {
      const alphas = paint(spec, 12)
        .filter(([op]) => op === "set:globalAlpha")
        .map(([, v]) => v as number);
      expect(alphas.length).toBeGreaterThan(0);
      expect(alphas[alphas.length - 1]).toBe(1);
    }
  });

  it("ring: scuff dabs ride the circumference and splatter breaks it", () => {
    const calls = paint({ kind: "ring" }, 41);
    const used = fills(calls);
    for (const tan of WEAR_STAMP_ART.ringScuff) expect(used).toContain(tan);
    expect(used).toContain(WEAR_STAMP_ART.ringSplatter);
    // Most opaque dab centres sit in a ring band around the centre, not in a
    // filled disc: the mean radius of all rect centres lands near R (0.36m).
    const m = 150;
    const radii = fillRects(calls).map(([x, y, w, h]) =>
      Math.hypot(x + w / 2 - m / 2, y + h / 2 - m / 2),
    );
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    expect(mean).toBeGreaterThan(m * 0.22);
    expect(mean).toBeLessThan(m * 0.48);
  });

  it("scorch: char core, streak spokes past the rim, earth lumps, cool wash", () => {
    const calls = paint({ kind: "scorch" }, 42);
    const used = fills(calls);
    for (const c of [
      WEAR_STAMP_ART.scorchCore,
      WEAR_STAMP_ART.scorchMid,
      WEAR_STAMP_ART.scorchStreak,
      WEAR_STAMP_ART.scorchEarth,
      WEAR_STAMP_ART.scorchCool,
    ]) {
      expect(used).toContain(c);
    }
    // Streak chains reach beyond the core radius (0.3m) — the spokes.
    const m = 150;
    let beyond = 0;
    let inStreak = false;
    for (const call of calls) {
      if (call[0] === "set:fillStyle") inStreak = call[1] === WEAR_STAMP_ART.scorchStreak;
      if (call[0] === "fillRect" && inStreak) {
        const [, x, y, w, h] = call as [string, number, number, number, number];
        if (Math.hypot(x + w / 2 - m / 2, y + h / 2 - m / 2) > m * 0.32) beyond += 1;
      }
    }
    expect(beyond).toBeGreaterThan(10);
    // The cool wash is translucent.
    const alphas = calls.filter(([op]) => op === "set:globalAlpha").map(([, v]) => v as number);
    expect(alphas).toContain(0.16);
  });

  it("stain: prop-declared colour, tint override, translucent blobs", () => {
    const declared = fills(paint({ kind: "stain", color: "#ad315d" }, 9));
    expect(declared).toContain("#ad315d");
    const tinted = fills(paint({ kind: "stain", color: "#ad315d" }, 9, 150, 150, "#3a3f45"));
    expect(tinted).toContain("#3a3f45");
    expect(tinted).not.toContain("#ad315d");
    const fallback = fills(paint({ kind: "stain" }, 9));
    expect(fallback).toContain(WEAR_STAMP_ART.stainFallback);
    const alphas = paint({ kind: "stain", color: "#ad315d" }, 9)
      .filter(([op]) => op === "set:globalAlpha")
      .map(([, v]) => v as number);
    expect(Math.min(...alphas)).toBeLessThan(1);
  });

  it("wearStampSeed hashes element ids deterministically and distinctly", () => {
    expect(wearStampSeed("element-1")).toBe(wearStampSeed("element-1"));
    expect(wearStampSeed("element-1")).not.toBe(wearStampSeed("element-2"));
    expect(Number.isInteger(wearStampSeed("x"))).toBe(true);
  });
});

describe("wearStampSvgMarkup (the export shim)", () => {
  it("emits one <rect> per painter fillRect, byte-deterministically", () => {
    for (const spec of KINDS) {
      const markup = wearStampSvgMarkup(spec, 150, 150, 33);
      expect(markup).toBe(wearStampSvgMarkup(spec, 150, 150, 33));
      const rectCount = markup.split("<rect ").length - 1;
      expect(rectCount).toBe(fillRects(paint(spec, 33)).length);
      // Nothing but rects — the painter contract holds through the shim.
      expect(markup.replace(/<rect [^>]*\/>/g, "")).toBe("");
    }
  });

  it("carries translucency as fill-opacity and honours the stain tint", () => {
    const markup = wearStampSvgMarkup({ kind: "stain", color: "#ad315d" }, 100, 100, 5, "#3a3f45");
    expect(markup).toContain('fill="#3a3f45"');
    expect(markup).not.toContain("#ad315d");
    expect(markup).toContain('fill-opacity="0.3"');
  });
});

describe("decal asset contract (starterTiles data)", () => {
  const decalAssets = MAP_STUDIO_TILE_ASSETS.filter((a) => a.id.startsWith("decal:"));

  it("ships the wear kit: ring, scorch and three stains", () => {
    expect(decalAssets.map((a) => a.decal?.kind).sort()).toEqual([
      "ring",
      "scorch",
      "stain",
      "stain",
      "stain",
    ]);
  });

  it("every decal asset routes to the painter and places on the objects layer", () => {
    for (const asset of decalAssets) {
      expect(asset.category, asset.id).toBe("decals");
      expect(asset.layerKind, asset.id).toBe("objects");
      expect(asset.decal, asset.id).toBeDefined();
      expect(getMapStudioTileAsset(asset.id).id, asset.id).toBe(asset.id); // not the fallback
      if (asset.decal!.kind === "stain") {
        expect(asset.decal!.color, asset.id).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("the objects split kept the original props (crate, table, glowing lamp)", () => {
    expect(getMapStudioTileAsset("objects:crate").name).toBe("Crate");
    expect(getMapStudioTileAsset("objects:table").columns).toBe(2);
    expect(getMapStudioTileAsset("objects:lamp").emissive).toBeDefined();
  });
});
