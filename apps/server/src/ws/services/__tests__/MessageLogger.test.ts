/**
 * Unit Tests: MessageLogger Service
 *
 * Comprehensive tests for the MessageLogger service extracted from messageRouter.ts.
 * Tests all logging methods with various input scenarios and edge cases.
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ClientMessage } from "@shared";
import { MessageLogger } from "../MessageLogger.js";

describe("MessageLogger", () => {
  let logger: MessageLogger;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new MessageLogger();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("logMessageRouting", () => {
    it("should log message type and sender UID", () => {
      logger.logMessageRouting("move", "player-123");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[MessageRouter] Routing message type: move from player-123",
      );
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different message types", () => {
      const messageTypes = [
        "create-character",
        "delete-token",
        "set-hp",
        "dice-roll",
        "heartbeat",
        "rtc-signal",
      ];

      messageTypes.forEach((type) => {
        consoleLogSpy.mockClear();
        logger.logMessageRouting(type, "player-456");

        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[MessageRouter] Routing message type: ${type} from player-456`,
        );
      });
    });

    it("should handle different sender UIDs", () => {
      const senderUids = [
        "player-1",
        "dm-user",
        "guest-789",
        "user-abc-123",
        "test-uid-with-dashes",
      ];

      senderUids.forEach((uid) => {
        consoleLogSpy.mockClear();
        logger.logMessageRouting("heartbeat", uid);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[MessageRouter] Routing message type: heartbeat from ${uid}`,
        );
      });
    });

    it("should handle empty strings gracefully", () => {
      logger.logMessageRouting("", "");

      expect(consoleLogSpy).toHaveBeenCalledWith("[MessageRouter] Routing message type:  from ");
    });

    it("should handle special characters in message type", () => {
      logger.logMessageRouting("type-with-special!@#$%", "player-123");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[MessageRouter] Routing message type: type-with-special!@#$% from player-123",
      );
    });

    it("should handle special characters in sender UID", () => {
      logger.logMessageRouting("move", "uid!@#$%^&*()");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[MessageRouter] Routing message type: move from uid!@#$%^&*()",
      );
    });

    it("should handle very long message types", () => {
      const longType = "a".repeat(1000);
      logger.logMessageRouting(longType, "player-123");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[MessageRouter] Routing message type: ${longType} from player-123`,
      );
    });

    it("should handle very long sender UIDs", () => {
      const longUid = "b".repeat(1000);
      logger.logMessageRouting("move", longUid);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[MessageRouter] Routing message type: move from ${longUid}`,
      );
    });
  });

  describe("logBroadcastComplete", () => {
    it("should log broadcast completion message", () => {
      logger.logBroadcastComplete();

      expect(consoleLogSpy).toHaveBeenCalledWith("[MessageRouter] Broadcast and save complete");
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it("should log same message on multiple calls", () => {
      logger.logBroadcastComplete();
      logger.logBroadcastComplete();
      logger.logBroadcastComplete();

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith("[MessageRouter] Broadcast and save complete");
    });
  });

  describe("logUnknownMessageType", () => {
    it("should warn about unknown message type", () => {
      logger.logUnknownMessageType("invalid-action");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", "invalid-action");
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different unknown message types", () => {
      const unknownTypes = ["foo", "bar", "baz", "invalid-123", "unknown-xyz"];

      unknownTypes.forEach((type) => {
        consoleWarnSpy.mockClear();
        logger.logUnknownMessageType(type);

        expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", type);
      });
    });

    it("should handle empty string", () => {
      logger.logUnknownMessageType("");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", "");
    });

    it("should handle special characters", () => {
      logger.logUnknownMessageType("type!@#$%^&*()");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", "type!@#$%^&*()");
    });

    it("should handle very long message types", () => {
      const longType = "unknown-".repeat(200);
      logger.logUnknownMessageType(longType);

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", longType);
    });
  });

  describe("logRoutingError", () => {
    it("should log error with message type and sender UID", () => {
      const error = new Error("Test error");
      logger.logRoutingError("move", "player-123", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Error routing message type=move from=player-123:",
        error,
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different error types", () => {
      const errors = [
        new Error("Standard error"),
        new TypeError("Type error"),
        new RangeError("Range error"),
        new SyntaxError("Syntax error"),
      ];

      errors.forEach((error) => {
        consoleErrorSpy.mockClear();
        logger.logRoutingError("dice-roll", "sender-789", error);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[MessageRouter] Error routing message type=dice-roll from=sender-789:",
          error,
        );
      });
    });

    it("should handle non-Error objects", () => {
      const nonErrorValues = ["String error", { error: "Object error" }, 42, null, undefined];

      nonErrorValues.forEach((value) => {
        consoleErrorSpy.mockClear();
        logger.logRoutingError("set-hp", "player-456", value);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[MessageRouter] Error routing message type=set-hp from=player-456:",
          value,
        );
      });
    });

    it("should handle different message types in error log", () => {
      const error = new Error("Test");
      const messageTypes = ["create-character", "delete-npc", "update-prop", "grid-size"];

      messageTypes.forEach((type) => {
        consoleErrorSpy.mockClear();
        logger.logRoutingError(type, "player-123", error);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `[MessageRouter] Error routing message type=${type} from=player-123:`,
          error,
        );
      });
    });

    it("should handle different sender UIDs in error log", () => {
      const error = new Error("Test");
      const senderUids = ["player-1", "dm-user", "guest-123", "admin-456"];

      senderUids.forEach((uid) => {
        consoleErrorSpy.mockClear();
        logger.logRoutingError("move", uid, error);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `[MessageRouter] Error routing message type=move from=${uid}:`,
          error,
        );
      });
    });

    it("should handle empty strings in error log", () => {
      const error = new Error("Test");
      logger.logRoutingError("", "", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Error routing message type= from=:",
        error,
      );
    });

    it("should handle special characters in error log", () => {
      const error = new Error("Test");
      logger.logRoutingError("type!@#$", "uid%^&*()", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Error routing message type=type!@#$ from=uid%^&*():",
        error,
      );
    });
  });

  describe("logMessageDetails", () => {
    it("should log message as JSON string", () => {
      const message: ClientMessage = { t: "move", id: "token-1", x: 100, y: 200 };
      logger.logMessageDetails(message);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different message types", () => {
      const messages: ClientMessage[] = [
        { t: "set-hp", hp: 50, maxHp: 100 },
        { t: "dice-roll", roll: "1d20" },
        { t: "heartbeat" },
        { t: "rename", name: "New Name" },
      ];

      messages.forEach((message) => {
        consoleErrorSpy.mockClear();
        logger.logMessageDetails(message);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[MessageRouter] Message details:",
          JSON.stringify(message),
        );
      });
    });

    it("should handle complex nested message structures", () => {
      const complexMessage: ClientMessage = {
        t: "create-character",
        name: "Test Character",
        maxHp: 100,
        portrait: "https://example.com/portrait.png",
      };

      logger.logMessageDetails(complexMessage);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(complexMessage),
      );
    });

    it("should handle messages with special characters", () => {
      const message: ClientMessage = {
        t: "rename",
        name: "Name with special chars: !@#$%^&*()",
      };

      logger.logMessageDetails(message);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });

    it("should handle messages with unicode characters", () => {
      const message: ClientMessage = {
        t: "rename",
        name: "Unicode: 你好世界 🎉",
      };

      logger.logMessageDetails(message);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });

    it("should handle messages with very long strings", () => {
      const longName = "a".repeat(10000);
      const message: ClientMessage = {
        t: "rename",
        name: longName,
      };

      logger.logMessageDetails(message);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });
  });

  describe("logUnauthorizedAction", () => {
    it("should warn when non-DM attempts action", () => {
      logger.logUnauthorizedAction("player-123", "create character");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Non-DM player-123 attempted to create character",
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle different actions", () => {
      const actions = [
        "create character",
        "create NPC",
        "update NPC",
        "delete NPC",
        "place NPC token",
        "create prop",
        "update prop",
        "delete prop",
        "clear all tokens",
      ];

      actions.forEach((action) => {
        consoleWarnSpy.mockClear();
        logger.logUnauthorizedAction("player-123", action);

        expect(consoleWarnSpy).toHaveBeenCalledWith(`Non-DM player-123 attempted to ${action}`);
      });
    });

    it("should handle different sender UIDs", () => {
      const senderUids = ["player-1", "guest-2", "user-abc", "temp-123", "unauthorized-user"];

      senderUids.forEach((uid) => {
        consoleWarnSpy.mockClear();
        logger.logUnauthorizedAction(uid, "delete NPC");

        expect(consoleWarnSpy).toHaveBeenCalledWith(`Non-DM ${uid} attempted to delete NPC`);
      });
    });

    it("should handle empty strings", () => {
      logger.logUnauthorizedAction("", "");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM  attempted to ");
    });

    it("should handle special characters in sender UID", () => {
      logger.logUnauthorizedAction("uid!@#$%", "create character");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM uid!@#$% attempted to create character");
    });

    it("should handle special characters in action", () => {
      logger.logUnauthorizedAction("player-123", "action!@#$%");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM player-123 attempted to action!@#$%");
    });

    it("should handle very long sender UIDs", () => {
      const longUid = "player-".repeat(200);
      logger.logUnauthorizedAction(longUid, "create character");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Non-DM ${longUid} attempted to create character`,
      );
    });

    it("should handle very long action descriptions", () => {
      const longAction = "create very long action name ".repeat(100);
      logger.logUnauthorizedAction("player-123", longAction);

      expect(consoleWarnSpy).toHaveBeenCalledWith(`Non-DM player-123 attempted to ${longAction}`);
    });
  });

  describe("Multiple method calls", () => {
    it("should handle multiple different logging calls", () => {
      logger.logMessageRouting("move", "player-123");
      logger.logUnknownMessageType("invalid");
      logger.logBroadcastComplete();

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle error logging with message details", () => {
      const error = new Error("Test error");
      const message: ClientMessage = { t: "set-hp", hp: 50, maxHp: 100 };

      logger.logRoutingError("set-hp", "player-123", error);
      logger.logMessageDetails(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        "[MessageRouter] Error routing message type=set-hp from=player-123:",
        error,
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        "[MessageRouter] Message details:",
        JSON.stringify(message),
      );
    });

    it("should maintain independent spy counts", () => {
      logger.logMessageRouting("move", "player-1");
      logger.logMessageRouting("set-hp", "player-2");
      logger.logUnauthorizedAction("player-3", "create NPC");
      logger.logUnknownMessageType("invalid");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Service initialization", () => {
    it("should create new instance without errors", () => {
      expect(() => new MessageLogger()).not.toThrow();
    });

    it("should allow multiple instances", () => {
      const logger1 = new MessageLogger();
      const logger2 = new MessageLogger();

      logger1.logMessageRouting("move", "player-1");
      logger2.logMessageRouting("set-hp", "player-2");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });
});
