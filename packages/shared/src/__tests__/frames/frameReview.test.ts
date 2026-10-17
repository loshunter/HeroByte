// The frame engine's review round 1: each test pins a defect the reviewers
// found (a band thin enough to stall every client's bake, catalog lookups that
// trusted prototype keys, rubble cut off at the bitmap edge, seams between
// bands, slivers at the weight cap, stone bevels lit from the wrong side, a
// cache key blind to knobs, glow "your colour" following a picked frame colour).

import { describe, expect, it } from "vitest";
import {
  bakeFrame,
  coerceTokenFrame,
  courseCount,
  FRAME_PRESETS,
  FRAME_WEIGHTS,
  frameBakeKey,
  frameGlowsPersonal,
  framePaints,
  frameSeed,
  frameWeight,
  layoutFrame,
  presetFrame,
  relativeLuminance,
  resolveFrameParams,
  sanitizeTokenFrame,
  withFrameWeight,
  type TokenFrame,
} from "../../index.js";
import { motifCount, MAX_MOTIFS } from "../../frames/engine/generators/common.js";

const band = (extra: Record<string, unknown> = {}) => ({
  generator: "plain",
  palette: "stone.grey",
  weight: 0.1,
  depth: 0.6,
  ...extra,
});
const refusal = (raw: unknown) => {
  const result = sanitizeTokenFrame(raw);
  return "error" in result ? result.error : null;
};
const bake = (frame: TokenFrame, tier = 128, seed = 1, accent = "#4f7cc4", personal?: string) =>
  bakeFrame({ frame, accent, personal, seed, tier });

describe("a frame the wire must refuse", () => {
  it("has a band thinner than 0.005 (thousands of stones in every client's bake)", () => {
    const thin = { bands: [band({ generator: "masonry", weight: 5e-4 }), band()] };
    expect(refusal(thin)).toBe("frame band weight must be at least 0.005");
    expect(refusal({ bands: [band({ weight: 0.005 }), band()] })).toBeNull();
  });

  it("names a built-in object property as its generator or palette", () => {
    for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      expect(refusal({ bands: [band({ palette: id })] })).toBe("frame band palette is unknown");
      expect(refusal({ bands: [band({ generator: id })] })).toBe("frame band generator is unknown");
    }
    expect(resolveFrameParams("constructor", {})).toEqual({});
    expect(resolveFrameParams("plain", JSON.parse('{"__proto__": {"grain": 1}}'))).toEqual({
      grain: 0,
    });
  });

  it("carries more than 1.5 KB of JSON", () => {
    const huge = {
      bands: [band({ params: { grain: 0.5 } })],
      preset: undefined,
      accent: "personal",
    };
    expect(refusal(huge)).toBeNull();
    expect(JSON.stringify(sanitizeTokenFrame(huge)).length).toBeLessThan(1536);
  });
});

