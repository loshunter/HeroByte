import { describe, expect, it, vi } from "vitest";
import { readCappedBody, uploadBucketKey } from "../uploadGuards.js";

/**
 * Build a ReadableStream that emits the given chunks then closes. The optional
 * onCancel spy lets a test prove the underlying source was actually cancelled
 * (i.e. the socket would be freed) rather than left to drain.
 */
function streamFrom(
  chunks: Uint8Array[],
  onCancel?: (reason?: unknown) => void,
): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
    cancel(reason) {
      onCancel?.(reason);
    },
  });
}

describe("readCappedBody", () => {
  it("returns the concatenated body when the total stays within the cap", async () => {
    const body = await readCappedBody(
      streamFrom([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
      10,
    );
    expect(body).not.toBeNull();
    expect([...body!]).toEqual([1, 2, 3, 4, 5]);
  });

  it("allows a body whose total is exactly the cap (boundary is inclusive)", async () => {
    const body = await readCappedBody(streamFrom([new Uint8Array(10)]), 10);
    expect(body).not.toBeNull();
    expect(body!.length).toBe(10);
  });

  it("aborts and cancels the stream the moment the running total exceeds the cap", async () => {
    const onCancel = vi.fn();
    // Two 8-byte chunks overrun a 10-byte cap on the second read.
    const body = await readCappedBody(
      streamFrom([new Uint8Array(8), new Uint8Array(8)], onCancel),
      10,
    );
    expect(body).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not trust chunk count — a single oversized chunk is still capped", async () => {
    const onCancel = vi.fn();
    const body = await readCappedBody(streamFrom([new Uint8Array(11)], onCancel), 10);
    expect(body).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("returns an empty buffer for a null body", async () => {
    const body = await readCappedBody(null, 10);
    expect(body).not.toBeNull();
    expect(body!.length).toBe(0);
  });
});

describe("uploadBucketKey", () => {
  it("maps identical secrets to the same bucket and distinct secrets apart", () => {
    expect(uploadBucketKey("Fun1")).toBe(uploadBucketKey("Fun1"));
    expect(uploadBucketKey("Fun1")).not.toBe(uploadBucketKey("room-a-secret"));
  });

  it("does not expose the raw secret as the key", () => {
    expect(uploadBucketKey("Fun1")).not.toContain("Fun1");
  });
});
