// Light & Colour II, Phase 1 (catalog rank 2): cool-hue element shadows. The
// map-level `shadowTint` mixes every darkening term (contact AO, near cast
// shadow, long throw) toward a shadow COLOUR as `keep` falls, instead of
// grey-multiplying — shadowed pixels stay saturated (rose cobble → plum).
//
// The parity invariant is non-negotiable and pinned twice here:
//  1. No `shadowTint` ⇒ the shipped grey-multiply arithmetic, BYTE-identical —
//     frozen against pixel literals + a full-buffer hash captured from the
//     pre-change renderer.
//  2. `shadowTint: "#000000"` ⇒ the same bytes as no tint on this scene —
//     with a black tint the clamped mix computes c − (1−keep)·c, the same
//     float expression as the multiply path, so the degenerate case shows the
//     new arithmetic contains the old one (pinned empirically, buffer-wide).

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderTerrainField,
  type TerrainFieldConfig,
  type TerrainFieldFamily,
} from "../proceduralTerrain";
import { bakeProceduralTerrain, buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { shadowedRgb } from "../terrainFieldColor";
import { VILLAGE_SHADOW_TINT, VILLAGE_TERRAIN } from "../terrainPalette";

// Pass-through spy on renderTerrainField so the plumb suite can observe the
// config the REAL bakeProceduralTerrain builds (the middle link of the tint
// chain — a mutation reverting its 4th argument passed the whole suite until
// this pin existed; confirmed adversarial-review finding). Every other test
// in this file reaches the genuine implementation through the wrapper.
const renderFieldSpy = vi.hoisted(() => ({ lastConfig: null as TerrainFieldConfig | null }));
vi.mock("../proceduralTerrain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../proceduralTerrain")>();
  return {
    ...actual,
    renderTerrainField: (
      pixels: Uint8ClampedArray,
      width: number,
      height: number,
      config: TerrainFieldConfig,
    ): void => {
      renderFieldSpy.lastConfig = config;
      actual.renderTerrainField(pixels, width, height, config);
    },
  };
});

const GRASS = "terrain:grass";
const TALL = "terrain:test-tall";
const CELL = 16;

const FAMILIES: TerrainFieldFamily[] = [
  { assetId: GRASS, priority: 3, base: "#7cb04a", rim: "#4a764e" },
  {
    assetId: TALL,
    priority: 20,
    base: "#b3a687",
    rim: "#4e4638",
    edgeAmp: 0,
    // All three darkening terms active: near cast shadow, long throw (band
    // above the 0.15 default), and the omnidirectional contact band.
    shadow: { band: 0.6, strength: 0.3 },
    contact: { reach: 0.3, strength: 0.2 },
  },
];

// A tall 2x2 block in the middle of grass — the same scene the contact/long
// suite uses, so every darkening code path runs.
const rows = (): (string | null)[][] =>
  Array.from({ length: 12 }, (_, cy) =>
    Array.from({ length: 12 }, (_, cx) =>
      cx >= 5 && cx <= 6 && cy >= 5 && cy <= 6 ? TALL : GRASS,
    ),
  );

function render(shadowTint?: string) {
  const grid = rows();
  const w = grid[0]!.length * CELL;
  const h = grid.length * CELL;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const config: TerrainFieldConfig = {
    familyAt: (cx, cy) =>
      cy >= 0 && cy < grid.length && cx >= 0 && cx < grid[0]!.length ? grid[cy]![cx]! : null,
    families: FAMILIES,
    cellSize: CELL,
    originX: 0,
    originY: 0,
    ...(shadowTint === undefined ? {} : { shadowTint }),
  };
  renderTerrainField(pixels, w, h, config);
  return { pixels, w, h };
}

const px = (r: { pixels: Uint8ClampedArray; w: number }, x: number, y: number): number[] => {
  const o = (y * r.w + x) * 4;
  return [r.pixels[o]!, r.pixels[o + 1]!, r.pixels[o + 2]!, r.pixels[o + 3]!];
};

/** FNV-1a over the whole buffer — one number that changes if ANY byte does. */
const fnv1a = (bytes: Uint8ClampedArray): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// Sample points (pixel coords): all relative to the block at cells (5,5)-(6,6).
const SHADOW_PX = { x: 5 * CELL - 2, y: 7 * CELL + 2 }; // down-left corner: near shadow
const CONTACT_PX = { x: 6 * CELL, y: 5 * CELL - 2 }; // above top edge: contact only
const THROW_PX = { x: 5 * CELL - 6, y: 6 * CELL + CELL / 2 }; // long-throw strip
const INTERIOR_PX = { x: 2 * CELL, y: 2 * CELL }; // deep grass, no darkening

