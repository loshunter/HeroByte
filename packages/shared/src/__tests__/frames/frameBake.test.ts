import { describe, expect, it } from "vitest";
import {
  bakeFrame,
  colorToOkLab,
  contrastRatio,
  frameBakeKey,
  frameSeed,
  frameUsesAccent,
  parseColor,
  presetFrame,
  relativeLuminance,
  type TokenFrame,
} from "../../index.js";
import { createRaster, fillPolygon, rasterToRgba } from "../../frames/engine/raster.js";
import { LIGHT, UP, diffuse, personalRoleColor, slopeNormal } from "../../frames/engine/shading.js";
import { EDGE_SEGMENTS, stepFacets, windowShadowFacets } from "../../frames/engine/frameEdges.js";

const bake = (frame: TokenFrame, accent = "#4f7cc4", tier = 128, seed = 1) =>
  bakeFrame({ frame, accent, seed, tier });
const pixel = (pixels: Uint8ClampedArray, tier: number, x: number, y: number) => {
  const at = (Math.floor(y) * tier + Math.floor(x)) * 4;
  return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!, pixels[at + 3]!];
};

describe("the table light", () => {
  it("comes from the top-left, 55° up, and lights a flat top at its own colour", () => {
    expect(LIGHT[0]).toBeLessThan(0);
    expect(LIGHT[1]).toBeLessThan(0); // y runs down the screen: up is negative
    expect(LIGHT[2]).toBeCloseTo(Math.sin((55 * Math.PI) / 180));
    expect(diffuse(UP)).toBeCloseTo(1);
  });

  it("brightens a slope facing it and darkens one facing away", () => {
    expect(diffuse(slopeNormal(-1, -1, 40))).toBeGreaterThan(1.1);
    expect(diffuse(slopeNormal(1, 1, 40))).toBeLessThan(0.75);
    expect(slopeNormal(0, 0, 40)).toEqual(UP);
  });
});

describe("personal colours", () => {
  it("keep their shading steps at the dark end of the colour window", () => {
    const L = (role: Parameters<typeof personalRoleColor>[1]) =>
      colorToOkLab(
        `#${[personalRoleColor("#390076", role)]
          .map(({ r, g, b }) =>
            [r, g, b]
              .map((c) =>
                Math.round(c * 255)
                  .toString(16)
                  .padStart(2, "0"),
              )
              .join(""),
          )
          .join("")}`,
      )!.L;
    expect(L("top")).toBeGreaterThan(L("bevel"));
    expect(L("bevel")).toBeGreaterThan(L("side"));
    expect(L("side")).toBeGreaterThan(L("outline"));
    expect(L("outline")).toBeGreaterThan(0.07);
  });

  it("read by their lit facets on the dark map and in fog, not by a fixed rim", () => {
    for (const accent of ["#390076", "#14254a", "#4a0f1c"]) {
      const { pixels } = bake(presetFrame("plain.ring")!, accent, 256);
      const lit: number[][] = [];
      for (let at = 0; at < pixels.length; at += 4) {
        if (pixels[at + 3]! > 250) lit.push([pixels[at]!, pixels[at + 1]!, pixels[at + 2]!]);
      }
      const luminance = (c: number[]) =>
        relativeLuminance({ r: c[0]! / 255, g: c[1]! / 255, b: c[2]! / 255 });
      lit.sort((a, b) => luminance(b) - luminance(a));
      const brightest = lit[Math.floor(lit.length * 0.02)]!;
      const rgb = { r: brightest[0]! / 255, g: brightest[1]! / 255, b: brightest[2]! / 255 };
      expect(contrastRatio(rgb, parseColor("#2a2622")!)).toBeGreaterThan(3);
      expect(contrastRatio(rgb, parseColor("#14161c")!)).toBeGreaterThan(3);
    }
  });
});

