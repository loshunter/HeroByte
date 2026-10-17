/**
 * What a map token asks the cache for under the map's budget (C5a, review
 * rounds 3 and 4): the budget's tier caps its own pick, a preview has no cap,
 * and past the smallest tier's room stones are shared (one seed for all).
 * The budget itself, and many tokens on a real cache, are frameTier.test.ts
 * and frameBudget.cache.test.ts.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presetFrame, type FrameBakeInput } from "@herobyte/shared";
import { useFrameBitmap } from "../useFrameBitmap";
import type { FrameTierBudget } from "../frameTier";

const requested: FrameBakeInput[] = [];
let cap = 48 * 1024 * 1024;
vi.mock("../frameBitmapCache", () => ({
  frameCacheCap: () => cap,
  peekFrameBitmap: () => null,
  retainFrameBitmap: () => () => {},
  requestFrameBitmap: (_key: string, input: FrameBakeInput) => {
    requested.push(input);
    return () => {};
  },
}));

const request = (budget: FrameTierBudget | undefined, tokenId = "t1") => ({
  frame: presetFrame("stone.castle")!,
  tokenId,
  color: "#390076",
  tokenPx: 75,
  zoom: 8,
  budget,
});

describe("a map token's frame tier", () => {
  beforeEach(() => {
    requested.length = 0;
    cap = 48 * 1024 * 1024;
    vi.stubGlobal("devicePixelRatio", 2);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is its own pick capped at the map's budget", () => {
    const { result } = renderHook(() => useFrameBitmap(request({ tier: 512, shareSeeds: false })));
    expect(result.current?.tier).toBe(512);
    expect(requested.at(-1)?.tier).toBe(512);
  });

  it("leaves a preview (no budget) at the tier its size needs", () => {
    expect(renderHook(() => useFrameBitmap(request(undefined))).result.current?.tier).toBe(1024);
  });

  it("bakes its stones with one shared seed once the budget says so", () => {
    renderHook(() => useFrameBitmap(request({ tier: 128, shareSeeds: false }, "a")));
    renderHook(() => useFrameBitmap(request({ tier: 128, shareSeeds: false }, "b")));
    expect(requested[0]!.seed).not.toBe(requested[1]!.seed);
    renderHook(() => useFrameBitmap(request({ tier: 128, shareSeeds: true }, "a")));
    renderHook(() => useFrameBitmap(request({ tier: 128, shareSeeds: true }, "b")));
    expect(requested[2]!.seed).toBe(0);
    expect(requested[3]!.seed).toBe(0);
  });
});
