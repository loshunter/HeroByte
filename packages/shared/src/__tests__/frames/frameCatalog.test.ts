import { describe, expect, it } from "vitest";
import {
  FRAME_PALETTES,
  FRAME_PRESETS,
  FRAME_GENERATOR_SPECS,
  buildFrameCatalogSource,
  clampFrameParam,
  resolveFrameParams,
  frameSizeScale,
} from "../../index.js";

const palette = (id: string, roles: Record<string, string> = {}) => ({
  id,
  name: id,
  roles: {
    top: "#999999",
    bevel: "#888888",
    side: "#666666",
    outline: "#222222",
    crack: "#333333",
    shadow: "#000000",
    ...roles,
  },
  specular: 0.1,
  gloss: 0.2,
});
const preset = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  theme: "plain",
  tags: [],
  bands: [{ generator: "plain", palette: "stone.grey", share: 1, depth: 0.6 }],
  ...extra,
});
const base = () => ({ palettes: [palette("stone.grey")], presets: [preset("plain.ring")] });
const errorsOf = (palettes: unknown[], presets: unknown[]) =>
  buildFrameCatalogSource(palettes, presets).errors;

describe("the frame catalog build", () => {
  it("accepts a good catalog and stores each preset at regular weight", () => {
    const { palettes, presets } = base();
    const result = buildFrameCatalogSource(palettes, [
      ...presets,
      preset("metal.welded", {
        theme: "metal",
        bands: [
          { generator: "plain", palette: "stone.grey", share: 0.15, depth: 1 },
          {
            generator: "plate",
            palette: "stone.grey",
            share: 0.7,
            depth: 0.5,
            params: { weld: true },
          },
          { generator: "plain", palette: "stone.grey", share: 0.15, depth: 1 },
        ],
      }),
    ]);
    expect(result.errors).toEqual([]);
    const welded = result.presets.find((entry) => entry.id === "metal.welded")!;
    expect(welded.frame.bands.map((band) => band.weight)).toEqual([0.015, 0.07, 0.015]);
    expect(welded.frame.preset).toBe("metal.welded");
    // glow and tint default to the player's colour when a palette leaves them out
    expect(result.palettes["stone.grey"]!.roles.glow).toBe("personal");
  });

  it("refuses a palette with a missing role, an unknown role or a bad colour", () => {
    const missing = palette("stone.sand");
    delete (missing.roles as Record<string, string>).outline;
    const errors = errorsOf(
      [...base().palettes, missing, palette("brick.red", { top: "red", sheen: "#ffffff" })],
      base().presets,
    );
    expect(errors).toContain('palette stone.sand: role "outline" missing');
    expect(errors).toContain('palette brick.red: role "top" must be #rrggbb or "personal"');
    expect(errors).toContain('palette brick.red: unknown role "sheen"');
  });

  it("refuses a preset over the weight cap or under the floor", () => {
    const errors = errorsOf(base().palettes, [
      ...base().presets,
      preset("stone.big", { weight: 0.5 }),
      preset("stone.thin", { weight: 0.01 }),
    ]);
    expect(errors).toContain("preset stone.big: weight over the cap of 0.34");
    expect(errors).toContain("preset stone.thin: weight under the floor of 0.04");
  });

  it("refuses unknown generators, palettes and params, and params out of range", () => {
    const errors = errorsOf(base().palettes, [
      ...base().presets,
      preset("a.one", {
        bands: [{ generator: "rune", palette: "stone.grey", share: 1, depth: 1 }],
      }),
      preset("a.two", { bands: [{ generator: "plain", palette: "gold", share: 1, depth: 1 }] }),
      preset("a.three", {
        bands: [
          {
            generator: "masonry",
            palette: "stone.grey",
            share: 1,
            depth: 1,
            params: { stoneLength: 9, mortar: 1, bond: "herringbone" },
          },
        ],
      }),
    ]);
    expect(errors).toContain('preset a.one band 1: unknown generator "rune"');
    expect(errors).toContain('preset a.two band 1: unknown palette "gold"');
    expect(errors).toContain('preset a.three band 1: param "stoneLength" out of range');
    expect(errors).toContain('preset a.three band 1: masonry has no param "mortar"');
    expect(errors).toContain('preset a.three band 1: param "bond" out of range');
  });

  it("refuses bad stacks: no bands, seven bands, shares that do not sum to one", () => {
    const band = { generator: "plain", palette: "stone.grey", share: 1 / 7, depth: 0.5 };
    const errors = errorsOf(base().palettes, [
      ...base().presets,
      preset("b.none", { bands: [] }),
      preset("b.seven", { bands: Array.from({ length: 7 }, () => band) }),
      preset("b.half", { bands: [{ ...band, share: 0.5 }] }),
      preset("b.odd", {
        theme: "glass",
        growth: "sideways",
        bands: [
          { ...band, share: 1, bevel: { profile: "wavy", width: 1 }, glow: { color: "red" } },
        ],
      }),
    ]);
    expect(errors).toContain("preset b.none: needs 1–6 bands");
    expect(errors).toContain("preset b.seven: 7 bands, at most 6");
    expect(errors).toContain("preset b.half: band shares sum to 0.500, not 1");
    expect(errors).toContain("preset b.odd: theme must be one of plain, stone, metal, wood");
    expect(errors).toContain("preset b.odd: growth must be in, out or mid");
    expect(errors.some((error) => error.startsWith("preset b.odd band 1: bevel"))).toBe(true);
    expect(errors.some((error) => error.startsWith("preset b.odd band 1: glow"))).toBe(true);
  });

  it("insists on the fallback material and the default ring, once each", () => {
    expect(errorsOf([palette("x.y")], [])).toEqual(
      expect.arrayContaining([
        "palette stone.grey: required (the fallback material)",
        "preset plain.ring: required (every new token wears it)",
      ]),
    );
    const doubled = errorsOf(
      [palette("stone.grey"), palette("stone.grey")],
      [preset("plain.ring"), preset("plain.ring")],
    );
    expect(doubled).toContain("palette stone.grey: listed twice");
    expect(doubled).toContain("preset plain.ring: listed twice");
    expect(errorsOf([{ id: "Bad Id" }], [])).toContain(
      'palette "Bad Id": id must be like "stone.grey"',
    );
  });
});

