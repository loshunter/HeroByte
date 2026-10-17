// The cache's worker road under jsdom: a fake Worker records the jobs and the
// test answers them, so the races the review found can be played in order —
// a late duplicate reply, a cancel that arrives after the bake started, a
// bitmap decode that fails, and eviction passing over a bitmap still drawn.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frameBakeKey, frameSeed, presetFrame, type FrameBakeInput } from "@herobyte/shared";
import {
  frameStatsSnapshot,
  peekFrameBitmap,
  requestFrameBitmap,
  resetFrameBitmapCache,
  retainFrameBitmap,
} from "../frameBitmapCache";

type Posted = { jobId: number; input: FrameBakeInput } | { cancel: number };
let posted: Posted[] = [];
const workers: { onmessage: ((event: { data: unknown }) => void) | null }[] = [];
let decodeFails = false;

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    workers.push(this);
  }
  postMessage(message: Posted) {
    posted.push(message);
  }
  terminate() {}
}

const input = (tier: number, tokenId = "a"): FrameBakeInput => ({
  frame: presetFrame("stone.castle")!,
  accent: "#4f7cc4",
  seed: frameSeed(tokenId),
  tier,
});
const reply = (jobId: number, tier: number) =>
  workers.at(-1)!.onmessage!({
    data: { jobId, pixels: new ArrayBuffer(tier * tier * 4), tier, ms: 5 },
  });
const jobs = () =>
  posted.filter(
    (message): message is { jobId: number; input: FrameBakeInput } => "jobId" in message,
  );
const settle = async () => {
  for (let step = 0; step < 4; step += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("the frame cache's worker road", () => {
  let coarse = false;
  beforeEach(() => {
    posted = [];
    workers.length = 0;
    decodeFails = false;
    coarse = false;
    vi.stubGlobal("Worker", FakeWorker);
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
    vi.stubGlobal("createImageBitmap", async (image: { width: number }) => {
      if (decodeFails) throw new Error("InvalidStateError");
      return { width: image.width, height: image.width };
    });
    window.matchMedia = ((query: string) => ({ matches: coarse, media: query })) as never;
    resetFrameBitmapCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("counts a bitmap once when a late reply arrives after a re-request", async () => {
    const job = input(512);
    const key = frameBakeKey(job);
    const withdraw = requestFrameBitmap(key, job, vi.fn());
    withdraw(); // the slider moved away before the bake answered
    requestFrameBitmap(key, job, vi.fn()); // and back again
    const [first, second] = jobs();
    reply(first!.jobId, 512); // the first job was already running: it answers anyway
    reply(second!.jobId, 512);
    await settle();
    const stats = frameStatsSnapshot();
    expect(stats.entries).toBe(1);
    expect(stats.cacheBytes).toBe(512 * 512 * 4);
    expect(posted.some((message) => "cancel" in message)).toBe(true);
  });

  it("tells whoever waited when a bitmap cannot be decoded, and bakes again on the next ask", async () => {
    const job = input(256);
    const key = frameBakeKey(job);
    const waiting = vi.fn();
    decodeFails = true;
    requestFrameBitmap(key, job, waiting);
    reply(jobs()[0]!.jobId, 256);
    await settle();
    expect(waiting).toHaveBeenCalledTimes(1);
    expect(peekFrameBitmap(key)).toBeNull();
    expect(frameStatsSnapshot()).toMatchObject({ failed: 1, bakes: 0 });
    decodeFails = false;
    requestFrameBitmap(key, job, vi.fn());
    expect(jobs()).toHaveLength(2);
  });

  it("never evicts a bitmap a token is drawing", async () => {
    coarse = true; // 16 MB: four 1024 bitmaps
    const keys: string[] = [];
    for (const tokenId of ["a", "b", "c", "d", "e", "f"]) {
      const job = input(1024, tokenId);
      const key = frameBakeKey(job);
      keys.push(key);
      requestFrameBitmap(key, job, vi.fn());
      reply(jobs().at(-1)!.jobId, 1024);
      await settle();
      if (tokenId === "a") retainFrameBitmap(key); // the first is on the map
    }
    expect(peekFrameBitmap(keys[0]!)).not.toBeNull(); // held: kept
    expect(peekFrameBitmap(keys[1]!)).toBeNull(); // the oldest unheld went
    expect(frameStatsSnapshot().cacheBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
  });
});
