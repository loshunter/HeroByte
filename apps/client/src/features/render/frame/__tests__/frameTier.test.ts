import { describe, expect, it } from "vitest";
import { frameTierCeiling, pickFrameTier } from "../frameTier";

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
    for (const count of [1, 7, 30, 120]) {
      const tier = frameTierCeiling(count, 16 * MB);
      if (tier > 128) expect(count * tier * tier * 4).toBeLessThanOrEqual(0.9 * 16 * MB);
    }
  });
});
