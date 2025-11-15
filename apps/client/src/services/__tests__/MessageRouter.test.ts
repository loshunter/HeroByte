/**
 * Characterization tests for MessageRouter
 *
 * These tests lock in the existing behavior to ensure
 * zero behavioral changes during refactoring.
 *
 * Tests cover:
 * - JSON parsing and validation
 * - RTC signal message routing
 * - Authentication response routing (auth-ok, auth-failed)
 * - Control message routing
 * - Room snapshot routing
 * - Invalid JSON handling
 * - Type guard accuracy
 * - Debug logging for initiative data
 *
 * Source: apps/client/src/services/websocket.ts (lines 270-323, 34-67)
 * Extracted to: apps/client/src/services/websocket/MessageRouter.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomSnapshot } from "@shared";
import { MessageRouter } from "../websocket/MessageRouter";

describe("MessageRouter - Characterization Tests", () => {
  let mockOnMessage: ReturnType<typeof vi.fn>;
  let mockOnRtcSignal: ReturnType<typeof vi.fn>;
  let mockOnAuthResponse: ReturnType<typeof vi.fn>;
  let mockOnControlMessage: ReturnType<typeof vi.fn>;
  let router: MessageRouter;

  beforeEach(() => {
    mockOnMessage = vi.fn();
    mockOnRtcSignal = vi.fn();
    mockOnAuthResponse = vi.fn();
    mockOnControlMessage = vi.fn();
    vi.clearAllMocks();

    // Create router with all callbacks
    router = new MessageRouter({
      onMessage: mockOnMessage,
      onRtcSignal: mockOnRtcSignal,
      onAuthResponse: mockOnAuthResponse,
      onControlMessage: mockOnControlMessage,
    });
  });

  describe("RTC Signal Routing", () => {
    it("should route valid RTC signal messages to onRtcSignal callback", () => {
      const rtcMessage = {
        t: "rtc-signal",
        from: "peer-123",
        signal: { type: "offer", sdp: "test-sdp-data" },
      };

      router.route(JSON.stringify(rtcMessage));

      expect(mockOnRtcSignal).toHaveBeenCalledOnce();
      expect(mockOnRtcSignal).toHaveBeenCalledWith("peer-123", {
        type: "offer",
        sdp: "test-sdp-data",
      });
      expect(mockOnMessage).not.toHaveBeenCalled();
      expect(mockOnAuthResponse).not.toHaveBeenCalled();
      expect(mockOnControlMessage).not.toHaveBeenCalled();
    });

    it("should route RTC answer signal correctly", () => {
      const rtcMessage = {
        t: "rtc-signal",
        from: "peer-456",
        signal: { type: "answer", sdp: "answer-sdp" },
      };

      router.route(JSON.stringify(rtcMessage));

      expect(mockOnRtcSignal).toHaveBeenCalledWith("peer-456", {
        type: "answer",
        sdp: "answer-sdp",
      });
    });

    it("should NOT route RTC messages missing 'from' field", () => {
      const invalidRtc = {
        t: "rtc-signal",
        signal: { type: "offer" },
        // missing 'from' field
      };

      router.route(JSON.stringify(invalidRtc));

      expect(mockOnRtcSignal).not.toHaveBeenCalled();
      // Should fall through to snapshot handler
      expect(mockOnMessage).toHaveBeenCalledOnce();
    });

    it("should NOT route RTC messages missing 'signal' field", () => {
      const invalidRtc = {
        t: "rtc-signal",
        from: "peer-789",
        // missing 'signal' field
      };

      router.route(JSON.stringify(invalidRtc));

      expect(mockOnRtcSignal).not.toHaveBeenCalled();
      expect(mockOnMessage).toHaveBeenCalledOnce();
    });
  });

  describe("Authentication Response Routing", () => {
    it("should route auth-ok messages to onAuthResponse callback", () => {
      const authOkMessage = { t: "auth-ok" };

      router.route(JSON.stringify(authOkMessage));

      expect(mockOnAuthResponse).toHaveBeenCalledOnce();
      expect(mockOnAuthResponse).toHaveBeenCalledWith({ t: "auth-ok" });
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("should route auth-failed messages with reason to onAuthResponse callback", () => {
      const authFailedMessage = {
        t: "auth-failed",
        reason: "Invalid credentials",
      };

      router.route(JSON.stringify(authFailedMessage));

      expect(mockOnAuthResponse).toHaveBeenCalledOnce();
      expect(mockOnAuthResponse).toHaveBeenCalledWith({
        t: "auth-failed",
        reason: "Invalid credentials",
      });
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("should route auth-failed messages without reason", () => {
      const authFailedMessage = { t: "auth-failed" };

      router.route(JSON.stringify(authFailedMessage));

      expect(mockOnAuthResponse).toHaveBeenCalledWith({ t: "auth-failed" });
    });
  });

  describe("Control Message Routing", () => {
    it("should route room-password-updated to onControlMessage", () => {
      const controlMsg = { t: "room-password-updated" };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledOnce();
      expect(mockOnControlMessage).toHaveBeenCalledWith({ t: "room-password-updated" });
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("should route room-password-update-failed to onControlMessage", () => {
      const controlMsg = { t: "room-password-update-failed" };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledWith({
        t: "room-password-update-failed",
      });
    });

    it("should route dm-status to onControlMessage", () => {
      const controlMsg = { t: "dm-status", isDM: true };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledWith({ t: "dm-status", isDM: true });
    });

    it("should route dm-elevation-failed to onControlMessage", () => {
      const controlMsg = { t: "dm-elevation-failed" };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledWith({ t: "dm-elevation-failed" });
    });

    it("should route dm-password-updated to onControlMessage", () => {
      const controlMsg = { t: "dm-password-updated" };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledWith({ t: "dm-password-updated" });
    });

    it("should route dm-password-update-failed to onControlMessage", () => {
      const controlMsg = { t: "dm-password-update-failed" };

      router.route(JSON.stringify(controlMsg));

      expect(mockOnControlMessage).toHaveBeenCalledWith({
        t: "dm-password-update-failed",
      });
    });
  });

  describe("Room Snapshot Routing", () => {
    it("should route basic room snapshot to onMessage callback", () => {
      const snapshot: RoomSnapshot = {
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

      router.route(JSON.stringify(snapshot));

      expect(mockOnMessage).toHaveBeenCalledOnce();
      expect(mockOnMessage).toHaveBeenCalledWith(snapshot);
    });

    it("should route snapshot with characters to onMessage", () => {
      const snapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "test.png",
        players: [],
        characters: [
          {
            id: "char-1",
            name: "Warrior",
            position: { x: 100, y: 200 },
            color: "red",
            size: 1,
          },
        ],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      router.route(JSON.stringify(snapshot));

      expect(mockOnMessage).toHaveBeenCalledWith(snapshot);
    });

    it("should route unknown message types as snapshots", () => {
      const unknownMessage = {
        someUnknownField: "value",
        anotherField: 123,
      };

      router.route(JSON.stringify(unknownMessage));

      expect(mockOnMessage).toHaveBeenCalledOnce();
      expect(mockOnMessage).toHaveBeenCalledWith(unknownMessage);
    });
  });

  describe("JSON Parsing", () => {
    it("should handle invalid JSON without throwing", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const invalidJson = "{ invalid json }";

      // Should NOT throw
      expect(() => {
        router.route(invalidJson);
      }).not.toThrow();

      expect(mockOnMessage).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle empty string gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      router.route("");

      expect(mockOnMessage).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should parse valid JSON correctly", () => {
      const validMessage = { t: "auth-ok" };

      router.route(JSON.stringify(validMessage));

      expect(mockOnAuthResponse).toHaveBeenCalledWith({ t: "auth-ok" });
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify RTC signal messages", () => {
      const rtcMessage = {
        t: "rtc-signal",
        from: "peer-1",
        signal: { type: "offer" },
      };

      router.route(JSON.stringify(rtcMessage));

      expect(mockOnRtcSignal).toHaveBeenCalled();
    });

    it("should correctly identify auth-ok messages", () => {
      const authMessage = { t: "auth-ok" };

      router.route(JSON.stringify(authMessage));

      expect(mockOnAuthResponse).toHaveBeenCalledWith({ t: "auth-ok" });
    });

    it("should correctly identify control messages", () => {
      const controlMessage = { t: "dm-status" };

      router.route(JSON.stringify(controlMessage));

      expect(mockOnControlMessage).toHaveBeenCalled();
    });

    it("should reject null values", () => {
      router.route(JSON.stringify(null));

      expect(mockOnRtcSignal).not.toHaveBeenCalled();
      expect(mockOnMessage).toHaveBeenCalledWith(null);
    });

    it("should reject primitive values (string, number, boolean)", () => {
      router.route(JSON.stringify("test-string"));

      expect(mockOnMessage).toHaveBeenCalledWith("test-string");
    });
  });

  describe("Callback Optionality", () => {
    it("should NOT crash when onRtcSignal is undefined", () => {
      const localRouter = new MessageRouter({
        onMessage: mockOnMessage,
        // onRtcSignal is undefined
      });

      const rtcMessage = {
        t: "rtc-signal",
        from: "peer-1",
        signal: { type: "offer" },
      };

      expect(() => {
        localRouter.route(JSON.stringify(rtcMessage));
      }).not.toThrow();
    });

    it("should NOT crash when onAuthResponse is undefined", () => {
      const localRouter = new MessageRouter({
        onMessage: mockOnMessage,
        // onAuthResponse is undefined
      });

      const authMessage = { t: "auth-ok" };

      expect(() => {
        localRouter.route(JSON.stringify(authMessage));
      }).not.toThrow();
    });

    it("should NOT crash when onControlMessage is undefined", () => {
      const localRouter = new MessageRouter({
        onMessage: mockOnMessage,
        // onControlMessage is undefined
      });

      const controlMessage = { t: "dm-status" };

      expect(() => {
        localRouter.route(JSON.stringify(controlMessage));
      }).not.toThrow();
    });
  });

  describe("Debug Logging Behavior (Initiative Data)", () => {
    it("should log initiative data when snapshot contains characters with initiative", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const snapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "test.png",
        players: [],
        characters: [
          {
            id: "char-1",
            name: "Fighter",
            position: { x: 100, y: 100 },
            color: "red",
            size: 1,
            initiative: 18,
            initiativeModifier: 2,
          },
          {
            id: "char-2",
            name: "Wizard",
            position: { x: 200, y: 200 },
            color: "blue",
            size: 1,
            initiative: 14,
            initiativeModifier: 1,
          },
        ],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      router.route(JSON.stringify(snapshot));

      // Verify debug logging occurred
      expect(consoleLogSpy).toHaveBeenCalled();
      const initiativeLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] && typeof call[0] === "string" && call[0].includes("initiative"),
      );
      expect(initiativeLogs.length).toBeGreaterThan(0);

      consoleLogSpy.mockRestore();
    });

    it("should NOT log when characters have no initiative data", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const snapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "test.png",
        players: [],
        characters: [
          {
            id: "char-1",
            name: "Fighter",
            position: { x: 100, y: 100 },
            color: "red",
            size: 1,
            // No initiative data
          },
        ],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      router.route(JSON.stringify(snapshot));

      // Should NOT log initiative debug info when no initiative data present
      const initiativeLogs = consoleLogSpy.mock.calls.filter(
        (call) => call[0] && typeof call[0] === "string" && call[0].includes("initiative"),
      );
      expect(initiativeLogs.length).toBe(0);

      consoleLogSpy.mockRestore();
    });
  });

  describe("Message Priority and Routing Order", () => {
    it("should route RTC signals BEFORE checking for snapshots", () => {
      // This test verifies the routing order: RTC -> Auth -> Control -> Snapshot
      const rtcMessage = {
        t: "rtc-signal",
        from: "peer-1",
        signal: { type: "offer" },
        // Even with extra snapshot-like fields
        characters: [],
        players: [],
      };

      router.route(JSON.stringify(rtcMessage));

      expect(mockOnRtcSignal).toHaveBeenCalled();
      expect(mockOnMessage).not.toHaveBeenCalled(); // Should NOT fall through
    });

    it("should route auth responses BEFORE checking for snapshots", () => {
      const authMessage = {
        t: "auth-ok",
        // Extra fields
        someField: "value",
      };

      router.route(JSON.stringify(authMessage));

      expect(mockOnAuthResponse).toHaveBeenCalled();
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it("should route control messages BEFORE checking for snapshots", () => {
      const controlMessage = {
        t: "dm-status",
        isDM: true,
        // Extra fields
        otherData: "test",
      };

      router.route(JSON.stringify(controlMessage));

      expect(mockOnControlMessage).toHaveBeenCalled();
      expect(mockOnMessage).not.toHaveBeenCalled();
    });
  });
});
