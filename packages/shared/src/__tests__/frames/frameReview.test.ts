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
  pinFrameSeeds,
  presetFrame,
  relativeLuminance,
  resolveFrameParams,
  sanitizeTokenFrame,
  withFrameWeight,
  type TokenFrame,
} from "../../index.js";
import { motifCount, MAX_MOTIFS } from "../../frames/engine/generators/common.js";
import { FRAME_GENERATORS } from "../../frames/engine/generators/index.js";
import { createSeededRng } from "../../rng.js";

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

  it("is accepted at its largest: six full bands, its stones pinned for a carry, under the cap", () => {
    const full = (index: number) => ({
      generator: "masonry",
      palette: "metal.blackened",
      weight: 0.0566,
      depth: 0.333,
      params: {
        bond: "rubble",
        stoneLength: 1.234,
        gap: 0.123,
        inset: 0.123,
        irregularity: 0.123,
        chamfer: 0.123,
        crackDensity: 0.123,
      },
      bevel: { profile: "chamfer", width: 0.33 },
      glow: { color: "#abcdef", strength: 0.33 },
      ...(index % 2 ? { seed: -2147483648 } : {}),
    });
    const worst = {
      preset: "metal.blackened",
      shape: "circle",
      growth: "mid",
      accent: "#123456",
      bands: [0, 1, 2, 3, 4, 5].map(full),
    };
    const accepted = sanitizeTokenFrame(worst);
    if ("error" in accepted) throw new Error(accepted.error);
    const pinned = pinFrameSeeds(accepted.frame, "token-with-a-long-id");
    expect(JSON.stringify(pinned).length).toBeLessThanOrEqual(2304);
    // carried to a file or a re-placed NPC, it survives the files' door intact
    expect(coerceTokenFrame(JSON.parse(JSON.stringify(pinned)))).toEqual(pinned);
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
    const welded = presetFrame("metal.welded")!;
    const over = {
      ...welded,
      bands: welded.bands.map((band, index) => ({
        ...band,
        weight: [0.0511, 0.2381, 0.0511][index]!,
      })),
    };
    const stored = sanitizeTokenFrame(over);
    if ("error" in stored) throw new Error(stored.error);
    expect(frameWeight(stored.frame)).toBeCloseTo(0.3403, 4); // inside the tolerance, over the cap
    expect(coerceTokenFrame(JSON.parse(JSON.stringify(stored.frame)))).toEqual(stored.frame);
  });
});

describe("a file's frame", () => {
  it("scales an out-of-range total into the limits, a thin band held at the floor, never dropped", () => {
    const frame = coerceTokenFrame({ bands: [band({ weight: 0.0001 }), band({ weight: 0.5 })] })!;
    expect(frame).toBeDefined();
    expect(frame.bands[0]!.weight).toBe(0.005);
    expect(frameWeight(frame)).toBeCloseTo(0.34, 6);
    const many = coerceTokenFrame({
      bands: [...Array(5)].map(() => band({ weight: 0.001 })).concat([band({ weight: 10 })]),
    })!;
    expect(many).toBeDefined();
    expect(frameWeight(many)).toBeCloseTo(0.34, 6);
    expect(coerceTokenFrame({ bands: [band({ weight: 1e308 })] })).toBeDefined();
    // a band the scaling itself would thin past the floor is held at it
    const scaled = coerceTokenFrame({ bands: [band({ weight: 0.006 }), band({ weight: 1 })] })!;
    expect(scaled.bands[0]!.weight).toBe(0.005);
    expect(frameWeight(scaled)).toBeCloseTo(0.34, 6);
  });

  it("never throws on built-in names and thickens a band too thin to draw", () => {
    const frame = coerceTokenFrame({
      bands: [band({ generator: "constructor", palette: "__proto__" }), band({ weight: 1e-9 })],
    })!;
    expect(frame.bands[0]).toMatchObject({ generator: "plain", palette: "stone.grey" });
    expect(frame.bands[1]!.weight).toBeGreaterThanOrEqual(0.005);
  });
});

describe("the engine's own limits", () => {
  it("keeps a crafted frame of hair-thin rivetted plates inside the whole-frame budget", () => {
    const thin = (depth: number) => ({
      generator: "plate",
      palette: "metal.iron",
      weight: 0.005,
      depth,
      params: { plateLength: 1, rivetRows: 3, rivetSize: 0.3, irregularity: 1 },
    });
    const crafted = {
      growth: "out" as const,
      bands: [thin(0), thin(1), thin(0), thin(1), thin(0), { ...thin(1), weight: 0.015 }],
    };
    expect(sanitizeTokenFrame(crafted)).toHaveProperty("frame");
    const { paints } = framePaints({
      frame: crafted,
      size: "gargantuan",
      accent: "#000000",
      seed: 1,
      tier: 512,
    });
    expect(paints.length).toBeLessThan(40_000);
  });

  it("shares one motif budget across the frame's bands", () => {
    const thinStone = {
      generator: "masonry",
      palette: "stone.grey",
      weight: 0.005,
      depth: 0.6,
      params: { stoneLength: 0.6 },
    };
    const frame = {
      bands: [...Array(5)].map(() => thinStone).concat([{ ...thinStone, weight: 0.015 }]),
    };
    expect(sanitizeTokenFrame(frame)).toHaveProperty("frame");
    const { paints } = framePaints({
      frame,
      size: "gargantuan",
      accent: "#000000",
      seed: 1,
      tier: 512,
    });
    // a stone is an outline, four bevels and a top: six paints, so 768 stones at most
    expect(paints.length).toBeLessThan(768 * 6 + 2000);
  });

  it("lays rubble in its own course, not over the next one", () => {
    const facets = FRAME_GENERATORS.masonry!({
      length: 20,
      courses: 2,
      courseScale: () => 1,
      params: resolveFrameParams("masonry", { bond: "rubble", irregularity: 1, gap: 0 }),
      rng: createSeededRng(9),
      maxMotifs: 256,
      bandPx: 200,
    });
    // every stone outline stays inside the half of the band its centre is in
    for (const facet of facets.filter((candidate) => candidate.role === "outline")) {
      const vs = facet.points.filter((_, index) => index % 2 === 1);
      const centre = vs.reduce((sum, v) => sum + v, 0) / vs.length;
      const [low, high] = centre < 0.5 ? [0, 0.5] : [0.5, 1];
      for (const v of vs) {
        expect(v).toBeGreaterThanOrEqual(low - 1e-9);
        expect(v).toBeLessThanOrEqual(high + 1e-9);
      }
    }
  });

  it("puts no underlay under a single band, so its own edges keep their smoothing", () => {
    const one = framePaints({
      frame: presetFrame("plain.ring")!,
      accent: "#4f7cc4",
      seed: 1,
      tier: 256,
    });
    const two = framePaints({
      frame: presetFrame("metal.welded")!,
      accent: "#4f7cc4",
      seed: 1,
      tier: 256,
    });
    // The underlay strip starts at angle 0 (on +x); warped bands start at the top.
    const annuli = (paints: { points: number[] }[]) =>
      paints.filter(
        (paint) => paint.points.length > 700 && paint.points[1] === 0 && paint.points[0]! > 0,
      ).length;
    expect(annuli(one.paints)).toBe(0);
    expect(annuli(two.paints)).toBe(2); // one strip under each of welded's two joints
  });

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
        expect(pixels[((tier - 1) * tier + at) * 4 + 3]).toBe(0); // bottom edge
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
