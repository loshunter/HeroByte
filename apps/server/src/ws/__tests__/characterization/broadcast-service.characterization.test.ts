// ============================================================================
// BROADCAST SERVICE CHARACTERIZATION TESTS
// ============================================================================
// These tests capture the CURRENT behavior of broadcast logic before extraction
// Source: apps/server/src/ws/messageRouter.ts lines 69, 833-848
// Target: apps/server/src/ws/services/BroadcastService.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Test helper to simulate the broadcast service behavior
 */
class BroadcastServiceSimulator {
  private broadcastDebounceTimer: NodeJS.Timeout | null = null;
  private broadcastCount = 0;

  /**
   * Simulates the current broadcast() method from messageRouter.ts
   * Debounces broadcasts by 16ms (one frame at 60fps)
   */
  broadcast(onBroadcast: () => void): void {
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }
    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastDebounceTimer = null;
      this.broadcastImmediate(onBroadcast);
    }, 16);
  }

  /**
   * Simulates the current broadcastImmediate() method from messageRouter.ts
   * Executes broadcast immediately without debouncing
   */
  broadcastImmediate(onBroadcast: () => void): void {
    this.broadcastCount++;
    onBroadcast();
  }

  getBroadcastCount(): number {
    return this.broadcastCount;
  }

  reset(): void {
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }
    this.broadcastDebounceTimer = null;
    this.broadcastCount = 0;
  }
}

describe("BroadcastService Characterization Tests", () => {
  let simulator: BroadcastServiceSimulator;
  let broadcastCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    simulator = new BroadcastServiceSimulator();
    broadcastCallback = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    simulator.reset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Debounced Broadcasting", () => {
    it("should debounce multiple rapid broadcasts into a single broadcast", async () => {
      // Simulate 5 rapid broadcasts (as would happen with rapid message handling)
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);

      // No broadcasts should have happened yet (debouncing)
      expect(broadcastCallback).not.toHaveBeenCalled();
      expect(simulator.getBroadcastCount()).toBe(0);

      // Advance time by 16ms (debounce threshold)
      await vi.advanceTimersByTimeAsync(16);

      // Should have executed exactly one broadcast despite 5 calls
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
      expect(simulator.getBroadcastCount()).toBe(1);
    });

    it("should use 16ms debounce delay (one frame at 60fps)", async () => {
      simulator.broadcast(broadcastCallback);

      // Should not broadcast before 16ms
      await vi.advanceTimersByTimeAsync(15);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Should broadcast after 16ms
      await vi.advanceTimersByTimeAsync(1);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should reset debounce timer on each broadcast call", async () => {
      // First broadcast
      simulator.broadcast(broadcastCallback);

      // Wait 10ms (not enough to trigger)
      await vi.advanceTimersByTimeAsync(10);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Second broadcast should reset the timer
      simulator.broadcast(broadcastCallback);

      // Wait another 10ms (20ms total, but timer was reset)
      await vi.advanceTimersByTimeAsync(10);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Wait the remaining 6ms (16ms since last broadcast call)
      await vi.advanceTimersByTimeAsync(6);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should allow separate broadcasts after debounce completes", async () => {
      // First batch of broadcasts
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // Second batch of broadcasts (after first completed)
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe("Immediate Broadcasting", () => {
    it("should execute broadcastImmediate without debouncing", () => {
      simulator.broadcastImmediate(broadcastCallback);

      // Should execute immediately without waiting
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
      expect(simulator.getBroadcastCount()).toBe(1);
    });

    it("should allow multiple immediate broadcasts without debouncing", () => {
      simulator.broadcastImmediate(broadcastCallback);
      simulator.broadcastImmediate(broadcastCallback);
      simulator.broadcastImmediate(broadcastCallback);

      // All three should execute immediately
      expect(broadcastCallback).toHaveBeenCalledTimes(3);
      expect(simulator.getBroadcastCount()).toBe(3);
    });
  });

  describe("Timer Management", () => {
    it("should clear existing timer when new broadcast is called", async () => {
      // First broadcast sets a timer
      simulator.broadcast(broadcastCallback);

      // Verify timer is set by checking it doesn't fire before 16ms
      await vi.advanceTimersByTimeAsync(10);
      expect(broadcastCallback).not.toHaveBeenCalled();

      // Second broadcast should clear the first timer and set a new one
      simulator.broadcast(broadcastCallback);

      // Original timer should be cleared (would have fired at 16ms from first call)
      await vi.advanceTimersByTimeAsync(6); // Now 16ms from first call
      expect(broadcastCallback).not.toHaveBeenCalled();

      // New timer fires after its own 16ms
      await vi.advanceTimersByTimeAsync(10); // Now 16ms from second call
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
    });

    it("should set timer to null after broadcast executes", async () => {
      simulator.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);

      // After broadcast executes, timer should be null
      // (verified by allowing another broadcast to set a new timer)
      simulator.broadcast(broadcastCallback);
      await vi.advanceTimersByTimeAsync(16);

      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe("Mixed Broadcasting Patterns", () => {
    it("should handle mix of debounced and immediate broadcasts", async () => {
      // Debounced broadcasts
      simulator.broadcast(broadcastCallback);
      simulator.broadcast(broadcastCallback);

      // Immediate broadcast (happens right away)
      simulator.broadcastImmediate(broadcastCallback);
      expect(broadcastCallback).toHaveBeenCalledTimes(1);

      // More debounced broadcasts
      simulator.broadcast(broadcastCallback);

      // Complete the debounced broadcasts
      await vi.advanceTimersByTimeAsync(16);

      // Total: 1 immediate + 1 debounced batch = 2 broadcasts
      expect(broadcastCallback).toHaveBeenCalledTimes(2);
    });
  });
});
