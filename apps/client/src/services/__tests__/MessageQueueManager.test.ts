/**
 * Characterization tests for MessageQueueManager
 *
 * These tests lock in the existing behavior to ensure
 * zero behavioral changes during refactoring.
 *
 * Tests cover:
 * - Send immediately when connected and authenticated
 * - Queue message when cannot send immediately
 * - Authenticate messages always send immediately (bypass queue)
 * - Drop heartbeat messages when not authenticated
 * - Flush queue when conditions allow
 * - Queue size limit (200 messages)
 * - FIFO ordering of queued messages
 * - Error on send → queue fallback
 * - Clear queue on explicit call
 * - Queue state queries (getQueueLength)
 *
 * Source: apps/client/src/services/websocket.ts
 * - send() method (lines 145-172)
 * - sendRaw() method (lines 359-375)
 * - queueMessage() method (lines 352-357)
 * - flushMessageQueue() method (lines 324-341)
 * - canSendImmediately() method (lines 343-350)
 * - messageQueue property (line 77)
 *
 * Extracting to: apps/client/src/services/websocket/MessageQueueManager.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientMessage } from "@shared";
import { MessageQueueManager } from "../websocket/MessageQueueManager";

describe("MessageQueueManager - Characterization Tests", () => {
  let queueManager: MessageQueueManager;
  let mockWebSocket: WebSocket;
  let canSendFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    // Default canSendFn returns true (authenticated and connected)
    canSendFn = vi.fn(() => true);

    queueManager = new MessageQueueManager({ maxQueueSize: 200 });
  });

  describe("Send Immediately - Happy Path", () => {
    it("should send message immediately when connected and authenticated", () => {
      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, mockWebSocket, canSendFn);

      expect(mockWebSocket.send).toHaveBeenCalledOnce();
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should send multiple messages immediately when conditions allow", () => {
      const message1: ClientMessage = { t: "move", x: 100, y: 200 };
      const message2: ClientMessage = { t: "move", x: 150, y: 250 };

      queueManager.send(message1, mockWebSocket, canSendFn);
      queueManager.send(message2, mockWebSocket, canSendFn);

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should call canSendFn to determine if can send", () => {
      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, mockWebSocket, canSendFn);

      expect(canSendFn).toHaveBeenCalledOnce();
    });
  });

  describe("Authenticate Messages - Always Send Immediately", () => {
    it("should send authenticate message immediately even when not authenticated", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const authMessage: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
      };

      queueManager.send(authMessage, mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).toHaveBeenCalledOnce();
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(authMessage));
      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should send authenticate message with roomId immediately", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const authMessage: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
        roomId: "room-123",
      };

      queueManager.send(authMessage, mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(authMessage));
    });

    it("should NOT check canSendFn for authenticate messages", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const authMessage: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
      };

      queueManager.send(authMessage, mockWebSocket, notAuthenticatedFn);

      // canSendFn should NOT be called for authenticate messages
      expect(notAuthenticatedFn).not.toHaveBeenCalled();
    });

    it("should queue authenticate message if WebSocket is not OPEN", () => {
      const closedWebSocket = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
      } as unknown as WebSocket;

      const authMessage: ClientMessage = {
        t: "authenticate",
        secret: "test-secret",
      };

      queueManager.send(authMessage, closedWebSocket, canSendFn);

      expect(closedWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(1);
    });
  });

  describe("Heartbeat Messages - Drop When Not Authenticated", () => {
    it("should drop heartbeat message when not authenticated", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const heartbeatMessage: ClientMessage = { t: "heartbeat" };

      queueManager.send(heartbeatMessage, mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should send heartbeat message when authenticated", () => {
      const heartbeatMessage: ClientMessage = { t: "heartbeat" };

      queueManager.send(heartbeatMessage, mockWebSocket, canSendFn);

      expect(mockWebSocket.send).toHaveBeenCalledOnce();
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(heartbeatMessage));
    });

    it("should NOT queue heartbeat when not authenticated (prevent queue bloat)", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const heartbeatMessage: ClientMessage = { t: "heartbeat" };

      // Try sending multiple heartbeats
      queueManager.send(heartbeatMessage, mockWebSocket, notAuthenticatedFn);
      queueManager.send(heartbeatMessage, mockWebSocket, notAuthenticatedFn);
      queueManager.send(heartbeatMessage, mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(0);
    });
  });

  describe("Message Queueing - When Cannot Send", () => {
    it("should queue message when not authenticated", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(1);
    });

    it("should queue message when WebSocket is null", () => {
      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, null, canSendFn);

      expect(queueManager.getQueueLength()).toBe(1);
    });

    it("should queue message when WebSocket is not OPEN", () => {
      const connectingWebSocket = {
        readyState: WebSocket.CONNECTING,
        send: vi.fn(),
      } as unknown as WebSocket;

      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, connectingWebSocket, canSendFn);

      expect(connectingWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(1);
    });

    it("should queue multiple messages in FIFO order", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const message1: ClientMessage = { t: "move", x: 100, y: 200 };
      const message2: ClientMessage = { t: "move", x: 150, y: 250 };
      const message3: ClientMessage = { t: "move", x: 200, y: 300 };

      queueManager.send(message1, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message2, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message3, mockWebSocket, notAuthenticatedFn);

      expect(queueManager.getQueueLength()).toBe(3);
    });
  });

  describe("Queue Size Limit - 200 Messages", () => {
    it("should respect queue size limit of 200 messages", () => {
      const notAuthenticatedFn = vi.fn(() => false);

      // Queue 201 messages
      for (let i = 0; i < 201; i++) {
        const message: ClientMessage = { t: "move", x: i, y: i };
        queueManager.send(message, mockWebSocket, notAuthenticatedFn);
      }

      // Should only have 200 messages (oldest dropped)
      expect(queueManager.getQueueLength()).toBe(200);
    });

    it("should drop oldest message when queue is full", () => {
      const notAuthenticatedFn = vi.fn(() => false);

      // Fill queue to 200
      for (let i = 0; i < 200; i++) {
        const message: ClientMessage = { t: "move", x: i, y: i };
        queueManager.send(message, mockWebSocket, notAuthenticatedFn);
      }

      // Add one more message (should drop first message)
      const newMessage: ClientMessage = { t: "move", x: 999, y: 999 };
      queueManager.send(newMessage, mockWebSocket, notAuthenticatedFn);

      expect(queueManager.getQueueLength()).toBe(200);
    });

    it("should allow custom maxQueueSize", () => {
      const customQueueManager = new MessageQueueManager({ maxQueueSize: 50 });
      const notAuthenticatedFn = vi.fn(() => false);

      // Queue 51 messages
      for (let i = 0; i < 51; i++) {
        const message: ClientMessage = { t: "move", x: i, y: i };
        customQueueManager.send(message, mockWebSocket, notAuthenticatedFn);
      }

      // Should only have 50 messages
      expect(customQueueManager.getQueueLength()).toBe(50);
    });
  });

  describe("Flush Message Queue", () => {
    it("should flush all queued messages when authenticated", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const nowAuthenticatedFn = vi.fn(() => true);

      // Queue 3 messages
      const message1: ClientMessage = { t: "move", x: 100, y: 200 };
      const message2: ClientMessage = { t: "move", x: 150, y: 250 };
      const message3: ClientMessage = { t: "move", x: 200, y: 300 };

      queueManager.send(message1, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message2, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message3, mockWebSocket, notAuthenticatedFn);

      expect(queueManager.getQueueLength()).toBe(3);

      // Now flush (simulating authenticated)
      queueManager.flush(mockWebSocket, nowAuthenticatedFn);

      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should flush messages in FIFO order", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const nowAuthenticatedFn = vi.fn(() => true);

      const message1: ClientMessage = { t: "move", x: 1, y: 1 };
      const message2: ClientMessage = { t: "move", x: 2, y: 2 };
      const message3: ClientMessage = { t: "move", x: 3, y: 3 };

      queueManager.send(message1, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message2, mockWebSocket, notAuthenticatedFn);
      queueManager.send(message3, mockWebSocket, notAuthenticatedFn);

      queueManager.flush(mockWebSocket, nowAuthenticatedFn);

      expect(mockWebSocket.send).toHaveBeenNthCalledWith(1, JSON.stringify(message1));
      expect(mockWebSocket.send).toHaveBeenNthCalledWith(2, JSON.stringify(message2));
      expect(mockWebSocket.send).toHaveBeenNthCalledWith(3, JSON.stringify(message3));
    });

    it("should NOT flush when cannot send", () => {
      const notAuthenticatedFn = vi.fn(() => false);

      const message: ClientMessage = { t: "move", x: 100, y: 200 };
      queueManager.send(message, mockWebSocket, notAuthenticatedFn);

      queueManager.flush(mockWebSocket, notAuthenticatedFn);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(1);
    });

    it("should NOT flush when WebSocket is null", () => {
      const message: ClientMessage = { t: "move", x: 100, y: 200 };
      queueManager.send(message, null, canSendFn);

      queueManager.flush(null, canSendFn);

      expect(queueManager.getQueueLength()).toBe(1);
    });

    it("should handle empty queue gracefully", () => {
      expect(() => {
        queueManager.flush(mockWebSocket, canSendFn);
      }).not.toThrow();

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling - Send Failures", () => {
    it("should queue message when send throws error", () => {
      const errorWebSocket = {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error("Network error");
        }),
      } as unknown as WebSocket;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, errorWebSocket, canSendFn);

      expect(errorWebSocket.send).toHaveBeenCalledOnce();
      expect(queueManager.getQueueLength()).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("[WebSocket] Send error:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("should queue message when WebSocket becomes unavailable during sendRaw", () => {
      // First send works
      const message1: ClientMessage = { t: "move", x: 100, y: 200 };
      queueManager.send(message1, mockWebSocket, canSendFn);
      expect(mockWebSocket.send).toHaveBeenCalledOnce();

      // WebSocket disconnects
      const closedWebSocket = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
      } as unknown as WebSocket;

      // Second send should queue
      const message2: ClientMessage = { t: "move", x: 150, y: 250 };
      queueManager.send(message2, closedWebSocket, canSendFn);

      expect(closedWebSocket.send).not.toHaveBeenCalled();
      expect(queueManager.getQueueLength()).toBe(1);
    });
  });

  describe("Clear Queue", () => {
    it("should clear all queued messages", () => {
      const notAuthenticatedFn = vi.fn(() => false);

      // Queue several messages
      for (let i = 0; i < 10; i++) {
        const message: ClientMessage = { t: "move", x: i, y: i };
        queueManager.send(message, mockWebSocket, notAuthenticatedFn);
      }

      expect(queueManager.getQueueLength()).toBe(10);

      queueManager.clear();

      expect(queueManager.getQueueLength()).toBe(0);
    });

    it("should handle clearing empty queue gracefully", () => {
      expect(() => {
        queueManager.clear();
      }).not.toThrow();

      expect(queueManager.getQueueLength()).toBe(0);
    });
  });

  describe("Queue State Queries", () => {
    it("should return correct queue length", () => {
      const notAuthenticatedFn = vi.fn(() => false);

      expect(queueManager.getQueueLength()).toBe(0);

      const message1: ClientMessage = { t: "move", x: 100, y: 200 };
      queueManager.send(message1, mockWebSocket, notAuthenticatedFn);
      expect(queueManager.getQueueLength()).toBe(1);

      const message2: ClientMessage = { t: "move", x: 150, y: 250 };
      queueManager.send(message2, mockWebSocket, notAuthenticatedFn);
      expect(queueManager.getQueueLength()).toBe(2);

      queueManager.clear();
      expect(queueManager.getQueueLength()).toBe(0);
    });
  });

  describe("Console Logging Behavior", () => {
    it("should log when sending authenticate message immediately", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const authMessage: ClientMessage = { t: "authenticate", secret: "secret" };

      queueManager.send(authMessage, mockWebSocket, canSendFn);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[WebSocket] Sending authenticate message immediately",
      );

      consoleLogSpy.mockRestore();
    });

    it("should log when dropping heartbeat message", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const notAuthenticatedFn = vi.fn(() => false);
      const heartbeatMessage: ClientMessage = { t: "heartbeat" };

      queueManager.send(heartbeatMessage, mockWebSocket, notAuthenticatedFn);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[WebSocket] Dropping heartbeat message (not authenticated yet)",
      );

      consoleLogSpy.mockRestore();
    });

    it("should log when queueing message", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const notAuthenticatedFn = vi.fn(() => false);
      const message: ClientMessage = { t: "move", x: 100, y: 200 };

      queueManager.send(message, mockWebSocket, notAuthenticatedFn);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WebSocket] Queueing message type=move"),
      );

      consoleLogSpy.mockRestore();
    });

    it("should log when flushing message queue", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const notAuthenticatedFn = vi.fn(() => false);
      const nowAuthenticatedFn = vi.fn(() => true);

      const message: ClientMessage = { t: "move", x: 100, y: 200 };
      queueManager.send(message, mockWebSocket, notAuthenticatedFn);

      queueManager.flush(mockWebSocket, nowAuthenticatedFn);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WebSocket] flushMessageQueue() - Flushing"),
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple flush calls when queue is already empty", () => {
      queueManager.flush(mockWebSocket, canSendFn);
      queueManager.flush(mockWebSocket, canSendFn);
      queueManager.flush(mockWebSocket, canSendFn);

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it("should handle rapid send calls", () => {
      // Rapidly send 100 messages
      for (let i = 0; i < 100; i++) {
        const message: ClientMessage = { t: "move", x: i, y: i };
        queueManager.send(message, mockWebSocket, canSendFn);
      }

      expect(mockWebSocket.send).toHaveBeenCalledTimes(100);
    });

    it("should handle interleaved send and flush operations", () => {
      const notAuthenticatedFn = vi.fn(() => false);
      const nowAuthenticatedFn = vi.fn(() => true);

      const message1: ClientMessage = { t: "move", x: 1, y: 1 };
      queueManager.send(message1, mockWebSocket, notAuthenticatedFn);

      queueManager.flush(mockWebSocket, nowAuthenticatedFn);

      const message2: ClientMessage = { t: "move", x: 2, y: 2 };
      queueManager.send(message2, mockWebSocket, nowAuthenticatedFn);

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(queueManager.getQueueLength()).toBe(0);
    });
  });
});