describe("numbers the wire keeps", () => {
  it("are rounded, so a frame costs about a hundred bytes a band, not 400", () => {
    const result = sanitizeTokenFrame({
      bands: [
        band({
          weight: 0.0333333333333,
          depth: 0.6666666666,
          glow: { color: "personal", strength: 0.3333333 },
        }),
        band({ weight: 0.0666666666667, bevel: { profile: "round", width: 0.123456789 } }),
      ],
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.frame.bands[0]).toMatchObject({
      weight: 0.0333,
      depth: 0.667,
      glow: { strength: 0.33 },
    });
    expect(result.frame.bands[1]!.bevel!.width).toBe(0.12);
  });

  it("accept every shipped preset at every weight the slider reaches, the floor included", () => {
    for (const preset of FRAME_PRESETS) {
      for (const weight of [0.04, ...Object.values(FRAME_WEIGHTS), 0.27, 0.34]) {
        expect(refusal(presetFrame(preset.id, weight)), `${preset.id} at ${weight}`).toBeNull();
      }
    }
  });

  it("come back from a file exactly, a total a hair over the cap included", () => {
    const stored = sanitizeTokenFrame(withFrameWeight(presetFrame("metal.welded")!, 0.34));
    if ("error" in stored) throw new Error(stored.error);
    expect(frameWeight(stored.frame)).toBeCloseTo(0.34, 3);
    expect(coerceTokenFrame(JSON.parse(JSON.stringify(stored.frame)))).toEqual(stored.frame);
  });
});

describe("a file's frame", () => {
  it("never throws on built-in names and thickens a band too thin to draw", () => {
    const frame = coerceTokenFrame({
      bands: [band({ generator: "constructor", palette: "__proto__" }), band({ weight: 1e-9 })],
    })!;
    expect(frame.bands[0]).toMatchObject({ generator: "plain", palette: "stone.grey" });
    expect(frame.bands[1]!.weight).toBeGreaterThanOrEqual(0.005);
  });
});

describe("the engine's own limits", () => {
  it("caps the motifs a course may hold", () => {
    expect(motifCount(1e9, 1)).toBe(MAX_MOTIFS);
    expect(motifCount(1, 5)).toBe(3);
  });

  it("keeps rubble inside the bitmap at the heaviest weight, whatever the seed", () => {
    const cave = presetFrame("stone.cave", 0.34)!;
    cave.bands[0]!.params = { ...cave.bands[0]!.params, irregularity: 1, gap: 0 };
    for (let seed = 0; seed < 20; seed += 1) {
      const { pixels, tier } = bake(cave, 128, seed);
      for (let at = 0; at < tier; at += 1) {
        expect(pixels[(at * tier + 0) * 4 + 3]).toBe(0); // left edge
        expect(pixels[(0 * tier + at) * 4 + 3]).toBe(0); // top edge
        expect(pixels[(at * tier + tier - 1) * 4 + 3]).toBe(0); // right edge
      }
    }
  });

  it("lays the band in three courses at the weight cap, so no course comes to a point", () => {
    const layout = layoutFrame(presetFrame("stone.castle", 0.34)!);
    expect(courseCount(layout.rings[0]!)).toBe(3);
    expect(courseCount(layoutFrame(presetFrame("stone.castle", 0.24)!).rings[0]!)).toBe(2);
  });

  it("leaves no see-through seam where two bands meet", () => {
    const twoPlain: TokenFrame = {
      bands: [
        band({ bevel: { profile: "flat", width: 0 } }),
        band({ bevel: { profile: "flat", width: 0 } }),
      ],
    };
    for (const frame of [
      twoPlain,
      presetFrame("metal.welded")!,
      presetFrame("metal.welded", 0.24)!,
    ]) {
      const { pixels, tier, layout } = bake(frame, 256);
      const scale = tier / (2 * layout.extent);
      for (let degree = 0; degree < 360; degree += 7) {
        for (let r = layout.window + 3 / scale; r < layout.outer - 3 / scale; r += 1 / scale) {
          const a = (degree * Math.PI) / 180;
          const x = Math.floor(tier / 2 + Math.cos(a) * r * scale);
          const y = Math.floor(tier / 2 + Math.sin(a) * r * scale);
          expect(pixels[(y * tier + x) * 4 + 3]).toBe(255);
        }
      }
    }
  });

  it("lights a stone's bevel facing the light brighter than its twin facing away", () => {
    const { paints } = framePaints({
      frame: presetFrame("stone.castle")!,
      accent: "#000000",
      seed: 3,
      tier: 256,
    });
    const tones = paints.map((paint) => relativeLuminance(paint.color));
    const brightest = Math.max(...tones);
    const top = presetFrame("stone.castle")!; // grey stone top #9b978f
    expect(brightest).toBeGreaterThan(
      relativeLuminance({ r: 0x9b / 255, g: 0x97 / 255, b: 0x8f / 255 }),
    );
    // facets up-left of the centre (facing the light) out-shine those down-right
    const side = (sign: number) =>
      paints
        .filter((paint) => paint.points.length >= 8)
        .filter((paint) => {
          const [x, y] = [paint.points[0]!, paint.points[1]!];
          return sign * (x + y) > 0.25;
        })
        .map((paint) => relativeLuminance(paint.color));
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(top.bands).toHaveLength(1);
    expect(mean(side(-1))).toBeGreaterThan(mean(side(1)));
  });
});

describe("the bake key", () => {
  const castle = presetFrame("stone.castle")!;
  const key = (frame: TokenFrame, personal?: string) =>
    frameBakeKey({ frame, accent: "#4f7cc4", personal, seed: frameSeed("a"), tier: 256 });

  it("changes with weight, palette, generator, bevel, glow and shape", () => {
    const one = (change: Partial<TokenFrame["bands"][number]>) => ({
      ...castle,
      bands: [{ ...castle.bands[0]!, ...change }],
    });
    const changed = [
      withFrameWeight(castle, 0.24),
      one({ palette: "stone.sand" }),
      one({ generator: "plate" }),
      one({ bevel: { profile: "step", width: 0.2 } }),
      one({ glow: { color: "#ff8800", strength: 0.5 } }),
      { ...castle, shape: "hexagon" as const },
    ];
    for (const frame of changed) expect(key(frame)).not.toBe(key(castle));
  });

  it("follows the character's colour for a glow, not a colour picked for the frame", () => {
    const cracked = { ...presetFrame("stone.cracked")!, accent: "#00ff00" };
    expect(frameGlowsPersonal(cracked)).toBe(true);
    expect(key(cracked, "#ff0000")).not.toBe(key(cracked, "#0000ff"));
    const red = bake(cracked, 128, 2, "#00ff00", "#ff0000").pixels;
    const blue = bake(cracked, 128, 2, "#00ff00", "#0000ff").pixels;
    expect(red).not.toEqual(blue);
  });
});
