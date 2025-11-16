/**
 * Tests for useHeartbeat hook
 *
 * Tests the heartbeat hook that sends periodic heartbeat messages to the server
 * to prevent connection timeout.
 *
 * Test Coverage:
 * - Initial heartbeat sent immediately on mount/enable
 * - Periodic heartbeats sent at correct interval
 * - Heartbeats stop when enabled flag is false
 * - Interval cleanup on unmount
 * - Custom interval values work correctly
 * - Default interval (30000ms) is used when not specified
 * - Effect re-runs when dependencies change
 *
 * Source: apps/client/src/hooks/useHeartbeat.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ClientMessage } from "@shared";
import { useHeartbeat } from "../useHeartbeat";

describe("useHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =========================================================================
  // GROUP 1: Initial Heartbeat
  // =========================================================================

  describe("Initial Heartbeat", () => {
    it("should send initial heartbeat immediately on mount when enabled", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          enabled: true,
        }),
      );

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({ t: "heartbeat" });
    });

    it("should send initial heartbeat immediately with custom interval", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
          enabled: true,
        }),
      );

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({ t: "heartbeat" });
    });

    it("should NOT send initial heartbeat when enabled is false", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          enabled: false,
        }),
      );

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("should use default interval (30000ms) when not specified", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Advance by default interval
      vi.advanceTimersByTime(30000);

      // Should have sent second heartbeat at default interval
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // GROUP 2: Periodic Heartbeats
  // =========================================================================

  describe("Periodic Heartbeats", () => {
    it("should send heartbeats at correct interval (30000ms default)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval (30s)
      vi.advanceTimersByTime(30000);
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenLastCalledWith({ t: "heartbeat" });

      // Second interval (60s total)
      vi.advanceTimersByTime(30000);
      expect(sendMessage).toHaveBeenCalledTimes(3);
      expect(sendMessage).toHaveBeenLastCalledWith({ t: "heartbeat" });

      // Third interval (90s total)
      vi.advanceTimersByTime(30000);
      expect(sendMessage).toHaveBeenCalledTimes(4);
      expect(sendMessage).toHaveBeenLastCalledWith({ t: "heartbeat" });
    });

    it("should send heartbeats at custom interval (10000ms)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval (10s)
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Second interval (20s total)
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(3);

      // Third interval (30s total)
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(4);
    });

    it("should send heartbeats at custom interval (5000ms)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 5000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval (5s)
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Second interval (10s total)
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(3);
    });

    it("should NOT send heartbeat before interval completes", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Advance by less than interval
      vi.advanceTimersByTime(9999);
      expect(sendMessage).toHaveBeenCalledTimes(1); // Still only initial

      // Complete the interval
      vi.advanceTimersByTime(1);
      expect(sendMessage).toHaveBeenCalledTimes(2); // Now second heartbeat
    });
  });

  // =========================================================================
  // GROUP 3: Enabled Flag
  // =========================================================================

  describe("Enabled Flag", () => {
    it("should stop heartbeats when enabled changes to false", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
            enabled,
          }),
        {
          initialProps: { enabled: true },
        },
      );

      // Initial heartbeat when enabled=true
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Disable heartbeats
      sendMessage.mockClear();
      rerender({ enabled: false });

      // Advance time - should NOT send heartbeat
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();

      // Advance more time - still should NOT send
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("should resume heartbeats when enabled changes from false to true", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
            enabled,
          }),
        {
          initialProps: { enabled: false },
        },
      );

      // Should NOT send initial heartbeat when disabled
      expect(sendMessage).not.toHaveBeenCalled();

      // Advance time - still should NOT send
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();

      // Enable heartbeats
      rerender({ enabled: true });

      // Should send immediate heartbeat when enabled
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({ t: "heartbeat" });

      // Should continue periodic heartbeats
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    it("should default to enabled=true when not specified", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
        }),
      );

      // Should send initial heartbeat (enabled by default)
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Should send periodic heartbeats
      vi.advanceTimersByTime(30000);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // GROUP 4: Cleanup on Unmount
  // =========================================================================

  describe("Cleanup on Unmount", () => {
    it("should clear interval when component unmounts", () => {
      const sendMessage = vi.fn();

      const { unmount } = renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Unmount
      unmount();
      sendMessage.mockClear();

      // Advance time - should NOT send heartbeat after unmount
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();

      // Advance more time - still should NOT send
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("should handle unmount before first interval completes", () => {
      const sendMessage = vi.fn();

      const { unmount } = renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Advance partially through interval
      vi.advanceTimersByTime(5000);

      // Unmount mid-interval
      unmount();
      sendMessage.mockClear();

      // Complete the interval
      vi.advanceTimersByTime(5000);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("should cleanup when enabled changes to false", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
            enabled,
          }),
        {
          initialProps: { enabled: true },
        },
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });
      sendMessage.mockClear();

      // Old interval should be cleaned up
      vi.advanceTimersByTime(10000);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP 5: Dependency Changes
  // =========================================================================

  describe("Dependency Changes", () => {
    it("should restart interval when interval value changes", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ interval }: { interval: number }) =>
          useHeartbeat({
            sendMessage,
            interval,
          }),
        {
          initialProps: { interval: 10000 },
        },
      );

      // Initial heartbeat with 10s interval
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval at 10s
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Change interval to 5s
      sendMessage.mockClear();
      rerender({ interval: 5000 });

      // Should send immediate heartbeat when interval changes
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Should use new interval (5s)
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Old interval (10s) should not trigger
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(3); // At 10s total, should be 3rd heartbeat (0s, 5s, 10s)
    });

    it("should restart interval when sendMessage function changes", () => {
      const sendMessage1 = vi.fn();
      const sendMessage2 = vi.fn();

      const { rerender } = renderHook(
        ({ sendMessage }: { sendMessage: (msg: ClientMessage) => void }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
          }),
        {
          initialProps: { sendMessage: sendMessage1 },
        },
      );

      // Initial heartbeat with first function
      expect(sendMessage1).toHaveBeenCalledTimes(1);
      expect(sendMessage2).not.toHaveBeenCalled();

      // First interval
      vi.advanceTimersByTime(10000);
      expect(sendMessage1).toHaveBeenCalledTimes(2);
      expect(sendMessage2).not.toHaveBeenCalled();

      // Change sendMessage function
      rerender({ sendMessage: sendMessage2 });

      // Should send immediate heartbeat with new function
      expect(sendMessage2).toHaveBeenCalledTimes(1);

      // Should continue with new function
      vi.advanceTimersByTime(10000);
      expect(sendMessage2).toHaveBeenCalledTimes(2);
      expect(sendMessage1).toHaveBeenCalledTimes(2); // Should not increase
    });

    it("should handle all dependencies changing simultaneously", () => {
      const sendMessage1 = vi.fn();
      const sendMessage2 = vi.fn();

      const { rerender } = renderHook(
        ({
          sendMessage,
          interval,
          enabled,
        }: {
          sendMessage: (msg: ClientMessage) => void;
          interval: number;
          enabled: boolean;
        }) =>
          useHeartbeat({
            sendMessage,
            interval,
            enabled,
          }),
        {
          initialProps: {
            sendMessage: sendMessage1,
            interval: 10000,
            enabled: true,
          },
        },
      );

      // Initial state
      expect(sendMessage1).toHaveBeenCalledTimes(1);

      // Change all dependencies at once
      rerender({
        sendMessage: sendMessage2,
        interval: 5000,
        enabled: true,
      });

      // Should send immediate heartbeat with new configuration
      expect(sendMessage2).toHaveBeenCalledTimes(1);

      // Should use new interval
      vi.advanceTimersByTime(5000);
      expect(sendMessage2).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // GROUP 6: Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle very short interval (1ms)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 1,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval (1ms)
      vi.advanceTimersByTime(1);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Second interval (2ms total)
      vi.advanceTimersByTime(1);
      expect(sendMessage).toHaveBeenCalledTimes(3);
    });

    it("should handle very long interval (3600000ms = 1 hour)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 3600000,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Advance by less than interval
      vi.advanceTimersByTime(3599999);
      expect(sendMessage).toHaveBeenCalledTimes(1); // Still only initial

      // Complete the interval
      vi.advanceTimersByTime(1);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle interval=0 (immediate continuous heartbeats)", () => {
      const sendMessage = vi.fn();

      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 0,
        }),
      );

      // Initial heartbeat
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Interval of 0 should trigger immediately
      vi.advanceTimersByTime(0);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle rapid enable/disable toggling", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
            enabled,
          }),
        {
          initialProps: { enabled: true },
        },
      );

      expect(sendMessage).toHaveBeenCalledTimes(1);

      // Rapid toggling
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(sendMessage).toHaveBeenCalledTimes(2); // New initial heartbeat

      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(sendMessage).toHaveBeenCalledTimes(3); // Another initial heartbeat

      // Advance time
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(4); // Periodic heartbeat
    });

    it("should handle multiple mounts and unmounts", () => {
      const sendMessage = vi.fn();

      // First mount
      const { unmount: unmount1 } = renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      expect(sendMessage).toHaveBeenCalledTimes(1);
      unmount1();

      // Second mount
      const { unmount: unmount2 } = renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      expect(sendMessage).toHaveBeenCalledTimes(2);
      unmount2();

      // Third mount
      renderHook(() =>
        useHeartbeat({
          sendMessage,
          interval: 10000,
        }),
      );

      expect(sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // GROUP 7: Integration Scenarios
  // =========================================================================

  describe("Integration Scenarios", () => {
    it("should maintain correct timing across multiple lifecycle events", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useHeartbeat({
            sendMessage,
            interval: 10000,
            enabled,
          }),
        {
          initialProps: { enabled: true },
        },
      );

      // Initial: t=0s, count=1
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval: t=10s, count=2
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Disable at t=10s
      rerender({ enabled: false });

      // Advance time while disabled: t=30s, count=2 (no change)
      vi.advanceTimersByTime(20000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Re-enable at t=30s: immediate heartbeat, count=3
      rerender({ enabled: true });
      expect(sendMessage).toHaveBeenCalledTimes(3);

      // Next interval: t=40s, count=4
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(4);

      // Another interval: t=50s, count=5
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(5);
    });

    it("should handle changing interval mid-operation", () => {
      const sendMessage = vi.fn();

      const { rerender } = renderHook(
        ({ interval }: { interval: number }) =>
          useHeartbeat({
            sendMessage,
            interval,
          }),
        {
          initialProps: { interval: 20000 },
        },
      );

      // Initial: t=0s, count=1
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // First interval at 20s: t=20s, count=2
      vi.advanceTimersByTime(20000);
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Change to 5s interval at t=20s: immediate heartbeat, count=3
      rerender({ interval: 5000 });
      expect(sendMessage).toHaveBeenCalledTimes(3);

      // New interval: t=25s, count=4
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(4);

      // New interval: t=30s, count=5
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(5);

      // Change back to 20s: immediate heartbeat, count=6
      rerender({ interval: 20000 });
      expect(sendMessage).toHaveBeenCalledTimes(6);

      // New interval: t=50s, count=7
      vi.advanceTimersByTime(20000);
      expect(sendMessage).toHaveBeenCalledTimes(7);
    });

    it("should correctly handle complex sequence of operations", () => {
      const sendMessage = vi.fn();

      const { rerender, unmount } = renderHook(
        ({ enabled, interval }: { enabled: boolean; interval: number }) =>
          useHeartbeat({
            sendMessage,
            enabled,
            interval,
          }),
        {
          initialProps: { enabled: true, interval: 10000 },
        },
      );

      // t=0s: Initial heartbeat (count=1)
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // t=5s: Disable mid-interval
      vi.advanceTimersByTime(5000);
      rerender({ enabled: false, interval: 10000 });

      // t=15s: Still disabled, no heartbeats
      vi.advanceTimersByTime(10000);
      expect(sendMessage).toHaveBeenCalledTimes(1);

      // t=15s: Re-enable with new interval (count=2)
      rerender({ enabled: true, interval: 5000 });
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // t=20s: First heartbeat with 5s interval (count=3)
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(3);

      // t=25s: Second heartbeat with 5s interval (count=4)
      vi.advanceTimersByTime(5000);
      expect(sendMessage).toHaveBeenCalledTimes(4);

      // t=25s: Change interval to 15s (count=5)
      rerender({ enabled: true, interval: 15000 });
      expect(sendMessage).toHaveBeenCalledTimes(5);

      // t=40s: First heartbeat with 15s interval (count=6)
      vi.advanceTimersByTime(15000);
      expect(sendMessage).toHaveBeenCalledTimes(6);

      // Unmount
      unmount();
      sendMessage.mockClear();

      // t=60s: No heartbeats after unmount
      vi.advanceTimersByTime(20000);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
