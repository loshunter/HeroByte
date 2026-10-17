import { describe, expect, it } from "vitest";
import { frameTierCeiling, nextFrameBudget, pickFrameTier } from "../frameTier";

describe("pickFrameTier", () => {
  it("takes the smallest tier that covers the frame on screen", () => {
    expect(pickFrameTier(90, null, false)).toBe(128);
    expect(pickFrameTier(129, null, false)).toBe(256);
    expect(pickFrameTier(700, null, false)).toBe(1024);
    expect(pickFrameTier(5000, null, false)).toBe(1024);
  });

  it("stops at 512 on a coarse pointer", () => {
    expect(pickFrameTier(900, null, true)).toBe(512);
    expect(pickFrameTier(900, 1024, true)).toBe(512);
  });

  it("lets a bitmap stretch 8% before baking the next tier up", () => {
    expect(pickFrameTier(270, 256, false)).toBe(256);
    expect(pickFrameTier(277, 256, false)).toBe(512);
  });

  it("takes a smaller tier only once the frame is 15% under it", () => {
    expect(pickFrameTier(250, 512, false)).toBe(512); // fits 256, but not 15% under it
    expect(pickFrameTier(218, 512, false)).toBe(512);
    expect(pickFrameTier(217, 512, false)).toBe(256);
  });

  it("so a zoom back and forth across a boundary re-bakes once, not every step", () => {
    let tier: number | null = null;
    const tiers: number[] = [];
    for (const needed of [240, 262, 250, 266, 245, 258, 248]) {
      tier = pickFrameTier(needed, tier, false);
      tiers.push(tier);
    }
    expect(new Set(tiers).size).toBe(1);
  });

  it("steps straight down to the smallest tier that fits, not only to the next one", () => {
    expect(pickFrameTier(240, 1024, false)).toBe(512);
    expect(pickFrameTier(100, 1024, false)).toBe(128);
  });

  it("caps every map token at the one tier all of them fit the cache at, whatever their order", () => {
    const MB = 1024 * 1024;
    expect(frameTierCeiling(30, 48 * MB)).toBe(512); // 30 MB, where 1024 would be 120 MB
    expect(frameTierCeiling(30, 16 * MB)).toBe(256); // a phone: 7.5 MB
    expect(frameTierCeiling(10, 48 * MB)).toBe(1024); // 40 MB
    expect(frameTierCeiling(0, 48 * MB)).toBe(1024);
    expect(frameTierCeiling(5000, 16 * MB)).toBe(128); // never below the smallest tier
  });
});

describe("the map's frame budget", () => {
  const MB = 1024 * 1024;
  const cap = 16 * MB;

  it("keeps every count's bitmaps inside the cap, sharing stones where even 128 does not fit", () => {
    for (let count = 1; count <= 1000; count += 1) {
      const { tier, shareSeeds } = nextFrameBudget(null, count, cap);
      const fits = count * tier * tier * 4 <= 0.9 * cap;
      expect(fits || shareSeeds, `${count} bitmaps`).toBe(true);
      if (shareSeeds) expect(tier).toBe(128);
    }
    expect(nextFrameBudget(null, 230, cap).shareSeeds).toBe(false);
    expect(nextFrameBudget(null, 231, cap).shareSeeds).toBe(true);
  });

  it("drops at once, and rises only with room for a quarter more", () => {
    const at14 = nextFrameBudget(null, 14, cap); // 14 × 1 MB fits under 14.4 MB
    expect(at14.tier).toBe(512);
    const at15 = nextFrameBudget(at14, 15, cap);
    expect(at15.tier).toBe(256); // down at once
    // back to 14: not up yet (14 × 1.25 would not fit at 512), so nothing re-bakes twice
    expect(nextFrameBudget(at15, 14, cap).tier).toBe(256);
    expect(nextFrameBudget(at15, 11, cap).tier).toBe(512); // 14 at 512 fits: up again
  });

  it("stops sharing stones only with room for a quarter more", () => {
    const shared = nextFrameBudget(null, 231, cap);
    expect(nextFrameBudget(shared, 230, cap).shareSeeds).toBe(true);
    expect(nextFrameBudget(shared, 184, cap).shareSeeds).toBe(false);
  });
});
