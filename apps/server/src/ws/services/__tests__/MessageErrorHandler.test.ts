import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { MessageErrorHandler } from "../MessageErrorHandler.js";
import { MessageLogger } from "../MessageLogger.js";
import type { ClientMessage } from "@shared";

/**
 * Unit Tests: MessageErrorHandler Service
 *
 * Tests the extracted error handling service in isolation.
 * Verifies all behaviors documented in characterization tests.
 *
 * Source: apps/server/src/ws/__tests__/characterization/error-handling.characterization.test.ts
 */
describe("MessageErrorHandler", () => {
  let errorHandler: MessageErrorHandler;
  let messageLogger: MessageLogger;
  let consoleErrorSpy: Mock;

  beforeEach(() => {
    messageLogger = new MessageLogger();
    errorHandler = new MessageErrorHandler(messageLogger);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Error Logging Format", () => {
    it("should log error with message type and sender UID", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "rename", name: "NewName" };
      const senderUid = "player-1";

      errorHandler.handleError(error, message, senderUid);

      // First call: Error with message type and sender
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        "[MessageRouter] Error routing message type=rename from=player-1:",
        error,
      );
    });

    it("should log full message details as JSON", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "set-hp", hp: 50, maxHp: 100 };
      const senderUid = "player-1";

      errorHandler.handleError(error, message, senderUid);

      // Second call: Full message details as JSON
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        "[MessageRouter] Message details:",
        JSON.stringify({ t: "set-hp", hp: 50, maxHp: 100 }),
      );
    });

    it("should make exactly 2 console.error calls", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "move", id: "token-1", x: 100, y: 200 };
      const senderUid = "player-1";

      errorHandler.handleError(error, message, senderUid);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Complex Message Structures", () => {
    it("should serialize complex nested messages", () => {
      const error = new Error("Drawing error");
      const complexMsg: ClientMessage = {
        t: "draw",
        drawing: {
          id: "drawing-1",
          owner: "player-1",
          strokes: [
            { x: 10, y: 20, color: "#FF0000", size: 2 },
            { x: 30, y: 40, color: "#00FF00", size: 3 },
          ],
          locked: false,
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
      };

      errorHandler.handleError(error, complexMsg, "player-1");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(complexMsg),
      );
    });

    it("should handle messages with optional fields", () => {
      const error = new Error("Character error");
      const message: ClientMessage = {
        t: "create-character",
        name: "Hero",
        maxHp: 25,
        portrait: undefined,
      };

      errorHandler.handleError(error, message, "dm-user");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });
  });

  describe("Error Type Handling", () => {
    it("should preserve Error instances with stack traces", () => {
      const errorWithStack = new Error("Error with stack");
      const message: ClientMessage = { t: "portrait", data: "portrait.png" };

      errorHandler.handleError(errorWithStack, message, "player-1");

      // Error object should be logged with stack trace intact
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: "Error with stack",
          stack: expect.any(String),
        }),
      );
    });

    it("should handle non-Error throws (e.g., strings)", () => {
      const stringError = "String error message";
      const message: ClientMessage = { t: "delete-token", id: "token-1" };

      errorHandler.handleError(stringError, message, "player-1");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("message type=delete-token"),
        stringError,
      );
    });

    it("should handle null/undefined errors", () => {
      const message: ClientMessage = { t: "move", id: "token-1", x: 0, y: 0 };

      errorHandler.handleError(null, message, "player-1");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("message type=move"),
        null,
      );

      consoleErrorSpy.mockClear();

      errorHandler.handleError(undefined, message, "player-1");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("message type=move"),
        undefined,
      );
    });

    it("should handle object errors", () => {
      const objectError = { code: "ERR_VALIDATION", details: "Invalid input" };
      const message: ClientMessage = { t: "grid-size", size: 60 };

      errorHandler.handleError(objectError, message, "player-1");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("message type=grid-size"),
        objectError,
      );
    });
  });

  describe("Message Type Coverage", () => {
    const messageTypes: Array<{ msg: ClientMessage; expectedType: string }> = [
      { msg: { t: "portrait", data: "portrait.png" }, expectedType: "portrait" },
      { msg: { t: "rename", name: "NewName" }, expectedType: "rename" },
      { msg: { t: "move", id: "token-1", x: 100, y: 200 }, expectedType: "move" },
      { msg: { t: "dice-roll", roll: { formula: "1d20", result: 15 } }, expectedType: "dice-roll" },
      { msg: { t: "grid-size", size: 60 }, expectedType: "grid-size" },
      {
        msg: { t: "create-character", name: "Hero", maxHp: 25, portrait: undefined },
        expectedType: "create-character",
      },
      { msg: { t: "delete-token", id: "token-1" }, expectedType: "delete-token" },
      { msg: { t: "set-hp", hp: 10, maxHp: 20 }, expectedType: "set-hp" },
    ];

    messageTypes.forEach(({ msg, expectedType }) => {
      it(`should handle ${expectedType} message type`, () => {
        const error = new Error(`${expectedType} error`);

        errorHandler.handleError(error, msg, "player-1");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(`message type=${expectedType}`),
          error,
        );
      });
    });
  });

  describe("Sender UID Handling", () => {
    it("should include sender UID in error log", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "rename", name: "Test" };

      errorHandler.handleError(error, message, "specific-player-123");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("from=specific-player-123"),
        error,
      );
    });

    it("should handle different sender UID formats", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "move", id: "token-1", x: 0, y: 0 };

      const senderUids = ["player-1", "dm-user", "user-abc-123", "anonymous"];

      senderUids.forEach((uid) => {
        consoleErrorSpy.mockClear();
        errorHandler.handleError(error, message, uid);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`from=${uid}`), error);
      });
    });
  });

  describe("Graceful Error Handling", () => {
    it("should NOT throw errors", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "rename", name: "Test" };

      // Should not throw
      expect(() => {
        errorHandler.handleError(error, message, "player-1");
      }).not.toThrow();
    });

    it("should handle multiple errors in sequence", () => {
      const message1: ClientMessage = { t: "rename", name: "Name1" };
      const message2: ClientMessage = { t: "portrait", data: "portrait.png" };
      const message3: ClientMessage = { t: "set-hp", hp: 10, maxHp: 20 };

      errorHandler.handleError(new Error("Error 1"), message1, "player-1");
      errorHandler.handleError(new Error("Error 2"), message2, "player-2");
      errorHandler.handleError(new Error("Error 3"), message3, "player-3");

      // Should log 6 times total (2 logs per error × 3 errors)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty message type", () => {
      const error = new Error("Test error");
      const message = { t: "" } as ClientMessage;

      errorHandler.handleError(error, message, "player-1");

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("message type="), error);
    });

    it("should handle very long message content", () => {
      const error = new Error("Test error");
      const longString = "x".repeat(10000);
      const message: ClientMessage = { t: "rename", name: longString };

      errorHandler.handleError(error, message, "player-1");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });

    it("should handle messages with circular references gracefully", () => {
      const error = new Error("Test error");
      const circularMsg: { t: string; self?: unknown } = { t: "custom" };
      circularMsg.self = circularMsg; // Create circular reference

      // JSON.stringify will throw on circular references
      // The service should handle this gracefully (or we document it's expected to throw)
      expect(() => {
        errorHandler.handleError(error, circularMsg, "player-1");
      }).toThrow(); // This is expected behavior for circular refs
    });
  });
});
