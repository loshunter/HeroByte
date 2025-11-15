// ============================================================================
// DIRECT MESSAGE SERVICE CHARACTERIZATION TESTS
// ============================================================================
// These tests capture the CURRENT behavior of direct messaging before extraction
// Source: apps/server/src/ws/messageRouter.ts lines 851-856
// Target: apps/server/src/ws/services/DirectMessageService.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WebSocket } from "ws";
import type { ServerMessage } from "@shared";

/**
 * Mock WebSocket for testing
 */
function createMockWebSocket(readyState: number): WebSocket {
  const ws = {
    readyState,
    send: vi.fn(),
  } as unknown as WebSocket;
  return ws;
}

/**
 * Test helper to simulate the direct message service behavior
 */
class DirectMessageServiceSimulator {
  private uidToWs: Map<string, WebSocket>;

  constructor(uidToWs: Map<string, WebSocket>) {
    this.uidToWs = uidToWs;
  }

  /**
   * Simulates the current sendControlMessage() method from messageRouter.ts
   * Sends a control message to a specific client by UID
   */
  sendControlMessage(targetUid: string, message: ServerMessage): void {
    const ws = this.uidToWs.get(targetUid);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}

describe("DirectMessageService Characterization Tests", () => {
  let uidToWs: Map<string, WebSocket>;
  let simulator: DirectMessageServiceSimulator;

  beforeEach(() => {
    uidToWs = new Map();
    simulator = new DirectMessageServiceSimulator(uidToWs);
  });

  describe("Message Sending", () => {
    it("should send message to client with readyState 1 (OPEN)", () => {
      const mockWs = createMockWebSocket(1); // OPEN state
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      simulator.sendControlMessage("player-1", message);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("should serialize message to JSON string", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = {
        t: "elevate-to-dm",
        uid: "player-1",
      };
      simulator.sendControlMessage("player-1", message);

      const sentData = (mockWs.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentData).toBe('{"t":"elevate-to-dm","uid":"player-1"}');
    });

    it("should handle complex message structures", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("dm-1", mockWs);

      const message = {
        t: "state" as const,
        state: {
          players: [{ uid: "p1", name: "Alice" }],
          tokens: [{ id: "t1", owner: "p1", x: 10, y: 20 }],
        },
      };
      simulator.sendControlMessage("dm-1", message);

      const sentData = (mockWs.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(JSON.parse(sentData)).toEqual(message);
    });
  });

  describe("Client Lookup", () => {
    it("should not send message if client UID not found in map", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };
      simulator.sendControlMessage("player-2", message); // Different UID

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("should handle empty uidToWs map gracefully", () => {
      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Should not throw error
      expect(() => {
        simulator.sendControlMessage("player-1", message);
      }).not.toThrow();
    });
  });

  describe("WebSocket ReadyState Checks", () => {
    it("should not send if readyState is 0 (CONNECTING)", () => {
      const mockWs = createMockWebSocket(0); // CONNECTING
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      simulator.sendControlMessage("player-1", message);

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("should not send if readyState is 2 (CLOSING)", () => {
      const mockWs = createMockWebSocket(2); // CLOSING
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      simulator.sendControlMessage("player-1", message);

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("should not send if readyState is 3 (CLOSED)", () => {
      const mockWs = createMockWebSocket(3); // CLOSED
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      simulator.sendControlMessage("player-1", message);

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("should only send when readyState is exactly 1", () => {
      const testCases = [
        { readyState: 0, shouldSend: false },
        { readyState: 1, shouldSend: true },
        { readyState: 2, shouldSend: false },
        { readyState: 3, shouldSend: false },
      ];

      testCases.forEach(({ readyState, shouldSend }) => {
        const mockWs = createMockWebSocket(readyState);
        uidToWs.set(`player-${readyState}`, mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: `player-${readyState}` };
        simulator.sendControlMessage(`player-${readyState}`, message);

        if (shouldSend) {
          expect(mockWs.send).toHaveBeenCalledTimes(1);
        } else {
          expect(mockWs.send).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe("Multiple Clients", () => {
    it("should send to correct client when multiple clients exist", () => {
      const mockWs1 = createMockWebSocket(1);
      const mockWs2 = createMockWebSocket(1);
      const mockWs3 = createMockWebSocket(1);

      uidToWs.set("player-1", mockWs1);
      uidToWs.set("player-2", mockWs2);
      uidToWs.set("player-3", mockWs3);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };
      simulator.sendControlMessage("player-2", message);

      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalledTimes(1);
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it("should allow sending different messages to different clients", () => {
      const mockWs1 = createMockWebSocket(1);
      const mockWs2 = createMockWebSocket(1);

      uidToWs.set("player-1", mockWs1);
      uidToWs.set("player-2", mockWs2);

      const message1: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      const message2: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };

      simulator.sendControlMessage("player-1", message1);
      simulator.sendControlMessage("player-2", message2);

      expect(mockWs1.send).toHaveBeenCalledTimes(1);
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message1));
      expect(mockWs2.send).toHaveBeenCalledTimes(1);
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message2));
    });
  });

  describe("Edge Cases", () => {
    it("should handle null WebSocket in map", () => {
      uidToWs.set("player-1", null as unknown as WebSocket);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Should not throw error
      expect(() => {
        simulator.sendControlMessage("player-1", message);
      }).not.toThrow();
    });

    it("should handle undefined WebSocket in map", () => {
      uidToWs.set("player-1", undefined as unknown as WebSocket);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Should not throw error
      expect(() => {
        simulator.sendControlMessage("player-1", message);
      }).not.toThrow();
    });

    it("should handle empty string UID", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "" };
      simulator.sendControlMessage("", message);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it("should handle special characters in UID", () => {
      const mockWs = createMockWebSocket(1);
      const specialUid = "player-!@#$%^&*()_+{}[]|\\:;\"'<>?,./";
      uidToWs.set(specialUid, mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: specialUid };
      simulator.sendControlMessage(specialUid, message);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("Repeated Sends", () => {
    it("should allow sending multiple messages to same client", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      const message1: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      const message2: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      const message3: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      simulator.sendControlMessage("player-1", message1);
      simulator.sendControlMessage("player-1", message2);
      simulator.sendControlMessage("player-1", message3);

      expect(mockWs.send).toHaveBeenCalledTimes(3);
    });

    it("should send each message independently", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      const message1: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
      const message2: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };

      simulator.sendControlMessage("player-1", message1);
      simulator.sendControlMessage("player-1", message2);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message1));
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message2));
    });
  });
});
