/**
 * Unit Tests: DMAuthorizationEnforcer
 *
 * Tests the DM Authorization Enforcer service that handles enforcement of DM-only actions.
 *
 * Coverage:
 * - Authorization enforcement (allow/block)
 * - Logging unauthorized attempts
 * - Return value correctness
 * - Message format consistency
 * - Edge cases (empty strings, special characters)
 * - Real-world action names from messageRouter.ts
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DMAuthorizationEnforcer } from "../DMAuthorizationEnforcer.js";
import { MessageLogger } from "../MessageLogger.js";

describe("DMAuthorizationEnforcer", () => {
  let enforcer: DMAuthorizationEnforcer;
  let messageLogger: MessageLogger;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    messageLogger = new MessageLogger();
    enforcer = new DMAuthorizationEnforcer(messageLogger);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("enforceDMAction", () => {
    describe("Authorization - DM Users", () => {
      it("should allow action when user is DM", () => {
        const result = enforcer.enforceDMAction("dm-user-123", true, "create character");

        expect(result).toBe(true);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should allow multiple actions from same DM", () => {
        enforcer.enforceDMAction("dm-user-456", true, "create character");
        enforcer.enforceDMAction("dm-user-456", true, "delete prop");
        enforcer.enforceDMAction("dm-user-456", true, "update NPC");

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should allow actions from different DMs", () => {
        enforcer.enforceDMAction("dm-user-1", true, "create character");
        enforcer.enforceDMAction("dm-user-2", true, "create prop");

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe("Authorization - Non-DM Users", () => {
      it("should block action when user is not DM", () => {
        const result = enforcer.enforceDMAction("player-123", false, "create character");

        expect(result).toBe(false);
      });

      it("should block multiple actions from same non-DM", () => {
        const result1 = enforcer.enforceDMAction("player-456", false, "create character");
        const result2 = enforcer.enforceDMAction("player-456", false, "delete prop");

        expect(result1).toBe(false);
        expect(result2).toBe(false);
      });

      it("should block actions from different non-DMs", () => {
        const result1 = enforcer.enforceDMAction("player-1", false, "create character");
        const result2 = enforcer.enforceDMAction("player-2", false, "create prop");

        expect(result1).toBe(false);
        expect(result2).toBe(false);
      });
    });

    describe("Logging - Unauthorized Attempts", () => {
      it("should log warning when non-DM attempts action", () => {
        enforcer.enforceDMAction("player-123", false, "create character");

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Non-DM player-123 attempted to create character",
        );
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it("should log warning for each unauthorized attempt", () => {
        enforcer.enforceDMAction("player-123", false, "create character");
        enforcer.enforceDMAction("player-456", false, "delete prop");

        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
        expect(consoleWarnSpy).toHaveBeenNthCalledWith(
          1,
          "Non-DM player-123 attempted to create character",
        );
        expect(consoleWarnSpy).toHaveBeenNthCalledWith(
          2,
          "Non-DM player-456 attempted to delete prop",
        );
      });

      it("should not log warning when DM performs action", () => {
        enforcer.enforceDMAction("dm-user-123", true, "create character");

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe("Real-World Action Names", () => {
      const testCases = [
        { action: "create character", description: "Character creation" },
        { action: "create NPC", description: "NPC creation" },
        { action: "update NPC", description: "NPC update" },
        { action: "delete NPC", description: "NPC deletion" },
        { action: "place NPC token", description: "NPC token placement" },
        { action: "create prop", description: "Prop creation" },
        { action: "update prop", description: "Prop update" },
        { action: "delete prop", description: "Prop deletion" },
        { action: "clear all tokens", description: "Token clearing" },
      ];

      testCases.forEach(({ action, description }) => {
        it(`should enforce DM-only action: ${description}`, () => {
          const resultDM = enforcer.enforceDMAction("dm-user", true, action);
          const resultPlayer = enforcer.enforceDMAction("player-user", false, action);

          expect(resultDM).toBe(true);
          expect(resultPlayer).toBe(false);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`Non-DM player-user attempted to ${action}`);
        });
      });
    });

    describe("Message Format", () => {
      it("should use consistent message format", () => {
        enforcer.enforceDMAction("player-123", false, "test action");

        expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM player-123 attempted to test action");
      });

      it("should include sender UID in message", () => {
        const senderUid = "unique-player-id-789";
        enforcer.enforceDMAction(senderUid, false, "test action");

        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(senderUid));
      });

      it("should include action description in message", () => {
        const action = "perform special action";
        enforcer.enforceDMAction("player-123", false, action);

        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(action));
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty sender UID", () => {
        const result = enforcer.enforceDMAction("", false, "create character");

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM  attempted to create character");
      });

      it("should handle empty action description", () => {
        const result = enforcer.enforceDMAction("player-123", false, "");

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM player-123 attempted to ");
      });

      it("should handle action with special characters", () => {
        const result = enforcer.enforceDMAction(
          "player-123",
          false,
          "create character (with special chars!@#)",
        );

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Non-DM player-123 attempted to create character (with special chars!@#)",
        );
      });

      it("should handle very long sender UID", () => {
        const longUid = "player-" + "x".repeat(100);
        const result = enforcer.enforceDMAction(longUid, false, "create character");

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `Non-DM ${longUid} attempted to create character`,
        );
      });

      it("should handle very long action description", () => {
        const longAction = "perform " + "complex ".repeat(50) + "action";
        const result = enforcer.enforceDMAction("player-123", false, longAction);

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(`Non-DM player-123 attempted to ${longAction}`);
      });
    });

    describe("Return Value Correctness", () => {
      it("should return true only when isDM is true", () => {
        expect(enforcer.enforceDMAction("user", true, "action")).toBe(true);
        expect(enforcer.enforceDMAction("user", false, "action")).toBe(false);
      });

      it("should return boolean (not truthy/falsy values)", () => {
        const resultDM = enforcer.enforceDMAction("user", true, "action");
        const resultPlayer = enforcer.enforceDMAction("user", false, "action");

        expect(typeof resultDM).toBe("boolean");
        expect(typeof resultPlayer).toBe("boolean");
        expect(resultDM).toBe(true);
        expect(resultPlayer).toBe(false);
      });
    });

    describe("High-Frequency Scenarios", () => {
      it("should handle rapid sequential calls", () => {
        for (let i = 0; i < 100; i++) {
          enforcer.enforceDMAction(`player-${i}`, false, "create character");
        }

        expect(consoleWarnSpy).toHaveBeenCalledTimes(100);
      });

      it("should handle mixed DM and non-DM calls", () => {
        enforcer.enforceDMAction("dm-1", true, "create character");
        enforcer.enforceDMAction("player-1", false, "create character");
        enforcer.enforceDMAction("dm-2", true, "delete prop");
        enforcer.enforceDMAction("player-2", false, "delete prop");

        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Non-DM player-1 attempted to create character",
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM player-2 attempted to delete prop");
      });
    });

    describe("Statelessness", () => {
      it("should not maintain state between calls", () => {
        // First call - non-DM blocked
        const result1 = enforcer.enforceDMAction("user-123", false, "create character");
        expect(result1).toBe(false);

        // Second call - same user but now DM (simulating elevation)
        const result2 = enforcer.enforceDMAction("user-123", true, "create character");
        expect(result2).toBe(true);

        // Should not remember previous state
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it("should produce same result for same inputs", () => {
        const result1 = enforcer.enforceDMAction("player-123", false, "test action");
        const result2 = enforcer.enforceDMAction("player-123", false, "test action");

        expect(result1).toBe(result2);
      });
    });
  });
});