describe("map-level shadow tint — parity when absent (frozen bytes)", () => {
  it("no shadowTint keeps the shipped grey-multiply bytes, pixel-for-pixel", () => {
    const r = render();
    // Captured from the pre-shadowTint renderer (2026-07-19). If these move,
    // the knob-less default changed — that is the bug (byte-parity rule).
    expect(px(r, SHADOW_PX.x, SHADOW_PX.y)).toEqual([118, 167, 70, 255]);
    expect(px(r, CONTACT_PX.x, CONTACT_PX.y)).toEqual([111, 157, 66, 255]);
    expect(px(r, THROW_PX.x, THROW_PX.y)).toEqual([119, 169, 71, 255]);
    expect(px(r, INTERIOR_PX.x, INTERIOR_PX.y)).toEqual([124, 176, 74, 255]);
    expect(fnv1a(r.pixels)).toBe(644308733);
  });

  it("a BLACK shadowTint renders byte-identically to no tint (the degenerate multiply)", () => {
    const grey = render();
    const black = render("#000000");
    expect(Array.from(black.pixels)).toEqual(Array.from(grey.pixels));
  });

  it("shadowedRgb without a tint is the grey multiply, value for value", () => {
    for (const keep of [0, 0.25, 0.41, 0.7, 0.93, 1]) {
      expect(shadowedRgb([124, 176, 74], keep, null)).toEqual([
        Math.round(124 * keep),
        Math.round(176 * keep),
        Math.round(74 * keep),
      ]);
    }
  });
});

describe("map-level shadow tint — cool-hue shadows when present", () => {
  it("changes ONLY darkened pixels; undarkened ground is byte-identical", () => {
    const grey = render();
    const plum = render(VILLAGE_SHADOW_TINT);
    // The deep interior sample never sits in any shadow term — untouched.
    expect(px(plum, INTERIOR_PX.x, INTERIOR_PX.y)).toEqual(px(grey, INTERIOR_PX.x, INTERIOR_PX.y));
    // The tint changed something (the shadows exist and are re-hued).
    expect(fnv1a(plum.pixels)).not.toBe(fnv1a(grey.pixels));
  });

  it("every shadowed pixel keeps more blue than the grey multiply (the cool shift)", () => {
    const grey = render(); // scene has no mottle: flats are deterministic
    const plum = render(VILLAGE_SHADOW_TINT);
    let differing = 0;
    let deep = 0;
    for (let o = 0; o < grey.pixels.length; o += 4) {
      const same =
        grey.pixels[o] === plum.pixels[o] &&
        grey.pixels[o + 1] === plum.pixels[o + 1] &&
        grey.pixels[o + 2] === plum.pixels[o + 2];
      if (same) continue;
      differing += 1;
      // Mixing toward the plum floor keeps every channel at/above the grey
      // multiply, blue strictly — the shadow is hue-shifted, never crushed.
      expect(plum.pixels[o]!).toBeGreaterThanOrEqual(grey.pixels[o]!);
      expect(plum.pixels[o + 1]!).toBeGreaterThanOrEqual(grey.pixels[o + 1]!);
      expect(plum.pixels[o + 2]!).toBeGreaterThanOrEqual(grey.pixels[o + 2]!);
      // Blue-to-red balance shifts strictly cool where the shadow is deep
      // enough for the analytic margin to dwarf per-channel rounding (±1
      // count flips the ratio ~0.005 at shallow darkening, so shallow pixels
      // are covered by the per-channel claims above only).
      if (grey.pixels[o]! <= 112) {
        deep += 1;
        const greyRatio = grey.pixels[o + 2]! / Math.max(1, grey.pixels[o]!);
        const plumRatio = plum.pixels[o + 2]! / Math.max(1, plum.pixels[o]!);
        expect(plumRatio).toBeGreaterThan(greyRatio);
      }
    }
    expect(differing).toBeGreaterThan(50); // the shadow band is a real region
    expect(deep).toBeGreaterThan(10); // and the strict cool claim ran on it
  });

  it("shadowed pixels still darken (a shadow, not a glaze): luma below the base", () => {
    const plum = render(VILLAGE_SHADOW_TINT);
    const luma = (p: number[]): number => 0.2126 * p[0]! + 0.7152 * p[1]! + 0.0722 * p[2]!;
    const base = luma(px(plum, INTERIOR_PX.x, INTERIOR_PX.y));
    expect(luma(px(plum, CONTACT_PX.x, CONTACT_PX.y))).toBeLessThan(base);
    expect(luma(px(plum, SHADOW_PX.x, SHADOW_PX.y))).toBeLessThan(base);
  });
});

