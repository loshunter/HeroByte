// ============================================================================
// FRAME BITMAP CACHE — bake once, draw everywhere (C5a)
// ============================================================================
// Frames are baked off the main thread (frameBakeWorker) and kept as bitmaps
// in an LRU keyed by everything the bake reads (frameBakeKey), so tokens with
// the same frame, colour and tier share one bitmap and a cache hit is one
// drawImage. The cache is capped by bytes: 48 MB, 16 MB on a coarse pointer.
// Several tokens wanting one key share one bake; a key nobody wants any more
// before its bake starts is cancelled. Without a Worker (tests, very old
// browsers) the same pure bake runs on a timer instead; without a bitmap API
// at all (jsdom) nothing is drawn over it: the token shows round, with no ring and no outline.
//
// The counts (bakes, cache bytes, entries) are on the dev seam as
// window.__HERO_BYTE_E2E__.frames, so a browser check can count re-bakes.

import { bakeFrame, type FrameBakeInput } from "@herobyte/shared";
import type { FrameWorkerReply, FrameWorkerRequest } from "./frameBakeWorker";
import { isCoarsePointer } from "./frameTier";

export type FrameBitmap = ImageBitmap | HTMLCanvasElement;

const MB = 1024 * 1024;
export const FRAME_CACHE_CAP = 48 * MB;
export const COARSE_FRAME_CACHE_CAP = 16 * MB;

interface Pending {
  jobId: number;
  input: FrameBakeInput;
  listeners: Set<() => void>;
}

export interface FrameStats {
  /** Bakes finished (worker and fallback). */
  bakes: number;
  workerBakes: number;
  syncBakes: number;
  cancelled: number;
  failed: number;
  /** The last and the slowest bake, in milliseconds, as the baker measured it. */
  lastBakeMs: number;
  maxBakeMs: number;
  cacheBytes: number;
  entries: number;
  cap: number;
}

const cache = new Map<string, { bitmap: FrameBitmap; bytes: number }>();
const pending = new Map<string, Pending>();
const keysByJob = new Map<number, string>();
/** How many tokens are drawing each key. */
const holds = new Map<string, number>();
let nextJobId = 1;
let cacheBytes = 0;
const stats: FrameStats = {
  bakes: 0,
  workerBakes: 0,
  syncBakes: 0,
  cancelled: 0,
  failed: 0,
  lastBakeMs: 0,
  maxBakeMs: 0,
  cacheBytes: 0,
  entries: 0,
  cap: FRAME_CACHE_CAP,
};

let worker: Worker | null = null;
let workerBroken = false;

function cap(): number {
  return isCoarsePointer() ? COARSE_FRAME_CACHE_CAP : FRAME_CACHE_CAP;
}

function publish(): void {
  stats.cacheBytes = cacheBytes;
  stats.entries = cache.size;
  stats.cap = cap();
  if (typeof window === "undefined" || import.meta.env.MODE === "production") return;
  const seam = window as typeof window & { __HERO_BYTE_E2E__?: Record<string, unknown> };
  seam.__HERO_BYTE_E2E__ = { ...(seam.__HERO_BYTE_E2E__ ?? {}), frames: { ...stats } };
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./frameBakeWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<FrameWorkerReply>) => onReply(event.data);
      worker.onerror = () => {
        // A worker that cannot load is terminal for the session: every bake
        // after this one takes the timer path, and the ones waiting restart there.
        workerBroken = true;
        worker?.terminate();
        worker = null;
        keysByJob.clear();
        for (const [key, job] of pending) bakeOnTimer(key, job);
      };
    } catch {
      workerBroken = true;
      worker = null;
    }
  }
  return worker;
}

async function toBitmap(pixels: Uint8ClampedArray, tier: number): Promise<FrameBitmap | null> {
  if (typeof ImageData === "undefined") return null;
  const image = new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), tier, tier);
  if (typeof createImageBitmap === "function") return createImageBitmap(image);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = tier;
  canvas.height = tier;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.putImageData(image, 0, 0);
  return canvas;
}

function store(key: string, bitmap: FrameBitmap, bytes: number): void {
  const previous = cache.get(key);
  if (previous) {
    // A second bake of a key (a late reply after a re-request) replaces, never adds.
    cache.delete(key);
    cacheBytes -= previous.bytes;
  }
  cache.set(key, { bitmap, bytes });
  cacheBytes += bytes;
  // Oldest first (a Map keeps insertion order; a hit re-inserts), never the
  // newest and never one a token is drawing: evicting that would only make it
  // bake again while the bitmap itself stays alive in the drawing.
  for (const [oldest, entry] of cache) {
    if (cacheBytes <= cap() || oldest === key) break;
    if ((holds.get(oldest) ?? 0) > 0) continue;
    cache.delete(oldest);
    cacheBytes -= entry.bytes;
  }
}

