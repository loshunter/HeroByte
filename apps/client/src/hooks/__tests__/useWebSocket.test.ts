/**
 * Integration tests for useWebSocket hook
 *
 * Tests the WebSocket connection management hook, including:
 * - Connection lifecycle (connect, disconnect, reconnect)
 * - Authentication state management
 * - Message queueing and flushing
 * - Race condition fix: messages only sent after authentication
 * - RTC signal handling
 * - Server event handling
 *
 * Source: apps/client/src/hooks/useWebSocket.ts
 * Service: apps/client/src/services/websocket.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../useWebSocket";
import { ConnectionState, AuthState } from "../../services/websocket";
import type { RoomSnapshot, ClientMessage, ServerMessage } from "@shared";

// Global registry to access created WebSocket instances
let wsInstances: MockWebSocket[] = [];

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    wsInstances.push(this);
    // Simulate async connection - use real setTimeout for fake timers
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event("open"));
      }
    }, 10);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    setTimeout(() => {
      this.onclose?.(new CloseEvent("close", { code, reason }));
    }, 0);
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    wsInstances = [];
    vi.useFakeTimers();
    // Mock WebSocket globally
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    wsInstances = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Initial Connection", () => {
    it("should initialize with disconnected state", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: false,
        }),
      );

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.authState).toBe(AuthState.UNAUTHENTICATED);
      expect(result.current.snapshot).toBeNull();
    });

    it("should auto-connect when autoConnect is true", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      // Initially connecting
      expect(result.current.connectionState).toBe(ConnectionState.CONNECTING);

      // Wait for connection to open
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);
      expect(result.current.authState).toBe(AuthState.UNAUTHENTICATED);
    });

    it("should not auto-connect when autoConnect is false", () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: false,
        }),
      );

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe("Authentication Flow", () => {
    it("should transition through authentication states correctly", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      // Wait for connection
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.authState).toBe(AuthState.UNAUTHENTICATED);

      // Authenticate
      await act(async () => {
        result.current.authenticate("test-secret");
      });

      // Should be pending
      expect(result.current.authState).toBe(AuthState.PENDING);

      // Simulate auth-ok response
      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage({ t: "auth-ok" });
      });

      expect(result.current.authState).toBe(AuthState.AUTHENTICATED);
    });

    it("should handle authentication failure", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      await act(async () => {
        result.current.authenticate("wrong-secret");
      });

      expect(result.current.authState).toBe(AuthState.PENDING);

      // Simulate auth-failed response
      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage({ t: "auth-failed", reason: "Invalid credentials" });
      });

      expect(result.current.authState).toBe(AuthState.FAILED);
      expect(result.current.authError).toBe("Invalid credentials");
    });
  });

  describe("Message Queueing (Race Condition Fix)", () => {
    it("should queue messages sent before authentication", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      // Wait for connection
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Try to send a message before authentication
      const testMessage: ClientMessage = {
        t: "move",
        id: "token-1",
        x: 100,
        y: 200,
      };

      act(() => {
        result.current.send(testMessage);
      });

      // Message should be queued, not sent immediately
      const ws = wsInstances[0];
      const sentMessages = ws.sentMessages;
      const moveMessages = sentMessages.filter((msg: string) => msg.includes('"t":"move"'));
      expect(moveMessages.length).toBe(0);
    });

    it("should flush queued messages only after authentication succeeds", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Queue multiple messages before authentication
      const messages: ClientMessage[] = [
        { t: "move", id: "token-1", x: 100, y: 200 },
        { t: "recolor", id: "token-1", color: "red" },
      ];

      act(() => {
        messages.forEach((msg) => result.current.send(msg));
      });

      // Authenticate
      act(() => {
        result.current.authenticate("test-secret");
      });

      // Simulate auth-ok
      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage({ t: "auth-ok" });
        await vi.advanceTimersByTimeAsync(10);
      });

      // Now messages should be sent
      const ws = wsInstances[0];
      const sentMessages = ws.sentMessages;

      // Should have authenticate message + queued messages
      expect(sentMessages.length).toBeGreaterThanOrEqual(2);
    });

    it("should send messages immediately after authentication is complete", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Authenticate first
      act(() => {
        result.current.authenticate("test-secret");
      });

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage({ t: "auth-ok" });
        await vi.advanceTimersByTimeAsync(10);
      });

      const ws = wsInstances[0];
      const initialMessageCount = ws.sentMessages.length;

      // Send message after authentication
      act(() => {
        result.current.send({ t: "move", id: "token-1", x: 100, y: 200 });
      });

      // Should be sent immediately
      const finalMessageCount = ws.sentMessages.length;
      expect(finalMessageCount).toBeGreaterThan(initialMessageCount);
    });
  });

  describe("Snapshot Updates", () => {
    it("should update snapshot when receiving room state", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const mockSnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "test.png",
        players: [],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage(mockSnapshot);
      });

      expect(result.current.snapshot).toEqual(mockSnapshot);
    });
  });

  describe("RTC Signal Handling", () => {
    it("should call onRtcSignal callback when receiving RTC signals", async () => {
      const onRtcSignal = vi.fn();

      renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          onRtcSignal,
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const rtcSignal = {
        t: "rtc-signal",
        from: "peer-1",
        signal: { type: "offer", sdp: "test-sdp" },
      };

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage(rtcSignal);
      });

      expect(onRtcSignal).toHaveBeenCalledWith("peer-1", rtcSignal.signal);
    });

    it("should allow registering RTC handler after initialization", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const onRtcSignal = vi.fn();
      act(() => {
        result.current.registerRtcHandler(onRtcSignal);
      });

      const rtcSignal = {
        t: "rtc-signal",
        from: "peer-2",
        signal: { type: "answer", sdp: "test-sdp-2" },
      };

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage(rtcSignal);
      });

      expect(onRtcSignal).toHaveBeenCalledWith("peer-2", rtcSignal.signal);
    });
  });

  describe("Server Event Handling", () => {
    it("should call onControlMessage for control messages", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      const controlHandler = vi.fn();
      act(() => {
        result.current.registerServerEventHandler(controlHandler);
      });

      const controlMessage: ServerMessage = {
        t: "room-password-updated",
      };

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage(controlMessage);
      });

      expect(controlHandler).toHaveBeenCalledWith(controlMessage);
    });
  });

  describe("Connection Management", () => {
    it("should allow manual disconnect", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(result.current.authState).toBe(AuthState.UNAUTHENTICATED);
    });

    it("should allow manual reconnect after disconnect", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: false,
        }),
      );

      expect(result.current.connectionState).toBe(ConnectionState.DISCONNECTED);

      act(() => {
        result.current.connect();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(result.current.connectionState).toBe(ConnectionState.CONNECTED);
    });

    it("should cleanup on unmount", async () => {
      const { unmount } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Unmount should trigger cleanup
      unmount();

      // Timer should be cleared (no errors)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    });
  });

  describe("Race Condition Regression Tests", () => {
    it("should NOT send heartbeat messages before authentication", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Send heartbeat before auth
      act(() => {
        result.current.send({ t: "heartbeat" });
      });

      const ws = wsInstances[0];
      const sentMessages = ws.sentMessages;

      // Heartbeat should be dropped (not queued or sent)
      const heartbeats = sentMessages.filter((msg: string) => msg.includes('"t":"heartbeat"'));
      expect(heartbeats.length).toBe(0);
    });

    it("should handle reconnection without losing queued messages", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Queue a message
      act(() => {
        result.current.send({ t: "move", id: "token-1", x: 100, y: 200 });
      });

      // Simulate disconnection
      await act(async () => {
        const ws = wsInstances[0];
        ws.close();
        await vi.advanceTimersByTimeAsync(100);
      });

      // Reconnect should happen automatically
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000); // Wait for reconnect delay
      });

      // Authenticate after reconnect
      act(() => {
        result.current.authenticate("test-secret");
      });

      await act(async () => {
        const ws = wsInstances[1]; // Second WebSocket instance after reconnect
        ws.simulateMessage({ t: "auth-ok" });
        await vi.advanceTimersByTimeAsync(10);
      });

      // Original queued message should eventually be sent
      const ws = wsInstances[1];
      const sentMessages = ws.sentMessages;
      const hasMoveMessage = sentMessages.some((msg: string) => msg.includes('"t":"move"'));

      expect(hasMoveMessage).toBe(true);
    });

    it("should automatically reauthenticate after reconnect using cached credentials", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3001",
          uid: "test-user",
          autoConnect: true,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Authenticate once to cache credentials and reach authenticated state
      act(() => {
        result.current.authenticate("test-secret", "room-1");
      });

      await act(async () => {
        const ws = wsInstances[0];
        ws.simulateMessage({ t: "auth-ok" });
      });

      expect(result.current.authState).toBe(AuthState.AUTHENTICATED);

      // Simulate a network drop
      await act(async () => {
        const ws = wsInstances[0];
        ws.close(1006, "network error");
        await vi.advanceTimersByTimeAsync(0);
      });

      // Auth state should reset while connection manager prepares to reconnect
      expect(result.current.authState).toBe(AuthState.UNAUTHENTICATED);

      // Allow reconnection attempt and WebSocket open
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(20);
      });

      const ws = wsInstances[1];
      const authMessages = ws.sentMessages.filter((msg: string) =>
        msg.includes('"t":"authenticate"'),
      );

      expect(authMessages.length).toBeGreaterThan(0);
      expect(result.current.authState).toBe(AuthState.PENDING);
    });
  });
});
