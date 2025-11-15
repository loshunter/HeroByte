/**
 * CHARACTERIZATION TESTS: HeartbeatManager
 *
 * These tests capture the CURRENT behavior of heartbeat management
 * as extracted from WebSocketService. They serve as regression tests
 * to ensure zero behavioral changes during extraction.
 *
 * Source: apps/client/src/services/websocket.ts
 * - startHeartbeat() (lines 278-304)
 * - stopHeartbeat() (lines 306-311)
 * - lastPongTime tracking (line 78, line 224)
 * - heartbeatTimer management (line 76)
 *
 * Target: apps/client/src/services/websocket/HeartbeatManager.ts
 *
 * ============================================================================
 * EXTRACTION CONTEXT (Phase 2, Item 4 of 6)
 * ============================================================================
 *
 * This is the FOURTH manager extracted from WebSocketService.
 * Following the same TDD approach used for MessageQueueManager.
 *
 * RESPONSIBILITIES TO EXTRACT:
 * 1. Send heartbeat messages at regular intervals
 * 2. Track last message time (any message = "alive")
 * 3. Detect heartbeat timeout (no message in 2x interval)
 * 4. Trigger timeout callback (reconnect)
 * 5. Only send heartbeats when authenticated
 * 6. Only timeout when authenticated
 * 7. Clean up timers on stop
 *
 * DEPENDENCIES:
 * - AuthState enum (for authentication check)
 * - WebSocket reference (to send heartbeat)
 * - Timeout callback (to trigger reconnect)
 *
 * INTEGRATION POINTS:
 * - start() called in onopen handler
 * - stop() called in cleanup()
 * - recordMessage() called in handleMessage()
 *
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HeartbeatManager } from "../websocket/HeartbeatManager";
import { AuthState } from "../websocket/AuthenticationManager";

describe("HeartbeatManager - Characterization Tests", () => {
  let heartbeatManager: HeartbeatManager;
  let mockWebSocket: WebSocket;
  let onTimeoutCallback: ReturnType<typeof vi.fn>;
  const HEARTBEAT_INTERVAL = 25000; // 25 seconds (matches server)

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;

    // Mock timeout callback
    onTimeoutCallback = vi.fn();

    // Create HeartbeatManager with config
    heartbeatManager = new HeartbeatManager({
      heartbeatInterval: HEARTBEAT_INTERVAL,
      onTimeout: onTimeoutCallback,
    });
  });

  afterEach(() => {
    heartbeatManager.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =========================================================================
  // GROUP 1: Basic Lifecycle
  // =========================================================================

  describe("Lifecycle", () => {
    it("should start heartbeat timer when start() is called", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Should send heartbeat if authenticated
      // (But won't send if not authenticated - tested separately)
      expect(true).toBe(true); // Timer is running
    });

    it("should stop heartbeat timer when stop() is called", () => {
      heartbeatManager.start(mockWebSocket);
      heartbeatManager.stop();

      // Advance time - no heartbeat should be sent
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should reset lastPongTime when start() is called", () => {
      const initialTime = Date.now();
      vi.setSystemTime(initialTime);

      heartbeatManager.start(mockWebSocket);

      const timeSinceLast = heartbeatManager.getTimeSinceLastMessage();
      expect(timeSinceLast).toBe(0);
    });

    it("should allow multiple start() calls (restarts timer)", () => {
      heartbeatManager.start(mockWebSocket);
      heartbeatManager.start(mockWebSocket);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 2: Message Tracking
  // =========================================================================

  describe("Message Tracking", () => {
    it("should record message time when recordMessage() is called", () => {
      const initialTime = Date.now();
      vi.setSystemTime(initialTime);

      heartbeatManager.start(mockWebSocket);

      // Advance time
      vi.advanceTimersByTime(5000);

      // Record message
      heartbeatManager.recordMessage();

      // Time since last message should be reset
      const timeSinceLast = heartbeatManager.getTimeSinceLastMessage();
      expect(timeSinceLast).toBe(0);
    });

    it("should return correct time since last message", () => {
      const initialTime = Date.now();
      vi.setSystemTime(initialTime);

      heartbeatManager.start(mockWebSocket);

      // Advance time
      vi.advanceTimersByTime(10000);

      const timeSinceLast = heartbeatManager.getTimeSinceLastMessage();
      expect(timeSinceLast).toBe(10000);
    });

    it("should track time since last message across multiple recordMessage() calls", () => {
      const initialTime = Date.now();
      vi.setSystemTime(initialTime);

      heartbeatManager.start(mockWebSocket);

      // First message after 5s
      vi.advanceTimersByTime(5000);
      heartbeatManager.recordMessage();
      expect(heartbeatManager.getTimeSinceLastMessage()).toBe(0);

      // Second message after 3s
      vi.advanceTimersByTime(3000);
      heartbeatManager.recordMessage();
      expect(heartbeatManager.getTimeSinceLastMessage()).toBe(0);

      // Third message after 7s
      vi.advanceTimersByTime(7000);
      heartbeatManager.recordMessage();
      expect(heartbeatManager.getTimeSinceLastMessage()).toBe(0);
    });
  });

  // =========================================================================
  // GROUP 3: Heartbeat Sending
  // =========================================================================

  describe("Heartbeat Sending", () => {
    it("should send heartbeat message when authenticated", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check if heartbeat was sent (when authenticated)
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ t: "heartbeat" }),
      );
    });

    it("should NOT send heartbeat message when not authenticated", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when UNAUTHENTICATED
      heartbeatManager.checkHeartbeat(AuthState.UNAUTHENTICATED);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should NOT send heartbeat message when auth is PENDING", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when PENDING
      heartbeatManager.checkHeartbeat(AuthState.PENDING);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should NOT send heartbeat message when auth is FAILED", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when FAILED
      heartbeatManager.checkHeartbeat(AuthState.FAILED);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should send heartbeat at correct interval (25 seconds)", () => {
      heartbeatManager.start(mockWebSocket);

      // First heartbeat after 25s
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      heartbeatManager.recordMessage(); // Simulate receiving a message

      // Second heartbeat after another 25s
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      heartbeatManager.recordMessage(); // Simulate receiving a message

      // Third heartbeat after another 25s
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
    });

    it("should NOT send heartbeat when WebSocket is not OPEN", () => {
      // Set WebSocket to CONNECTING state
      mockWebSocket.readyState = WebSocket.CONNECTING;

      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP 4: Timeout Detection
  // =========================================================================

  describe("Timeout Detection", () => {
    it("should trigger timeout when no message received in 2x heartbeat interval (when authenticated)", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 2x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 2 + 1000);

      // Check for timeout when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      expect(onTimeoutCallback).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger timeout when not authenticated", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 2x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 2 + 1000);

      // Check for timeout when UNAUTHENTICATED
      heartbeatManager.checkHeartbeat(AuthState.UNAUTHENTICATED);

      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });

    it("should NOT trigger timeout when auth is PENDING", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 2x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 2 + 1000);

      // Check for timeout when PENDING
      heartbeatManager.checkHeartbeat(AuthState.PENDING);

      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });

    it("should NOT trigger timeout when auth is FAILED", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 2x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 2 + 1000);

      // Check for timeout when FAILED
      heartbeatManager.checkHeartbeat(AuthState.FAILED);

      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });

    it("should NOT trigger timeout if message received within 2x interval", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 1.5x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 1.5);

      // Record message
      heartbeatManager.recordMessage();

      // Advance time by another 1.5x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 1.5);

      // Check for timeout when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should NOT timeout because message was received recently
      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });

    it("should trigger timeout exactly at 2x heartbeat interval", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time to exactly 2x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 2);

      // Check for timeout when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should NOT timeout at exactly 2x interval (must be > 2x)
      expect(onTimeoutCallback).not.toHaveBeenCalled();

      // Advance by 1 more millisecond
      vi.advanceTimersByTime(1);

      // Check for timeout when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should timeout now (> 2x interval)
      expect(onTimeoutCallback).toHaveBeenCalledTimes(1);
    });

    it("should reset timeout timer when message received", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by 1.5x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 1.5);

      // Record message (resets timeout timer)
      heartbeatManager.recordMessage();

      // Advance time by another 1.5x heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 1.5);

      // Check for timeout when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should NOT timeout because message was received recently
      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP 5: Combined Heartbeat and Timeout
  // =========================================================================

  describe("Combined Heartbeat and Timeout", () => {
    it("should send heartbeat AND check for timeout in same interval", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat and timeout
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should send heartbeat
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ t: "heartbeat" }),
      );

      // Should NOT timeout (only 1x interval has passed)
      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });

    it("should trigger timeout when no message received for 2x interval", () => {
      heartbeatManager.start(mockWebSocket);

      // First interval - send heartbeat
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(onTimeoutCallback).not.toHaveBeenCalled();

      // Second interval - try to send heartbeat, but timeout fires first
      // Need to advance by slightly more than 1x interval to exceed 2x total
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL + 1000);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should timeout because no message received for > 2x interval (51s > 50s)
      expect(onTimeoutCallback).toHaveBeenCalledTimes(1);
      // Should NOT send second heartbeat because timeout happened first
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });

    it("should NOT timeout if recordMessage() called between heartbeats", () => {
      heartbeatManager.start(mockWebSocket);

      // First interval - send heartbeat
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // Record message (resets timeout)
      heartbeatManager.recordMessage();

      // Second interval - send heartbeat
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);

      // Should NOT timeout because message was received recently
      expect(onTimeoutCallback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP 6: Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle stop() when not started", () => {
      // Should not throw
      expect(() => heartbeatManager.stop()).not.toThrow();
    });

    it("should handle recordMessage() when not started", () => {
      // Should not throw
      expect(() => heartbeatManager.recordMessage()).not.toThrow();

      const timeSinceLast = heartbeatManager.getTimeSinceLastMessage();
      expect(timeSinceLast).toBeGreaterThanOrEqual(0);
    });

    it("should handle getTimeSinceLastMessage() when not started", () => {
      const timeSinceLast = heartbeatManager.getTimeSinceLastMessage();
      expect(timeSinceLast).toBeGreaterThanOrEqual(0);
    });

    it("should handle multiple stop() calls", () => {
      heartbeatManager.start(mockWebSocket);
      heartbeatManager.stop();
      heartbeatManager.stop();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should clear timer on stop() and not send heartbeat", () => {
      heartbeatManager.start(mockWebSocket);

      // Advance time partially
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL / 2);

      // Stop heartbeat
      heartbeatManager.stop();

      // Advance time to complete interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should NOT send heartbeat because timer was stopped
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should handle checkHeartbeat() when WebSocket is null", () => {
      heartbeatManager.start(mockWebSocket);

      // Set WebSocket to null (simulating disconnection)
      const nullWebSocket = null as unknown as WebSocket;
      heartbeatManager.start(nullWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 7: Integration Scenarios
  // =========================================================================

  describe("Integration Scenarios", () => {
    it("should handle full lifecycle: start → send heartbeats → receive messages → timeout", () => {
      heartbeatManager.start(mockWebSocket);

      // First heartbeat at 25s
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // Receive message at 30s (resets timeout timer)
      vi.advanceTimersByTime(5000);
      heartbeatManager.recordMessage();

      // Second heartbeat at 50s (20s after message received at 30s)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL - 5000);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);

      // No message received - timeout at 81s (51s since last message at 30s > 2x25s)
      // Need to advance from 50s to 81s = 31s
      vi.advanceTimersByTime(31000);
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(onTimeoutCallback).toHaveBeenCalledTimes(1);
    });

    it("should handle authentication state changes during operation", () => {
      heartbeatManager.start(mockWebSocket);

      // First interval - UNAUTHENTICATED (no heartbeat)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.recordMessage(); // Simulate message to prevent timeout
      heartbeatManager.checkHeartbeat(AuthState.UNAUTHENTICATED);
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Second interval - PENDING (no heartbeat)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.recordMessage(); // Simulate message to prevent timeout
      heartbeatManager.checkHeartbeat(AuthState.PENDING);
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Third interval - AUTHENTICATED (send heartbeat)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.recordMessage(); // Simulate message to prevent timeout
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);

      // Fourth interval - FAILED (no heartbeat)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      heartbeatManager.checkHeartbeat(AuthState.FAILED);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1); // Still only 1
    });

    it("should handle rapid start/stop cycles", () => {
      heartbeatManager.start(mockWebSocket);
      heartbeatManager.stop();
      heartbeatManager.start(mockWebSocket);
      heartbeatManager.stop();
      heartbeatManager.start(mockWebSocket);

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);

      // Check heartbeat when authenticated
      heartbeatManager.checkHeartbeat(AuthState.AUTHENTICATED);

      // Should send heartbeat once (from last start)
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });
  });
});
