// Floor decals & inlays (taxonomy catalog rank 7): the tessera medallion and
// translucent tracery painters, their dispatch through the wear-stamp kind
// union, and the "inlays" asset category contract. The painter-subset rule
// (fillStyle / globalAlpha / fillRect only, alpha restored, rects in-bounds)
// is re-pinned per kind — it is what keeps one implementation valid for the
// live Konva shape, the SVG export shim, and this recording context.

import { describe, expect, it } from "vitest";
import { createRecordingContext, type RecordedCall } from "./recordingContext";
import { FLOOR_DECAL_ART, paintFloorDecal, shadeHex } from "../floorDecalDetail";
import { paintWearStamp, type WearDecalSpec, type WearStampContext2D } from "../wearStampDetail";
import { wearStampSvgMarkup } from "../wearStampSvg";
import {
  getMapStudioTileAsset,
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
} from "../../map-studio/starterTiles";

const KINDS: WearDecalSpec[] = [
  { kind: "medallion" },
  { kind: "tracery" },
  { kind: "rug", color: "#b25665" },
  { kind: "ceremony", color: "#6e2318" },
];

function paint(spec: WearDecalSpec, seed: number, w = 300, h = 300, tint?: string): RecordedCall[] {
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

describe("floor-decal painters (shared contract)", () => {
  it("is deterministic per seed, varies across seeds, and dispatches via paintWearStamp", () => {
    for (const spec of KINDS) {
      expect(paint(spec, 7)).toEqual(paint(spec, 7));
      expect(JSON.stringify(paint(spec, 7))).not.toBe(JSON.stringify(paint(spec, 8)));
      // The wear dispatch and a direct paintFloorDecal call are one stream.
      const { context, calls } = createRecordingContext();
      paintFloorDecal(context as unknown as WearStampContext2D, 300, 300, 7, spec);
      expect(paint(spec, 7)).toEqual(calls);
    }
  });

  it("emits ONLY fillStyle / globalAlpha / fillRect, restores alpha, stays in bounds", () => {
    for (const spec of KINDS) {
      for (const [w, h] of [
        [300, 300],
        [150, 200],
      ] as const) {
        const calls = paint(spec, 42, w, h);
        for (const [op] of calls) {
          expect(["fillRect", "set:fillStyle", "set:globalAlpha"]).toContain(op);
        }
        const alphas = calls.filter(([op]) => op === "set:globalAlpha").map(([, v]) => v as number);
        if (alphas.length > 0) expect(alphas[alphas.length - 1]).toBe(1);
        for (const [x, y, rw, rh] of fillRects(calls)) {
          expect(x, spec.kind).toBeGreaterThanOrEqual(0);
          expect(y, spec.kind).toBeGreaterThanOrEqual(0);
          expect(x + rw, spec.kind).toBeLessThanOrEqual(w);
          expect(y + rh, spec.kind).toBeLessThanOrEqual(h);
        }
      }
    }
  });
});

describe("tessera sun medallion", () => {
  const calls = paint({ kind: "medallion" }, 11);

  it("lays all three golds over grout, value-jittered per tessera", () => {
    const used = fills(calls);
    expect(used).toContain(FLOOR_DECAL_ART.medallionGrout);
    // Faces are value-jittered off the base golds, so assert per-tessera
    // derivation: every non-grout fill sits within jitter+bevel range of one
    // of the three golds on every channel.
    const parse = (hex: string): number[] => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const golds = FLOOR_DECAL_ART.medallionGolds.map(parse);
    const nonGrout = used.filter((f) => f !== FLOOR_DECAL_ART.medallionGrout);
    expect(nonGrout.length).toBeGreaterThan(50);
    for (const fill of nonGrout) {
      const c = parse(fill);
      const nearGold = golds.some((g) => g.every((v, i) => Math.abs(v - c[i]!) <= 34));
      expect(nearGold, fill).toBe(true);
    }
    // The jitter actually varies faces (not one flat gold).
    expect(new Set(nonGrout).size).toBeGreaterThan(10);
  });

  it("keeps the mosaic inside the emblem disc and leaves wear gaps", () => {
    const rects = fillRects(calls);
    // Grout rects mark tessera cells; all sit within the disc radius.
    const R = 300 * 0.48;
    for (const [x, y, w2, h2] of rects) {
      const d = Math.hypot(x + w2 / 2 - 150, y + h2 / 2 - 150);
      expect(d).toBeLessThan(R + 14); // pitch slack for jitter
    }
    // Dropout: fewer tesserae than a full-disc lattice would produce.
    const grout = calls.filter(
      (c) => c[0] === "set:fillStyle" && c[1] === FLOOR_DECAL_ART.medallionGrout,
    );
    expect(grout.length).toBeGreaterThan(80); // a real mosaic…
    expect(grout.length).toBeLessThan(320); // …but not a gapless disc fill
  });
});

describe("tracery panel", () => {
  const calls = paint({ kind: "tracery" }, 23);

  it("draws the whole panel as one pale tone at 30% opacity, then restores", () => {
    expect(new Set(fills(calls))).toEqual(new Set([FLOOR_DECAL_ART.tracery]));
    const alphas = calls.filter(([op]) => op === "set:globalAlpha").map(([, v]) => v as number);
    expect(alphas[0]).toBe(0.3);
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it("covers the panel as an oversized lattice (not one corner motif)", () => {
    const rects = fillRects(calls);
    const xs = rects.map(([x]) => x);
    const ys = rects.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300 * 0.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(300 * 0.6);
  });
});

describe("tone-on-tone rug", () => {
  const parse = (hex: string): number[] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const luma = (hex: string): number => {
    const [r, g, b] = parse(hex);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };

  it("derives EVERY shade from the one declared hue (tint recolours coherently)", () => {
    for (const hue of ["#b25665", "#5b919d"]) {
      const used = fills(paint({ kind: "rug", color: "#b25665" }, 3, 100, 150, hue));
      expect(used.length).toBeGreaterThan(10);
      const base = parse(hue);
      for (const fill of used) {
        const c = parse(fill);
        // Value shifts only: each channel within the ±30 border/light range.
        expect(
          base.every((v, i) => Math.abs(v! - c[i]!) <= 31),
          `${fill} vs ${hue}`,
        ).toBe(true);
      }
      // Tone-on-tone still has real structure: border darker, sigil lighter.
      const lumas = used.map(luma);
      expect(Math.min(...lumas)).toBeLessThan(luma(hue) - 12);
      expect(Math.max(...lumas)).toBeGreaterThan(luma(hue) + 12);
    }
  });

  it("weaves ragged ends: fringe rects overhang the field rows on both short ends", () => {
    const rects = fillRects(paint({ kind: "rug", color: "#b25665" }, 9, 100, 200));
    const h = 200;
    expect(rects.some(([, y]) => y < h * 0.035)).toBe(true); // top fringe
    expect(rects.some(([, y, , rh]) => y + rh > h - h * 0.035 + 0.5)).toBe(true); // bottom fringe
  });
});

describe("ceremonial stain", () => {
  it("fades radially through translucent rings in the declared hue, then restores", () => {
    const calls = paint({ kind: "ceremony", color: "#6e2318" }, 13);
    expect(new Set(fills(calls))).toEqual(new Set(["#6e2318"]));
    const alphas = calls.filter(([op]) => op === "set:globalAlpha").map(([, v]) => v as number);
    const ramp = alphas.slice(0, -1);
    expect(new Set(ramp).size).toBeGreaterThan(4); // a real gradient, not one wash
    for (const a of ramp) expect(a).toBeLessThan(0.3);
    for (let i = 1; i < ramp.length; i += 1) expect(ramp[i]!).toBeLessThan(ramp[i - 1]!);
    expect(alphas[alphas.length - 1]).toBe(1);
    // Tint overrides the declared hue.
    const tinted = fills(paint({ kind: "ceremony", color: "#6e2318" }, 13, 300, 300, "#2e2354"));
    expect(new Set(tinted)).toEqual(new Set(["#2e2354"]));
  });
});

describe("inlay assets + category contract", () => {
  const inlays = MAP_STUDIO_TILE_ASSETS.filter((a) => a.id.startsWith("inlay:"));

  it("ships the full inlay kit as oversized 'inlays' set-pieces", () => {
    expect(inlays.map((a) => a.decal?.kind).sort()).toEqual([
      "ceremony",
      "medallion",
      "rug",
      "rug",
      "tracery",
    ]);
    for (const asset of inlays) {
      expect(asset.category, asset.id).toBe("inlays");
      expect(asset.layerKind, asset.id).toBe("objects");
      expect(getMapStudioTileAsset(asset.id).id, asset.id).toBe(asset.id);
      // Hue-carrying kinds declare their colour; fixed-art kinds don't.
      if (asset.decal!.kind === "rug" || asset.decal!.kind === "ceremony") {
        expect(asset.decal!.color, asset.id).toMatch(/^#[0-9a-f]{6}$/);
      } else {
        expect(asset.decal!.color, asset.id).toBeUndefined();
      }
    }
    expect(mapStudioTileCategoryLabel("inlays")).toBe("Inlays");
  });

  it("the SVG shim renders inlay kinds as pure rect art", () => {
    const markup = wearStampSvgMarkup({ kind: "medallion" }, 300, 300, 5);
    expect(markup.split("<rect ").length - 1).toBeGreaterThan(100);
    expect(markup.replace(/<rect [^>]*\/>/g, "")).toBe("");
  });
});

describe("shadeHex", () => {
  it("lightens, darkens, clamps, and always emits well-formed hex", () => {
    expect(shadeHex("#808080", 16)).toBe("#909090");
    expect(shadeHex("#808080", -16)).toBe("#707070");
    expect(shadeHex("#f8f8f8", 40)).toBe("#ffffff");
    expect(shadeHex("#050505", -40)).toBe("#000000");
    expect(shadeHex("#c1922e", 7)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
