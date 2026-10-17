/**
 * The tier a map token bakes at (C5a, review round 3): every framed token on
 * the map is held at once, so the count caps the tier for all of them alike,
 * and a re-render that changes nothing asks for nothing new. Round 2 fitted
 * each token against the others' holds instead: render order decided who
 * stayed crisp, a phone passed its 16 MB, and every hover re-baked.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultTokenFrame, type FrameBakeInput } from "@herobyte/shared";
import { useFrameBitmap } from "../useFrameBitmap";

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

const request = (framedTokens: number | undefined, zoom = 8) => ({
  frame: defaultTokenFrame(),
  tokenId: "t1",
  color: "#390076",
  tokenPx: 75,
  zoom,
  framedTokens,
});

describe("a map token's frame tier", () => {
  beforeEach(() => {
    requested.length = 0;
    cap = 48 * 1024 * 1024;
    vi.stubGlobal("devicePixelRatio", 2);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is capped by how many tokens wear a frame, not by the order they draw in", () => {
    const { result } = renderHook(() => useFrameBitmap(request(30)));
    expect(result.current?.tier).toBe(512);
    expect(requested.at(-1)?.tier).toBe(512);
  });

  it("asks for nothing new when the map re-renders with nothing changed", () => {
    const { rerender } = renderHook(() => useFrameBitmap(request(30)));
    for (let i = 0; i < 10; i++) rerender();
    expect(requested).toHaveLength(1);
  });

  it("is crisp at full size with few framed tokens, and a phone's cap holds 30 at 256", () => {
    expect(renderHook(() => useFrameBitmap(request(10))).result.current?.tier).toBe(1024);
    cap = 16 * 1024 * 1024;
    expect(renderHook(() => useFrameBitmap(request(30))).result.current?.tier).toBe(256);
  });

  it("leaves a preview (no count) at the tier its size needs", () => {
    expect(renderHook(() => useFrameBitmap(request(undefined))).result.current?.tier).toBe(1024);
  });
});