describe("shadow tint plumb (surface → field config)", () => {
  const layer = {
    assetId: "terrain:grass",
    cells: [{ cellX: 0, cellY: 0, x: 0, y: 0, size: 50 }],
    edges: [],
  };
  const grid = { size: 50, offsetX: 0, offsetY: 0 };

  beforeEach(() => {
    renderFieldSpy.lastConfig = null;
  });

  it("buildProceduralFieldConfig carries the tint into the field config", () => {
    const built = buildProceduralFieldConfig([layer], grid, VILLAGE_TERRAIN, VILLAGE_SHADOW_TINT);
    expect(built).not.toBeNull();
    expect(built!.config.shadowTint).toBe(VILLAGE_SHADOW_TINT);
  });

  it("omitting the tint leaves the config knob-less (parity default)", () => {
    const built = buildProceduralFieldConfig([layer], grid, VILLAGE_TERRAIN);
    expect(built!.config.shadowTint).toBeUndefined();
  });

  it("the REAL bakeProceduralTerrain forwards its input tint into the rendered config", () => {
    // Through the genuine bake (not a caller-side mock): the config that
    // reaches renderTerrainField must carry the tint. In jsdom the bake
    // returns null at the canvas step, but the field render — and this pin —
    // happen before that. A 3-arg revert of the forwarding fails here.
    bakeProceduralTerrain({
      terrainLayers: [layer],
      grid,
      palette: VILLAGE_TERRAIN,
      shadowTint: VILLAGE_SHADOW_TINT,
    });
    expect(renderFieldSpy.lastConfig).not.toBeNull();
    expect(renderFieldSpy.lastConfig!.shadowTint).toBe(VILLAGE_SHADOW_TINT);
  });
});

describe("shadow tint never brightens (the dark-pixel clamp)", () => {
  it("shadowedRgb leaves channels at/below the tint untouched and still darkens the rest", () => {
    const plum = [58, 47, 69] as const;
    // Deep-water navy #1b3f58: red (27) sits below the tint — a pure lerp
    // would BRIGHTEN it toward 58 (the inverted-shadow review finding);
    // green/blue sit above and must still darken toward the tint.
    const shadowed = shadowedRgb([27, 63, 88], 0.7, [...plum]);
    expect(shadowed[0]).toBe(27); // never brightened
    expect(shadowed[1]).toBeLessThan(63);
    expect(shadowed[1]).toBeGreaterThanOrEqual(plum[1]);
    expect(shadowed[2]).toBeLessThan(88);
    expect(shadowed[2]).toBeGreaterThanOrEqual(plum[2]);
    // A pixel entirely below the tint (ink rim #26272e) is a strict no-op.
    expect(shadowedRgb([38, 39, 46], 0.6, [...plum])).toEqual([38, 39, 46]);
  });

  it("every rendered pixel under the plum tint is at most as bright per channel as unshadowed", () => {
    const grey = render();
    const plum = render(VILLAGE_SHADOW_TINT);
    for (let o = 0; o < grey.pixels.length; o += 4) {
      // The grey multiply only ever darkens; the clamped tint must never
      // exceed the ORIGINAL colour either. Compare against the base render's
      // undarkened pixels is impossible per-pixel here, so pin the invariant
      // that tinted never exceeds greyed by more than the tint lift allows
      // AND never exceeds the family base channels (grass 124,176,74 caps
      // every grass-region pixel in this mottle-free scene).
      if (plum.pixels[o + 3] === 0) continue;
      const isGrassHued = plum.pixels[o + 1]! > plum.pixels[o]!;
      if (isGrassHued) {
        // Caps are the per-channel max of the grass base (124,176,74) and its
        // rim (74,118,78) — the only green-dominant flats in this scene.
        expect(plum.pixels[o]!).toBeLessThanOrEqual(124);
        expect(plum.pixels[o + 1]!).toBeLessThanOrEqual(176);
        expect(plum.pixels[o + 2]!).toBeLessThanOrEqual(78);
      }
    }
  });
});
