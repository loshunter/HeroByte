import { describe, expect, it } from "vitest";
import {
  coerceTokenFrame,
  coerceTokenFrames,
  defaultTokenFrame,
  findFramePreset,
  frameHasGlow,
  frameWeight,
  presetFrame,
  sanitizeTokenFrame,
  withFrameWeight,
  type TokenFrame,
} from "../../index.js";

const accepted = (raw: unknown): TokenFrame => {
  const result = sanitizeTokenFrame(raw);
  if ("error" in result) throw new Error(result.error);
  return result.frame;
};
const refusal = (raw: unknown) => {
  const result = sanitizeTokenFrame(raw);
  return "error" in result ? result.error : null;
};
const welded = () => presetFrame("metal.welded")!;

describe("sanitizeTokenFrame (the wire)", () => {
  it("accepts every shipped preset at every named weight", () => {
    for (const weight of [0.05, 0.1, 0.16, 0.24]) {
      expect(refusal(presetFrame("stone.castle", weight))).toBeNull();
      expect(refusal(presetFrame("metal.welded", weight))).toBeNull();
    }
  });

  it("refuses a hexagon, a finish, seven bands, a 0.5 total and an unknown palette", () => {
    expect(refusal({ ...welded(), shape: "hexagon" })).toBe("frame shape must be circle");
    expect(refusal({ ...welded(), finish: "rainbow" })).toBe("frame finishes are not available");
    const band = { ...welded().bands[0]!, weight: 0.03 };
    expect(refusal({ bands: Array.from({ length: 7 }, () => band) })).toBe(
      "frame has more than 6 bands",
    );
    expect(refusal({ bands: [{ ...band, weight: 0.5 }] })).toBe("frame weight must be 0.04–0.34");
    expect(refusal({ bands: [{ ...band, weight: 0.01 }] })).toBe("frame weight must be 0.04–0.34");
    expect(refusal({ bands: [{ ...band, palette: "metal.mithril" }] })).toBe(
      "frame band palette is unknown",
    );
  });

  it("refuses unknown generators and presets, bad accents and growths, junk", () => {
    const band = { generator: "plain", palette: "personal", weight: 0.1, depth: 0.5 };
    expect(refusal({ bands: [{ ...band, generator: "foliage" }] })).toBe(
      "frame band generator is unknown",
    );
    expect(refusal({ preset: "nature.ivy", bands: [band] })).toBe("frame preset is unknown");
    expect(refusal({ accent: "red", bands: [band] })).toBe(
      'frame accent must be #rrggbb or "personal"',
    );
    expect(refusal({ growth: "up", bands: [band] })).toBe("frame growth must be in, out or mid");
    expect(refusal(null)).toBe("frame must be an object");
    expect(refusal({ bands: [] })).toBe("frame needs at least one band");
    expect(refusal({ bands: ["plain"] })).toBe("frame band must be an object");
    expect(refusal({ bands: [{ ...band, weight: -1 }] })).toBe(
      "frame band weight must be a positive number",
    );
  });

  it("clamps numbers inside a good frame and keeps only known fields", () => {
    const frame = accepted({
      shape: "circle",
      finish: "none",
      growth: "out",
      extra: "dropped",
      bands: [
        {
          generator: "masonry",
          palette: "stone.grey",
          weight: 0.1,
          depth: 7,
          params: { stoneLength: 99, mortar: 3 },
          bevel: { profile: "round", width: 4 },
          glow: { color: "#ff8800", strength: 9 },
          seed: 12.7,
          note: "dropped",
        },
      ],
    });
    expect(frame).not.toHaveProperty("extra");
    expect(frame).not.toHaveProperty("finish");
    expect(frame.shape).toBe("circle");
    expect(frame.accent).toBe("personal");
    const band = frame.bands[0]!;
    expect(band.depth).toBe(1);
    expect(band.params!.stoneLength).toBe(4);
    expect(band.params).not.toHaveProperty("mortar");
    expect(band.bevel).toEqual({ profile: "round", width: 0.5 });
    expect(band.glow).toEqual({ color: "#ff8800", strength: 1 });
    expect(band.seed).toBe(12);
    expect(band).not.toHaveProperty("note");
  });
});

