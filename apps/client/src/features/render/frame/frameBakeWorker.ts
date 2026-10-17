// ============================================================================
// FRAME BAKE WORKER (C5a — never block the table)
// ============================================================================
// NOTE: no `/// <reference lib="webworker" />`, as terrainBakeWorker: the
// client compiles against lib.dom, so the worker-global touches go through
// narrow local types. Jobs run one per task, so a cancel posted for a job the
// table no longer wants (its token changed tier or frame first) lands before
// that job starts and the bake is skipped. The bytes go back as a transfer.
// The yield between jobs is a MessageChannel, not setTimeout: a hidden tab
// throttles a worker's timers to about one a second, which made every bake
// in a background tab wait seconds for its turn.

import { bakeFrame, type FrameBakeInput } from "@herobyte/shared";

export type FrameWorkerRequest = { jobId: number; input: FrameBakeInput } | { cancel: number };

export type FrameWorkerReply =
  | { jobId: number; pixels: ArrayBuffer; tier: number; ms: number }
  | { jobId: number; cancelled: true }
  | { jobId: number; error: string };

const queue: { jobId: number; input: FrameBakeInput }[] = [];
const cancelled = new Set<number>();
let draining = false;
const tick = new MessageChannel();
const nextTask = () => tick.port2.postMessage(0);

function post(reply: FrameWorkerReply, transfer: Transferable[] = []): void {
  (self as unknown as { postMessage(r: FrameWorkerReply, t: Transferable[]): void }).postMessage(
    reply,
    transfer,
  );
}

function drainOne(): void {
  const job = queue.shift();
  if (!job) {
    draining = false;
    return;
  }
  if (cancelled.delete(job.jobId)) {
    post({ jobId: job.jobId, cancelled: true });
  } else {
    try {
      const started = performance.now();
      const { pixels, tier } = bakeFrame(job.input);
      post(
        {
          jobId: job.jobId,
          pixels: pixels.buffer as ArrayBuffer,
          tier,
          ms: performance.now() - started,
        },
        [pixels.buffer as ArrayBuffer],
      );
    } catch (error) {
      post({ jobId: job.jobId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  // One job per task: a cancel or a newer job's message gets in between.
  nextTask();
}

tick.port1.onmessage = drainOne;

self.onmessage = (event: MessageEvent<FrameWorkerRequest>) => {
  const message = event.data;
  if ("cancel" in message) {
    cancelled.add(message.cancel);
    return;
  }
  queue.push(message);
  if (!draining) {
    draining = true;
    nextTask();
  }
};
