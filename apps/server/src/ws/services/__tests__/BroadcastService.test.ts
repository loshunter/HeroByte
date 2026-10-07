// ============================================================================
// BROADCAST SERVICE UNIT TESTS
// ============================================================================
// Comprehensive tests for BroadcastService
// Source: apps/server/src/ws/services/BroadcastService.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BroadcastService } from "../BroadcastService.js";

describe("BroadcastService", () => {
  let service: BroadcastService;
  let broadcastCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new BroadcastService();
    broadcastCallback = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create a new BroadcastService instance", () => {
      expect(service).toBeInstanceOf(BroadcastService);
    });
  });

  describe("broadcastImmediate", () => {
    it("should execute callback immediately without debouncing", () => {
      service.broadcastImmediate(broadcastCallback);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should execute callback immediately without waiting for timers", () => {
      service.broadcastImmediate(broadcastCallback);
      // Should execute before any timer advancement
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should allow multiple immediate broadcasts without debouncing", () => {
      service.broadcastImmediate(broadcastCallback);
      service.broadcastImmediate(broadcastCallback);
      service.broadcastImmediate(broadcastCallback);

      expect(broadcastCallback).toHaveBeenCalledTimes(3);
    });

    it("should invoke the callback with no arguments", () => {
      const callback = vi.fn();
      service.broadcastImmediate(callback);
      expect(callback).toHaveBeenCalledWith();
    });
  });

  describe("broadcast (debounced)", () => {
    it("should debounce multiple rapid broadcasts into a single broadcast", async () => {
      // Simulate 5 rapid broadcasts
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);

      // No broadcasts should have happened yet
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Advance time by 16ms (debounce threshold)
      await vi.advanceTimersByTimeAsync(16);

      // Should have executed exactly one broadcast
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should use 16ms debounce delay", async () => {
      service.broadcast(broadcastCallback);

      // Should not broadcast before 16ms
      await vi.advanceTimersByTimeAsync(15);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Should broadcast after 16ms
      await vi.advanceTimersByTimeAsync(1);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should reset debounce timer on each broadcast call", async () => {
      // First broadcast
      service.broadcast(broadcastCallback);

      // Wait 10ms (not enough to trigger)
      await vi.advanceTimersByTimeAsync(10);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Second broadcast should reset the timer
      service.broadcast(broadcastCallback);

      // Wait another 10ms (20ms total, but timer was reset)
      await vi.advanceTimersByTimeAsync(10);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Wait the remaining 6ms (16ms since last broadcast call)
      await vi.advanceTimersByTimeAsync(6);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should allow separate broadcasts after debounce completes", async () => {
      // First batch of broadcasts
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // Second batch of broadcasts
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });

    it("should invoke callback with no arguments when timer fires", async () => {
      const callback = vi.fn();
      service.broadcast(callback);
      await vi.advanceTimersByTimeAsync(16);
      expect(callback).toHaveBeenCalledWith();
    });
  });

  describe("Mixed Broadcasting", () => {
    it("should handle mix of debounced and immediate broadcasts", async () => {
      // Debounced broadcasts
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);

      // Immediate broadcast (happens right away)
      service.broadcastImmediate(broadcastCallback);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // More debounced broadcasts
      service.broadcast(broadcastCallback);

      // Complete the debounced broadcasts
      await vi.advanceTimersByTimeAsync(16);

      // Total: 1 immediate + 1 debounced batch = 2 broadcasts
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });

    it("should not interfere between immediate and debounced broadcasts", async () => {
      // Start debounced broadcast
      service.broadcast(broadcastCallback);

      // Execute immediate broadcast
      service.broadcastImmediate(broadcastCallback);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // Debounced broadcast should still fire after delay
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanup", () => {
    it("should clear pending broadcast timer", async () => {
      service.broadcast(broadcastCallback);

      // Cleanup before timer fires
      service.cleanup();

      // Advance time - broadcast should not fire
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).not.toHaveBeenCalled();
    });

    it("should allow cleanup to be called multiple times safely", () => {
      service.broadcast(broadcastCallback);
      service.cleanup();
      service.cleanup();
      service.cleanup();
      // Should not throw error
    });

    it("should allow cleanup when no timer is pending", () => {
      service.cleanup();
      // Should not throw error
    });

    it("should allow new broadcasts after cleanup", async () => {
      // Set up and cleanup first broadcast
      service.broadcast(broadcastCallback);
      service.cleanup();

      // New broadcast should work normally
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("High-Frequency Scenarios", () => {
    it("should handle 100 rapid broadcasts efficiently", async () => {
      // Simulate 100 rapid broadcasts (e.g., during rapid token dragging)
      for (let i = 0; i < 100; i++) {
        service.broadcast(broadcastCallback);
      }

      // Should still batch into single broadcast
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should handle interleaved broadcasts and timer completions", async () => {
      // First batch
      service.broadcast(broadcastCallback);
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // Second batch
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(8);
      service.broadcast(broadcastCallback); // Reset timer
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);

      // Third batch
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(3);
    });
  });

  describe("Max wait (a stream of calls cannot starve the room)", () => {
    // Drive the clock 1 ms at a time so each flush is stamped to the ms.
    async function runStream(intervalMs: number, durationMs: number, tailMs: number) {
      const calls: number[] = [];
      const flushes: number[] = [];
      let now = 0;
      const callback = () => flushes.push(now);
      for (let t = 0; t < durationMs + tailMs; t++) {
        if (t < durationMs && t % intervalMs === 0) {
          calls.push(t);
          service.broadcast(callback);
        }
        now = t + 1;
        await vi.advanceTimersByTimeAsync(1);
      }
      return { calls, flushes };
    }

    it("flushes every call within 50 ms while calls keep arriving 8 ms apart", async () => {
      // One client's mic meter at 120 Hz, or two speakers at 60 Hz: each call
      // lands inside the last one's 16 ms window. A debounce with no cap reset
      // its timer forever and nobody received a state update until it stopped.
      const { calls, flushes } = await runStream(8, 500, 200);

      for (const call of calls) {
        const flushed = flushes.find((flush) => flush > call);
        expect(flushed, `call at ${call} ms`).toBeDefined();
        expect(flushed! - call, `call at ${call} ms`).toBeLessThanOrEqual(50);
      }
      // Batched, still: nowhere near one flush per call.
      expect(flushes.length).toBeLessThanOrEqual(Math.ceil(500 / 50) + 1);
    });

    it("sends exactly one broadcast after the last call of a stream, and then stops", async () => {
      const { calls, flushes } = await runStream(8, 500, 200);
      const last = calls[calls.length - 1];

      const after = flushes.filter((flush) => flush > last);
      expect(after).toHaveLength(1);
      expect(after[0] - last).toBeLessThanOrEqual(16);
    });

    it("a single call still broadcasts once, 16 ms later, and the cap adds no second one", async () => {
      service.broadcast(broadcastCallback);

      await vi.advanceTimersByTimeAsync(15);
      expect(broadcastCallback).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("runs the latest callback when the cap fires", async () => {
      const first = vi.fn();
      const latest = vi.fn();
      service.broadcast(first);
      for (let t = 8; t <= 48; t += 8) {
        await vi.advanceTimersByTimeAsync(8);
        service.broadcast(latest);
      }
      await vi.advanceTimersByTimeAsync(2); // 50 ms after the first call

      expect(first).not.toHaveBeenCalled();
      expect(latest).toHaveBeenCalledTimes(1);
    });
  });

  describe("Callback Execution", () => {
    it("should execute different callbacks independently", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.broadcast(callback1);
      await vi.advanceTimersByTimeAsync(16);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      service.broadcast(callback2);
      await vi.advanceTimersByTimeAsync(16);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle callback that throws error", async () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Broadcast failed");
      });

      service.broadcast(errorCallback);

      // Should throw when timer fires
      await expect(async () => {
        await vi.advanceTimersByTimeAsync(16);
      }).rejects.toThrow("Broadcast failed");
    });

    it("should execute callback with proper context", async () => {
      const callback = vi.fn();

      service.broadcast(callback);
      await vi.advanceTimersByTimeAsync(16);

      // Callback should execute
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle broadcast called exactly at 16ms intervals", async () => {
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });

    it("should handle very long delays between broadcasts", async () => {
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(1000); // 1 second
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(1000);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });

    it("should handle broadcast with cleanup in between", async () => {
      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(8);
      service.cleanup();

      service.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });
  });
});