/** A bake is over, one way or the other: whoever waited is told, and the key may be asked again. */
function settle(key: string, waiting: Pending | undefined): void {
  if (pending.get(key) === waiting) pending.delete(key);
  publish();
  for (const listener of waiting?.listeners ?? []) listener();
}

async function finish(key: string, pixels: Uint8ClampedArray, tier: number, ms: number) {
  const waiting = pending.get(key);
  let bitmap: FrameBitmap | null = null;
  try {
    bitmap = await toBitmap(pixels, tier);
  } catch {
    bitmap = null; // a decode refused under memory pressure: the next ask bakes again
  }
  if (bitmap) {
    stats.bakes += 1;
    stats.lastBakeMs = ms;
    stats.maxBakeMs = Math.max(stats.maxBakeMs, ms);
    store(key, bitmap, tier * tier * 4);
  } else {
    stats.failed += 1;
  }
  settle(key, waiting);
}

function onReply(reply: FrameWorkerReply): void {
  const key = keysByJob.get(reply.jobId);
  keysByJob.delete(reply.jobId);
  if (key === undefined) return;
  if ("pixels" in reply) {
    if (cache.has(key)) {
      stats.cancelled += 1; // a duplicate of a bake that already landed
      const waiting = pending.get(key);
      if (waiting?.jobId === reply.jobId) settle(key, waiting); // its waiters have the bitmap now
      return;
    }
    stats.workerBakes += 1;
    void finish(key, new Uint8ClampedArray(reply.pixels), reply.tier, reply.ms);
    return;
  }
  if ("error" in reply) stats.failed += 1;
  else stats.cancelled += 1;
  const waiting = pending.get(key);
  if (waiting?.jobId === reply.jobId) settle(key, waiting);
  else publish();
}

/** The same pure bake on the main thread, one task later (no Worker, or it broke). */
function bakeOnTimer(key: string, job: Pending): void {
  setTimeout(() => {
    if (pending.get(key) !== job) return; // withdrawn before it started
    const started = performance.now();
    try {
      const { pixels, tier } = bakeFrame(job.input);
      stats.syncBakes += 1;
      void finish(key, pixels, tier, performance.now() - started);
    } catch {
      stats.failed += 1;
      settle(key, job);
    }
  }, 0);
}

/** The cached bitmap for `key`, or null; a hit counts as a use for the LRU. */
export function peekFrameBitmap(key: string): FrameBitmap | null {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry.bitmap;
}

/**
 * Asks for `key` to be baked from `input` (a bake already under way for it is
 * shared) and calls `onReady` when it lands. The returned function withdraws
 * the request; the last one withdrawn cancels a bake that has not started.
 */
export function requestFrameBitmap(
  key: string,
  input: FrameBakeInput,
  onReady: () => void,
): () => void {
  if (cache.has(key)) return () => {};
  let job = pending.get(key);
  if (!job) {
    job = { jobId: nextJobId++, input, listeners: new Set() };
    pending.set(key, job);
    const bakeWorker = getWorker();
    if (bakeWorker) {
      keysByJob.set(job.jobId, key);
      const request: FrameWorkerRequest = { jobId: job.jobId, input };
      bakeWorker.postMessage(request);
    } else {
      bakeOnTimer(key, job);
    }
  }
  const owned = job;
  owned.listeners.add(onReady);
  return () => {
    owned.listeners.delete(onReady);
    if (owned.listeners.size > 0 || pending.get(key) !== owned) return;
    pending.delete(key);
    if (keysByJob.has(owned.jobId)) {
      const cancel: FrameWorkerRequest = { cancel: owned.jobId };
      worker?.postMessage(cancel);
      keysByJob.delete(owned.jobId); // a reply that still comes is dropped
    }
  };
}

/** The cache's byte cap on this device (48 MB, 16 MB on a coarse pointer). */
export function frameCacheCap(): number {
  return cap();
}

/**
 * A token is drawing `key`: until the returned release, eviction passes it
 * over, so the cache's bytes are an honest count of what the table holds.
 */
export function retainFrameBitmap(key: string): () => void {
  holds.set(key, (holds.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (holds.get(key) ?? 1) - 1;
    if (count > 0) holds.set(key, count);
    else holds.delete(key);
  };
}

export function frameStatsSnapshot(): FrameStats {
  publish();
  return { ...stats };
}

/** Tests: an empty cache, fresh counts, and the worker forgotten. */
export function resetFrameBitmapCache(): void {
  cache.clear();
  pending.clear();
  keysByJob.clear();
  holds.clear();
  cacheBytes = 0;
  worker?.terminate();
  worker = null;
  workerBroken = false;
  Object.assign(stats, {
    bakes: 0,
    workerBakes: 0,
    syncBakes: 0,
    cancelled: 0,
    failed: 0,
    lastBakeMs: 0,
    maxBakeMs: 0,
  });
  publish();
}
