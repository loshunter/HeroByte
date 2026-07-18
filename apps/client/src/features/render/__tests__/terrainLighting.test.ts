import { describe, expect, it } from "vitest";
import { applyBakeLighting, lightingActive, type BakeLighting } from "../terrainLighting";

// A 4x4 world-px buffer of solid mid-grey, origin at world (0,0).
function greyBuffer(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i += 1) {
    pixels[i * 4] = 128;
    pixels[i * 4 + 1] = 128;
    pixels[i * 4 + 2] = 128;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}

const px = (pixels: Uint8ClampedArray, x: number, y: number): number[] => [
  pixels[(y * 4 + x) * 4]!,
  pixels[(y * 4 + x) * 4 + 1]!,
  pixels[(y * 4 + x) * 4 + 2]!,
  pixels[(y * 4 + x) * 4 + 3]!,
];

describe("applyBakeLighting", () => {
  it("daylight with no lights is a no-op (unlit maps bake bit-identically)", () => {
    const a = greyBuffer();
    const b = greyBuffer();
    expect(lightingActive({ ambient: 1, lights: [] })).toBe(false);
    applyBakeLighting(a, 4, 4, 0, 0, { ambient: 1, lights: [] });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("the veil darkens every opaque pixel with a cool cast (red dims hardest)", () => {
    const pixels = greyBuffer();
    applyBakeLighting(pixels, 4, 4, 0, 0, { ambient: 0.4, lights: [] });
    const [r, g, b, alpha] = px(pixels, 1, 1);
    expect(alpha).toBe(255);
    expect(g!).toBeLessThan(128);
    expect(r!).toBeLessThan(g!); // cool: red below green…
    expect(b!).toBeGreaterThan(g!); // …blue above green
  });

  it("a pool cancels the veil at its core and warm-tints the ground", () => {
    const lighting: BakeLighting = {
      ambient: 0.3,
      lights: [{ x: 0.5, y: 0.5, radius: 3, color: "#ff9040", intensity: 1 }],
    };
    const pixels = greyBuffer();
    applyBakeLighting(pixels, 4, 4, 0, 0, lighting);
    const core = px(pixels, 0, 0); // at the light
    const far = px(pixels, 3, 3); // ~3.5px away, outside the radius
    // The core stays bright while the far corner sinks under the veil…
    expect(core[1]!).toBeGreaterThan(far[1]! + 40);
    // …and the core is tinted toward the warm light (red pulled above blue).
    expect(core[0]!).toBeGreaterThan(core[2]!);
  });

  it("leaves transparent pixels untouched", () => {
    const pixels = greyBuffer();
    pixels[3] = 0; // pixel (0,0) transparent
    applyBakeLighting(pixels, 4, 4, 0, 0, { ambient: 0.2, lights: [] });
    expect(px(pixels, 0, 0)).toEqual([128, 128, 128, 0]);
    expect(px(pixels, 1, 0)[1]).toBeLessThan(128); // opaque neighbour veiled
  });
});
