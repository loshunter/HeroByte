// ============================================================================
// DIRECT MESSAGE SERVICE UNIT TESTS
// ============================================================================
// Comprehensive tests for DirectMessageService
// Source: apps/server/src/ws/services/DirectMessageService.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WebSocket } from "ws";
import type { ServerMessage } from "@shared";
import { DirectMessageService } from "../DirectMessageService.js";

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

describe("DirectMessageService", () => {
  let uidToWs: Map<string, WebSocket>;
  let service: DirectMessageService;

  beforeEach(() => {
    uidToWs = new Map();
    service = new DirectMessageService(uidToWs);
  });

  describe("Constructor", () => {
    it("should create a new DirectMessageService instance", () => {
      expect(service).toBeInstanceOf(DirectMessageService);
    });

    it("should accept uidToWs map in constructor", () => {
      const map = new Map<string, WebSocket>();
      const newService = new DirectMessageService(map);
      expect(newService).toBeInstanceOf(DirectMessageService);
    });
  });

  describe("sendControlMessage", () => {
    describe("Successful Message Sending", () => {
      it("should send message to client with readyState 1 (OPEN)", () => {
        const mockWs = createMockWebSocket(1);
        uidToWs.set("player-1", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
        service.sendControlMessage("player-1", message);

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
        service.sendControlMessage("player-1", message);

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
        service.sendControlMessage("dm-1", message);

        const sentData = (mockWs.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(JSON.parse(sentData)).toEqual(message);
      });

      it("should handle messages with special characters", () => {
        const mockWs = createMockWebSocket(1);
        uidToWs.set("player-1", mockWs);

        const message = {
          t: "state" as const,
          state: {
            text: 'Special chars: "quotes", \\backslash, \n newline, \t tab',
          },
        };
        service.sendControlMessage("player-1", message);

        const sentData = (mockWs.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(JSON.parse(sentData)).toEqual(message);
      });
    });

    describe("Client Lookup", () => {
      it("should not send message if client UID not found in map", () => {
        const mockWs = createMockWebSocket(1);
        uidToWs.set("player-1", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };
        service.sendControlMessage("player-2", message);

        expect(mockWs.send).not.toHaveBeenCalled();
      });

      it("should handle empty uidToWs map gracefully", () => {
        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

        expect(() => {
          service.sendControlMessage("player-1", message);
        }).not.toThrow();
      });

      it("should handle undefined UID lookup gracefully", () => {
        const message: ServerMessage = { t: "elevate-to-dm", uid: "nonexistent" };

        expect(() => {
          service.sendControlMessage("nonexistent", message);
        }).not.toThrow();
      });
    });

    describe("WebSocket ReadyState Checks", () => {
      it("should not send if readyState is 0 (CONNECTING)", () => {
        const mockWs = createMockWebSocket(0);
        uidToWs.set("player-1", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
        service.sendControlMessage("player-1", message);

        expect(mockWs.send).not.toHaveBeenCalled();
      });

      it("should not send if readyState is 2 (CLOSING)", () => {
        const mockWs = createMockWebSocket(2);
        uidToWs.set("player-1", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
        service.sendControlMessage("player-1", message);

        expect(mockWs.send).not.toHaveBeenCalled();
      });

      it("should not send if readyState is 3 (CLOSED)", () => {
        const mockWs = createMockWebSocket(3);
        uidToWs.set("player-1", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
        service.sendControlMessage("player-1", message);

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
          service.sendControlMessage(`player-${readyState}`, message);

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
        service.sendControlMessage("player-2", message);

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

        service.sendControlMessage("player-1", message1);
        service.sendControlMessage("player-2", message2);

        expect(mockWs1.send).toHaveBeenCalledTimes(1);
        expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message1));
        expect(mockWs2.send).toHaveBeenCalledTimes(1);
        expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message2));
      });

      it("should send to only OPEN clients when mix of states exists", () => {
        const mockWsConnecting = createMockWebSocket(0);
        const mockWsOpen = createMockWebSocket(1);
        const mockWsClosed = createMockWebSocket(3);

        uidToWs.set("connecting", mockWsConnecting);
        uidToWs.set("open", mockWsOpen);
        uidToWs.set("closed", mockWsClosed);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "test" };

        service.sendControlMessage("connecting", message);
        service.sendControlMessage("open", message);
        service.sendControlMessage("closed", message);

        expect(mockWsConnecting.send).not.toHaveBeenCalled();
        expect(mockWsOpen.send).toHaveBeenCalledTimes(1);
        expect(mockWsClosed.send).not.toHaveBeenCalled();
      });
    });

    describe("Edge Cases", () => {
      it("should handle null WebSocket in map", () => {
        uidToWs.set("player-1", null as unknown as WebSocket);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

        expect(() => {
          service.sendControlMessage("player-1", message);
        }).not.toThrow();
      });

      it("should handle undefined WebSocket in map", () => {
        uidToWs.set("player-1", undefined as unknown as WebSocket);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

        expect(() => {
          service.sendControlMessage("player-1", message);
        }).not.toThrow();
      });

      it("should handle empty string UID", () => {
        const mockWs = createMockWebSocket(1);
        uidToWs.set("", mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: "" };
        service.sendControlMessage("", message);

        expect(mockWs.send).toHaveBeenCalledTimes(1);
      });

      it("should handle special characters in UID", () => {
        const mockWs = createMockWebSocket(1);
        const specialUid = "player-!@#$%^&*()_+{}[]|\\:;\"'<>?,./";
        uidToWs.set(specialUid, mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: specialUid };
        service.sendControlMessage(specialUid, message);

        expect(mockWs.send).toHaveBeenCalledTimes(1);
      });

      it("should handle very long UID strings", () => {
        const mockWs = createMockWebSocket(1);
        const longUid = "a".repeat(1000);
        uidToWs.set(longUid, mockWs);

        const message: ServerMessage = { t: "elevate-to-dm", uid: longUid };
        service.sendControlMessage(longUid, message);

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

        service.sendControlMessage("player-1", message1);
        service.sendControlMessage("player-1", message2);
        service.sendControlMessage("player-1", message3);

        expect(mockWs.send).toHaveBeenCalledTimes(3);
      });

      it("should send each message independently", () => {
        const mockWs = createMockWebSocket(1);
        uidToWs.set("player-1", mockWs);

        const message1: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };
        const message2: ServerMessage = { t: "elevate-to-dm", uid: "player-2" };

        service.sendControlMessage("player-1", message1);
        service.sendControlMessage("player-1", message2);

        expect(mockWs.send).toHaveBeenNthCalledWith(1, JSON.stringify(message1));
        expect(mockWs.send).toHaveBeenNthCalledWith(2, JSON.stringify(message2));
      });
    });
  });

  describe("isClientReady", () => {
    it("should return true for client with readyState 1 (OPEN)", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      expect(service.isClientReady("player-1")).toBe(true);
    });

    it("should return false for client with readyState 0 (CONNECTING)", () => {
      const mockWs = createMockWebSocket(0);
      uidToWs.set("player-1", mockWs);

      expect(service.isClientReady("player-1")).toBe(false);
    });

    it("should return false for client with readyState 2 (CLOSING)", () => {
      const mockWs = createMockWebSocket(2);
      uidToWs.set("player-1", mockWs);

      expect(service.isClientReady("player-1")).toBe(false);
    });

    it("should return false for client with readyState 3 (CLOSED)", () => {
      const mockWs = createMockWebSocket(3);
      uidToWs.set("player-1", mockWs);

      expect(service.isClientReady("player-1")).toBe(false);
    });

    it("should return false for nonexistent client", () => {
      expect(service.isClientReady("nonexistent")).toBe(false);
    });

    it("should return false for null WebSocket", () => {
      uidToWs.set("player-1", null as unknown as WebSocket);
      expect(service.isClientReady("player-1")).toBe(false);
    });

    it("should return false for undefined WebSocket", () => {
      uidToWs.set("player-1", undefined as unknown as WebSocket);
      expect(service.isClientReady("player-1")).toBe(false);
    });

    it("should handle empty string UID", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("", mockWs);

      expect(service.isClientReady("")).toBe(true);
    });

    it("should accurately reflect client state changes", () => {
      const mockWs = createMockWebSocket(0);
      uidToWs.set("player-1", mockWs);

      expect(service.isClientReady("player-1")).toBe(false);

      // Simulate connection opening
      mockWs.readyState = 1;
      expect(service.isClientReady("player-1")).toBe(true);

      // Simulate connection closing
      mockWs.readyState = 2;
      expect(service.isClientReady("player-1")).toBe(false);

      // Simulate connection closed
      mockWs.readyState = 3;
      expect(service.isClientReady("player-1")).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle client map being modified after service creation", () => {
      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Initially no client
      service.sendControlMessage("player-1", message);

      // Add client to map
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      // Should now send
      service.sendControlMessage("player-1", message);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it("should handle client being removed from map", () => {
      const mockWs = createMockWebSocket(1);
      uidToWs.set("player-1", mockWs);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Should send initially
      service.sendControlMessage("player-1", message);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Remove client
      uidToWs.delete("player-1");

      // Should not send after removal
      service.sendControlMessage("player-1", message);
      expect(mockWs.send).toHaveBeenCalledTimes(1); // Still only 1
    });

    it("should handle client WebSocket being replaced in map", () => {
      const mockWs1 = createMockWebSocket(1);
      const mockWs2 = createMockWebSocket(1);

      uidToWs.set("player-1", mockWs1);

      const message: ServerMessage = { t: "elevate-to-dm", uid: "player-1" };

      // Send to first WebSocket
      service.sendControlMessage("player-1", message);
      expect(mockWs1.send).toHaveBeenCalledTimes(1);

      // Replace with second WebSocket
      uidToWs.set("player-1", mockWs2);

      // Should send to second WebSocket
      service.sendControlMessage("player-1", message);
      expect(mockWs1.send).toHaveBeenCalledTimes(1); // Still only 1
      expect(mockWs2.send).toHaveBeenCalledTimes(1);
    });
  });
});