describe("coerceTokenFrame (files)", () => {
  it("loads an unknown generator or palette as plain grey stone, never refusing", () => {
    const frame = coerceTokenFrame({
      preset: "nature.ivy",
      shape: "hexagon",
      finish: "rainbow",
      accent: "chartreuse",
      bands: [
        {
          generator: "foliage",
          palette: "leaf.green",
          weight: 0.05,
          depth: 0.8,
          params: { lean: 65 },
        },
        { generator: "masonry", palette: "brick.red", weight: 0.05, depth: 0.6 },
      ],
    })!;
    expect(frame).toBeDefined();
    expect(frame.bands[0]).toMatchObject({
      generator: "plain",
      palette: "stone.grey",
      weight: 0.05,
    });
    expect(frame.bands[0]!.params).toEqual({ grain: 0 });
    expect(frame.bands[1]).toMatchObject({ generator: "masonry", palette: "brick.red" });
    expect(frame).not.toHaveProperty("preset");
    expect(frame).not.toHaveProperty("shape");
    expect(frame).not.toHaveProperty("finish");
    expect(frame.accent).toBe("personal");
    expect(sanitizeTokenFrame(frame)).toHaveProperty("frame");
  });

  it("brings the band count and total weight into range", () => {
    const band = { generator: "plain", palette: "personal", weight: 0.2, depth: 0.5 };
    const frame = coerceTokenFrame({ bands: Array.from({ length: 8 }, () => band) })!;
    expect(frame.bands).toHaveLength(6);
    expect(frameWeight(frame)).toBeCloseTo(0.34);
    const thin = coerceTokenFrame({ bands: [{ ...band, weight: "thick" }, 5] })!;
    expect(frameWeight(thin)).toBeCloseTo(0.1);
  });

  it("is none for junk, and restores a stored frame exactly (backups are verbatim)", () => {
    expect(coerceTokenFrame("ring")).toBeUndefined();
    expect(coerceTokenFrame({ bands: [] })).toBeUndefined();
    expect(coerceTokenFrame({})).toBeUndefined();
    const stored = accepted({
      ...presetFrame("metal.rusted", 0.24),
      growth: "out",
      shape: "circle",
    });
    expect(coerceTokenFrame(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("over a whole token list: drops a frame it cannot read, keeps the token", () => {
    const tokens = [
      { id: "a" },
      { id: "b", frame: { bands: "none" } as unknown as TokenFrame },
      { id: "c", frame: defaultTokenFrame() },
    ];
    const coerced = coerceTokenFrames(tokens);
    expect(coerced[0]).toBe(tokens[0]);
    expect(coerced[1]).toEqual({ id: "b" });
    expect(coerced[2]!.frame).toEqual(defaultTokenFrame());
    // the default ring, the commonest frame there is, loads as itself: no copy per load
    expect(coerced[2]).toBe(tokens[2]);
    expect(coerceTokenFrames("x" as unknown as [])).toEqual([]);
  });
});

describe("presets in use", () => {
  it("dress new tokens in a plain ring, regular weight, the player's colour", () => {
    const frame = defaultTokenFrame();
    expect(frame.preset).toBe("plain.ring");
    expect(frame.accent).toBe("personal");
    expect(frameWeight(frame)).toBeCloseTo(0.1);
    expect(frame.bands[0]).toMatchObject({ generator: "plain", palette: "personal", depth: 0.6 });
    // what the server stores is what it would have validated
    expect(accepted(frame)).toEqual(frame);
  });

  it("scale every band in proportion, clamped to the limits", () => {
    const slab = withFrameWeight(welded(), 0.24);
    expect(slab.bands.map((band) => band.weight)).toEqual([0.036, 0.168, 0.036]);
    expect(frameWeight(withFrameWeight(welded(), 2))).toBeCloseTo(0.34);
    expect(frameWeight(withFrameWeight(welded(), 0))).toBeCloseTo(0.04);
  });

  it("know which presets glow, and which ids exist", () => {
    expect(frameHasGlow(presetFrame("stone.cracked")!)).toBe(true);
    expect(frameHasGlow(presetFrame("stone.castle")!)).toBe(false);
    expect(findFramePreset(undefined)).toBeUndefined();
    expect(presetFrame("nature.ivy")).toBeUndefined();
  });
});
