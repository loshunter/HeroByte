// ============================================================================
// UPLOAD GUARDS — streaming body cap + per-credential rate-limit keying
// ============================================================================
// Defense-in-depth for POST /assets. Two independent protections that the
// route wires together:
//   1. readCappedBody never trusts the client's Content-Length as the size
//      cap — it counts bytes as they stream and aborts (cancelling the source,
//      so the socket is freed) the instant the running total overruns.
//   2. uploadBucketKey meters uploads per authenticated room credential, not
//      per IP: shared-NAT parties would collide on IP, and — because the
//      default password authenticates any uncustomized room — keying by the
//      x-herobyte-room header would let an attacker mint fresh buckets by
//      rotating the header. Keying by the (hashed) secret closes that.

import { createHash } from "node:crypto";
import { RateLimiter } from "../middleware/rateLimit.js";

/** Uploads allowed per credential per window. */
export const UPLOAD_RATE_MAX = 30;
/** Rate-limit window, in milliseconds. */
export const UPLOAD_RATE_WINDOW_MS = 60_000;

/**
 * A fixed-window limiter for POST /assets, keyed by credential. In-memory with
 * a periodic sweep is fine for the single-process server; a multi-process
 * deployment would swap this for a shared (e.g. Redis) store behind the same
 * check()/getStatus() shape.
 */
export function createUploadRateLimiter(): RateLimiter {
  return new RateLimiter({ maxMessages: UPLOAD_RATE_MAX, windowMs: UPLOAD_RATE_WINDOW_MS });
}

/**
 * Rate-limit bucket key for an accepted upload credential. Hashed so raw
 * secrets never sit in a Map (and cannot leak if the limiter is ever logged).
 * Distinct credentials get distinct buckets; the same credential — however the
 * room header is varied — always lands in one bucket.
 */
export function uploadBucketKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Read a request body into a Buffer, aborting the moment the running byte
 * total exceeds `cap`. The Content-Length header is never consulted here, so a
 * lying or absent header cannot smuggle an oversized upload past this guard.
 * On overrun the underlying stream is cancelled — which destroys the bridged
 * Node request stream, freeing the socket instead of leaving it to drain
 * (slowloris / oversized-body defense). Returns null when the body exceeds the
 * cap; a body exactly at the cap is allowed.
 */
export async function readCappedBody(
  stream: ReadableStream<Uint8Array> | null,
  cap: number,
): Promise<Buffer | null> {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel("upload exceeds the asset size limit");
        return null;
      }
      // Copy out of the view: the reader may reuse the backing buffer.
      chunks.push(Buffer.from(value));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released (e.g. after cancel) — nothing to do.
    }
  }
  return Buffer.concat(chunks, total);
}