describe("the shipped catalog", () => {
  it("is the C5a launch set, default ring first", () => {
    expect(FRAME_PRESETS[0]!.id).toBe("plain.ring");
    expect(FRAME_PRESETS.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "plain.ring",
        "plain.chamfer",
        "stone.castle",
        "stone.sandstone",
        "stone.cave",
        "brick.red",
        "stone.cracked",
        "metal.steel",
        "metal.welded",
        "metal.riveted",
        "metal.rusted",
        "wood.oak",
      ]),
    );
    for (const entry of FRAME_PRESETS) {
      for (const band of entry.frame.bands) {
        expect(FRAME_GENERATOR_SPECS[band.generator]).toBeDefined();
        expect(FRAME_PALETTES[band.palette]).toBeDefined();
      }
    }
  });
});

describe("generator params", () => {
  it("clamp to their spec, round integers, and default the unreadable", () => {
    const length = FRAME_GENERATOR_SPECS.masonry!.params.stoneLength!;
    expect(clampFrameParam(length, 99)).toBe(4);
    expect(clampFrameParam(length, Number.NaN)).toBe(1.5);
    expect(clampFrameParam(FRAME_GENERATOR_SPECS.plank!.params.nails!, 1.6)).toBe(2);
    expect(clampFrameParam(FRAME_GENERATOR_SPECS.masonry!.params.bond!, "zigzag")).toBe("running");
    expect(clampFrameParam(FRAME_GENERATOR_SPECS.plate!.params.weld!, "yes")).toBe(false);
    expect(resolveFrameParams("plate", { weld: true, extra: 3 })).toMatchObject({ weld: true });
    expect(resolveFrameParams("plate", { extra: 3 })).not.toHaveProperty("extra");
    expect(resolveFrameParams("hexweave", {})).toEqual({});
  });

  it("thin the frame for big tokens, never below half", () => {
    expect(frameSizeScale("medium")).toBe(1);
    expect(frameSizeScale("tiny")).toBe(1);
    expect(frameSizeScale(undefined)).toBe(1);
    expect(frameSizeScale("large")).toBeCloseTo(1 / Math.sqrt(1.5));
    expect(frameSizeScale("gargantuan")).toBeCloseTo(1 / Math.sqrt(3));
  });
});
