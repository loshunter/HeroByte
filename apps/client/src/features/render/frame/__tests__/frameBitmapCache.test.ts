// The cache that keeps the table from baking a frame twice. jsdom has no
// Worker, ImageData or createImageBitmap: the bake takes the timer path (the
// same pure bake), and the two bitmap globals are stubbed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frameBakeKey, frameSeed, presetFrame, type FrameBakeInput } from "@herobyte/shared";
import {
  frameStatsSnapshot,
  peekFrameBitmap,
  requestFrameBitmap,
  resetFrameBitmapCache,
} from "../frameBitmapCache";

const input = (tier: number, tokenId = "a"): FrameBakeInput => ({
  frame: presetFrame("plain.ring")!,
  accent: "#4f7cc4",
  seed: frameSeed(tokenId),
  tier,
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0)).then(() => undefined);
async function drain() {
  for (let step = 0; step < 4; step += 1) await settle();
}

describe("the frame bitmap cache", () => {
  let coarse = false;
  beforeEach(() => {
    coarse = false;
    vi.stubGlobal(
      "ImageData",
      class {
        constructor(
          public data: Uint8ClampedArray,
          public width: number,
          public height: number,
        ) {}
      },
    );
    vi.stubGlobal("createImageBitmap", async (image: { width: number }) => ({
      width: image.width,
      height: image.width,
    }));
    vi.stubGlobal("matchMedia", () => ({ matches: coarse }));
    window.matchMedia = ((query: string) => ({ matches: coarse, media: query })) as never;
    resetFrameBitmapCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("bakes once for everyone who wants the same frame, then hands out the bitmap", async () => {
    const job = input(128);
    const key = frameBakeKey(job);
    const first = vi.fn();
    const second = vi.fn();
    requestFrameBitmap(key, job, first);
    requestFrameBitmap(key, job, second);
    expect(peekFrameBitmap(key)).toBeNull();
    await drain();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(peekFrameBitmap(key)).toMatchObject({ width: 128 });
    expect(frameStatsSnapshot()).toMatchObject({ bakes: 1, syncBakes: 1, entries: 1 });
    // a later ask for a cached key bakes nothing
    requestFrameBitmap(key, job, vi.fn())();
    await drain();
    expect(frameStatsSnapshot().bakes).toBe(1);
  });

  it("drops a bake nobody wants any more before it starts", async () => {
    const job = input(256);
    const key = frameBakeKey(job);
    const withdraw = requestFrameBitmap(key, job, vi.fn());
    withdraw();
    await drain();
    expect(peekFrameBitmap(key)).toBeNull();
    expect(frameStatsSnapshot().bakes).toBe(0);
  });

  it("keeps under its byte cap, the oldest bitmap going first", async () => {
    coarse = true; // 16 MB: four 1024 bitmaps
    const keys: string[] = [];
    for (const tokenId of ["a", "b", "c", "d", "e"]) {
      const job = { ...input(1024, tokenId), frame: presetFrame("stone.castle")! };
      const key = frameBakeKey(job);
      keys.push(key);
      requestFrameBitmap(key, job, vi.fn());
      await drain();
    }
    const stats = frameStatsSnapshot();
    expect(stats.cap).toBe(16 * 1024 * 1024);
    expect(stats.cacheBytes).toBeLessThanOrEqual(stats.cap);
    expect(stats.entries).toBe(4);
    expect(peekFrameBitmap(keys[0]!)).toBeNull();
    expect(peekFrameBitmap(keys[4]!)).not.toBeNull();
  });

  it("puts its counts on the dev seam", async () => {
    const job = input(128);
    requestFrameBitmap(frameBakeKey(job), job, vi.fn());
    await drain();
    const seam = (window as unknown as { __HERO_BYTE_E2E__?: { frames?: { bakes: number } } })
      .__HERO_BYTE_E2E__;
    expect(seam?.frames?.bakes).toBe(1);
  });
});
