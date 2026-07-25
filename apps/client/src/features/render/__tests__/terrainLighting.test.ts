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

  it("daylight with lights placed is still a numeric no-op (the tint is veil-scaled)", () => {
    // Placing a torch at noon must not change a single byte: the pass runs
    // (lightingActive is true) but veil 0 zeroes both the darkening and the
    // pool tint. Pinned so the tint model never silently unhooks from ambient.
    const a = greyBuffer();
    const b = greyBuffer();
    expect(lightingActive({ ambient: 1, lights: [] })).toBe(false);
    applyBakeLighting(a, 4, 4, 0, 0, {
      ambient: 1,
      lights: [{ x: 2, y: 2, radius: 2, color: "#ff9040", intensity: 1 }],
    });
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

// Catalog rank 1 — the 3-stop pool profile. A wide buffer so the stops land on
// distinct pixels: light at x=0.5, radius 8 ⇒ core to ~2.4px, halo knee at
// 8px, wash to 22px, veiled baseline past that.
describe("3-stop pool profile (hot core → halo → broad wash)", () => {
  const W = 32;
  const H = 1;
  function rowBuffer(): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i += 1) {
      pixels[i * 4] = 128;
      pixels[i * 4 + 1] = 128;
      pixels[i * 4 + 2] = 128;
      pixels[i * 4 + 3] = 255;
    }
    return pixels;
  }
  const g = (pixels: Uint8ClampedArray, x: number): number => pixels[x * 4 + 1]!;
  const lighting: BakeLighting = {
    ambient: 0.3,
    lights: [{ x: 0.5, y: 0.5, radius: 8, color: "#ffcf70", intensity: 1 }],
  };

  it("brightness steps down core → halo → wash → veiled ground, and the wash ends at 2.75r", () => {
    const pixels = rowBuffer();
    applyBakeLighting(pixels, W, H, 0, 0, lighting);
    const core = g(pixels, 1); // d = 1px  (0.125r — hot core)
    const halo = g(pixels, 5); // d = 5px  (0.625r — falling halo)
    const wash = g(pixels, 12); // d = 12px (1.5r — broad wash)
    const dark = g(pixels, 30); // d = 30px (3.75r — past the wash)
    expect(core).toBeGreaterThan(halo);
    expect(halo).toBeGreaterThan(wash);
    expect(wash).toBeGreaterThan(dark);
    // Past the wash reach the pixel is exactly the plain-veil value.
    const veiled = rowBuffer();
    applyBakeLighting(veiled, W, H, 0, 0, { ambient: 0.3, lights: [] });
    expect(g(pixels, 30)).toBe(g(veiled, 30));
    // The wash genuinely reaches PAST the nominal radius (the old profile
    // ended at exactly r): 1.5r is still visibly brighter than the veil.
    expect(wash).toBeGreaterThan(g(veiled, 12) + 8);
  });

  it("the hot core is a plateau: full strength across the inner 30% of the radius", () => {
    const pixels = rowBuffer();
    applyBakeLighting(pixels, W, H, 0, 0, lighting);
    // d = 1px (0.125r) and d = 2px (0.25r) both sit inside the core plateau —
    // identical pool strength, so identical bytes.
    expect(px4(pixels, 1)).toEqual(px4(pixels, 2));
  });

  const px4 = (pixels: Uint8ClampedArray, x: number): number[] => [
    pixels[x * 4]!,
    pixels[x * 4 + 1]!,
    pixels[x * 4 + 2]!,
  ];

  it("the core re-tints the ground toward the light hue, not just back to neutral", () => {
    const pixels = rowBuffer();
    applyBakeLighting(pixels, W, H, 0, 0, lighting);
    const [r, , b] = px4(pixels, 1);
    // Warm lamp on grey ground: red pulled clearly above blue at the core.
    expect(r!).toBeGreaterThan(b! + 15);
  });
});

// Catalog rank 1's finishing touch: 4–8 hash-placed sparkle motes per pool.
describe("sparkle motes", () => {
  const S = 48;
  function squareBuffer(): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(S * S * 4);
    for (let i = 0; i < S * S; i += 1) {
      pixels[i * 4] = 128;
      pixels[i * 4 + 1] = 128;
      pixels[i * 4 + 2] = 128;
      pixels[i * 4 + 3] = 255;
    }
    return pixels;
  }
  const night: BakeLighting = {
    ambient: 0.3,
    lights: [{ x: 24, y: 24, radius: 8, color: "#ffcf70", intensity: 1 }],
  };
  // The brightest non-mote pixel is the restored+tinted core plateau (green
  // ≈147 on this grey ground); glints land ≈172–197 (toward light green 207
  // +90 lift at 0.85·veil alpha). 160 splits them with ≥12 margin each side.
  function glintCount(pixels: Uint8ClampedArray): number {
    let count = 0;
    for (let o = 0; o < pixels.length; o += 4) {
      if (pixels[o + 1]! >= 160) count += 1;
    }
    return count;
  }

  it("a night pool carries 4–8 glints; the render is deterministic", () => {
    const a = squareBuffer();
    applyBakeLighting(a, S, S, 0, 0, night);
    const glints = glintCount(a);
    expect(glints).toBeGreaterThanOrEqual(3); // ≥4 motes, allow 1 collision
    expect(glints).toBeLessThanOrEqual(16); // 1px each (≤8 motes, some AA-free)
    const b = squareBuffer();
    applyBakeLighting(b, S, S, 0, 0, night);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("daylight draws no motes (the ambient-1 bit-parity no-op survives)", () => {
    const a = squareBuffer();
    applyBakeLighting(a, S, S, 0, 0, { ambient: 1, lights: night.lights });
    const b = squareBuffer();
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("motes stay inside the halo, never sprinkle the far wash", () => {
    const pixels = squareBuffer();
    applyBakeLighting(pixels, S, S, 0, 0, night);
    for (let py = 0; py < S; py += 1) {
      for (let pxx = 0; pxx < S; pxx += 1) {
        if (pixels[(py * S + pxx) * 4 + 1]! >= 160) {
          const d = Math.hypot(pxx + 0.5 - 24, py + 0.5 - 24);
          expect(d).toBeLessThanOrEqual(8 * 0.85 + 1);
        }
      }
    }
  });
});