describe("the raster", () => {
  it("fills a polygon fully inside and partly at a half-covered edge", () => {
    const raster = createRaster(8);
    fillPolygon(raster, [1, 1, 4.5, 1, 4.5, 5, 1, 5], { r: 1, g: 0, b: 0 });
    fillPolygon(raster, [0, 0, 1, 0], { r: 1, g: 1, b: 1 }); // degenerate: nothing
    fillPolygon(raster, [6, 6, 7, 6, 7, 7], { r: 1, g: 1, b: 1 }, 0); // invisible: nothing
    const bytes = rasterToRgba(raster);
    expect(pixel(bytes, 8, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(bytes, 8, 4, 2)[3]).toBe(128);
    expect(pixel(bytes, 8, 6, 6)[3]).toBe(0);
  });

  it("clips a polygon reaching past the bitmap", () => {
    const raster = createRaster(4);
    fillPolygon(raster, [-3, -3, 9, -3, 9, 9, -3, 9], { r: 0, g: 1, b: 0 }, 0.5);
    const bytes = rasterToRgba(raster);
    expect(pixel(bytes, 4, 0, 0)).toEqual([0, 255, 0, 128]);
    expect(pixel(bytes, 4, 3, 3)).toEqual([0, 255, 0, 128]);
  });
});

describe("the bake", () => {
  it("is deterministic: same frame, colour and seed, same bytes", () => {
    const frame = presetFrame("stone.castle")!;
    expect(bake(frame, "#4f7cc4", 128, 9).pixels).toEqual(bake(frame, "#4f7cc4", 128, 9).pixels);
    expect(bake(frame, "#4f7cc4", 128, 9).pixels).not.toEqual(
      bake(frame, "#4f7cc4", 128, 10).pixels,
    );
  });

  it("leaves the window clear for the picture, darkened only at its edge", () => {
    const { pixels, layout } = bake(presetFrame("plain.ring")!, "#4f7cc4", 128);
    const centre = pixel(pixels, 128, 64, 64);
    expect(centre[3]).toBe(0);
    const px = (r: number) => 64 + (r / (2 * layout.extent)) * 128;
    expect(pixel(pixels, 128, 64, px(-layout.window) + 1)[3]).toBeGreaterThan(0);
    expect(pixel(pixels, 128, 64, px(layout.outer + 0.004))[3]).toBe(0); // outside: the map
  });

  it("casts a step's contact shadow on the side away from the light", () => {
    const { shadow } = stepFacets(0.42, 0.5, true, 0.005, 0.02);
    const alphaAt = (dx: number, dy: number) => {
      const angle = Math.atan2(dy, dx);
      const segment = (2 * Math.PI) / EDGE_SEGMENTS;
      const index = Math.floor(((angle + 2 * Math.PI) % (2 * Math.PI)) / segment) % EDGE_SEGMENTS;
      return shadow[index * 2]!.alpha;
    };
    expect(alphaAt(1, 1)).toBeGreaterThan(alphaAt(-1, -1) * 2); // bottom-right, away from the light
    const window = windowShadowFacets(0.4, 0.6);
    expect(window[0]!.alpha).toBeGreaterThan(0);
  });

  it("shows the welded strip's steps lit on the top-left and shadowed bottom-right", () => {
    const tier = 256;
    const { pixels, layout } = bake(presetFrame("metal.welded", 0.24)!, "#4f7cc4", tier);
    const plate = layout.rings[1]!;
    // just inside the plate band, against the taller inner rim: shadowed bottom-right only
    const r = plate.r0 + 0.004;
    const at = (dx: number, dy: number) => {
      const scale = tier / (2 * layout.extent);
      const length = Math.hypot(dx, dy);
      return pixel(
        pixels,
        tier,
        tier / 2 + (dx / length) * r * scale,
        tier / 2 + (dy / length) * r * scale,
      );
    };
    const brightness = (c: number[]) => c[0]! + c[1]! + c[2]!;
    expect(brightness(at(1, 1))).toBeLessThan(brightness(at(-1, -1)));
  });
});

describe("the bake key", () => {
  const ring = presetFrame("plain.ring")!;
  const castle = presetFrame("stone.castle")!;
  const key = (frame: TokenFrame, overrides: Partial<Parameters<typeof frameBakeKey>[0]> = {}) =>
    frameBakeKey({ frame, accent: "#4f7cc4", seed: frameSeed("a"), tier: 256, ...overrides });

  it("lets every plain ring of one colour share a bake, whoever's token", () => {
    expect(key(ring)).toBe(key(ring, { seed: frameSeed("b") }));
    expect(key(ring)).not.toBe(key(ring, { accent: "#c0392b" }));
    expect(key(ring)).not.toBe(key(ring, { tier: 512 }));
    expect(key(ring)).not.toBe(key(ring, { size: "huge" }));
  });

  it("keeps two castle rings apart by their token's seed, but not by a colour they do not take", () => {
    expect(key(castle)).not.toBe(key(castle, { seed: frameSeed("b") }));
    expect(key(castle)).toBe(key(castle, { accent: "#c0392b" }));
    expect(frameUsesAccent(castle)).toBe(false);
    // cracked stone's glow takes the character's colour, its stone does not
    expect(frameUsesAccent(presetFrame("stone.cracked")!)).toBe(false);
    expect(frameUsesAccent(presetFrame("plain.ring")!)).toBe(true);
  });

  it("changes with every knob the bake reads", () => {
    const deeper = { ...castle, bands: [{ ...castle.bands[0]!, depth: 0.9 }] };
    const out = { ...castle, growth: "out" as const };
    const params = {
      ...castle,
      bands: [{ ...castle.bands[0]!, params: { ...castle.bands[0]!.params, gap: 0.12 } }],
    };
    for (const changed of [deeper, out, params]) expect(key(changed)).not.toBe(key(castle));
  });

  it("derives seeds from token ids, the same on every client", () => {
    expect(frameSeed("token-1")).toBe(frameSeed("token-1"));
    expect(frameSeed("token-1")).not.toBe(frameSeed("token-2"));
  });
});
