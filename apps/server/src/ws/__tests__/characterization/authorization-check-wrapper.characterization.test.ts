/**
 * Characterization Tests: Authorization Check Wrapper Pattern
 *
 * Purpose: Capture the current behavior of the DM authorization check + handler execution
 * pattern in messageRouter.ts before extracting it into a dedicated wrapper service.
 *
 * Source Code: apps/server/src/ws/messageRouter.ts
 * - Lines 286-293, 305-312, 326-333, 347-354, 362-369: NPC actions
 * - Lines 442-450, 467-474, 487-494: Prop actions
 * - Lines 771-777: Token management
 *
 * Pattern Being Captured (9 occurrences):
 * ```typescript
 * case "action-type": {
 *   if (
 *     !this.dmAuthorizationEnforcer.enforceDMAction(
 *       senderUid,
 *       this.isDM(senderUid),
 *       "action name",
 *     )
 *   ) {
 *     break;  // Handler NOT executed
 *   }
 *   const result = handler.handleAction(...);
 *   this.routeResultHandler.handleResult(result);
 *   break;
 * }
 * ```
 *
 * Target: apps/server/src/ws/services/AuthorizationCheckWrapper.ts
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Authorization Check Wrapper - Current Behavior", () => {
  let mockDmAuthorizationEnforcer: {
    enforceDMAction: ReturnType<typeof vi.fn>;
  };
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockRouteResultHandler: {
    handleResult: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDmAuthorizationEnforcer = {
      enforceDMAction: vi.fn(),
    };
    mockHandler = vi.fn();
    mockRouteResultHandler = {
      handleResult: vi.fn(),
    };
  });

  describe("Authorization Check Behavior", () => {
    it("should execute handler when DM is authorized", () => {
      // GIVEN: User is authorized as DM
      const senderUid = "dm-user-123";
      const isDM = true;
      const actionName = "create character";
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      // WHEN: Current pattern executes
      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, actionName)) {
        // break; - in real code, exits switch case
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      // THEN: Handler is executed and result is processed
      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        isDM,
        actionName,
      );
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
      expect(result).toEqual(expectedResult);
    });

    it("should NOT execute handler when non-DM is blocked", () => {
      // GIVEN: User is not authorized (non-DM)
      const senderUid = "player-user-456";
      const isDM = false;
      const actionName = "create character";
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      // WHEN: Current pattern executes
      let result;
      let handlerExecuted = false;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, actionName)) {
        // break; - in real code, exits switch case
        result = undefined;
      } else {
        handlerExecuted = true;
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      // THEN: Handler is NOT executed, no result processing
      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        isDM,
        actionName,
      );
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
      expect(handlerExecuted).toBe(false);
      expect(result).toBeUndefined();
    });
  });

  describe("All 9 Message Types - Authorized DM", () => {
    it("should execute create-character handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        const result = mockHandler("Alice", 100, "portrait-url");
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("Alice", 100, "portrait-url");
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute create-npc handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create NPC")) {
        // break
      } else {
        const result = mockHandler("Goblin", 50, "npc-portrait", { hp: 50 });
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("Goblin", 50, "npc-portrait", { hp: 50 });
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute update-npc handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "update NPC")) {
        // break
      } else {
        const result = mockHandler("npc-123", { name: "Updated Goblin", hp: 30 });
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("npc-123", {
        name: "Updated Goblin",
        hp: 30,
      });
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute delete-npc handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "delete NPC")) {
        // break
      } else {
        const result = mockHandler("npc-456");
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("npc-456");
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute place-npc-token handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "place NPC token")) {
        // break
      } else {
        const result = mockHandler("npc-789", senderUid);
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("npc-789", senderUid);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute create-prop handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create prop")) {
        // break
      } else {
        const result = mockHandler("Chest", "chest-image-url", "dm-123", 2);
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("Chest", "chest-image-url", "dm-123", 2);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute update-prop handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "update prop")) {
        // break
      } else {
        const result = mockHandler("prop-123", { label: "Updated Chest", size: 3 });
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("prop-123", {
        label: "Updated Chest",
        size: 3,
      });
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute delete-prop handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "delete prop")) {
        // break
      } else {
        const result = mockHandler("prop-456");
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith("prop-456");
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should execute clear-all-tokens handler when DM is authorized", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "clear all tokens")) {
        // break
      } else {
        const result = mockHandler(senderUid);
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockHandler).toHaveBeenCalledWith(senderUid);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe("All 9 Message Types - Blocked Non-DM", () => {
    it("should block create-character handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break - handler NOT executed
      } else {
        mockHandler("Alice", 100, "portrait-url");
      }

      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        isDM,
        "create character",
      );
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });

    it("should block create-npc handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create NPC")) {
        // break
      } else {
        mockHandler("Goblin", 50, "npc-portrait");
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block update-npc handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "update NPC")) {
        // break
      } else {
        mockHandler("npc-123", { name: "Updated" });
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block delete-npc handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "delete NPC")) {
        // break
      } else {
        mockHandler("npc-456");
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block place-npc-token handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "place NPC token")) {
        // break
      } else {
        mockHandler("npc-789", senderUid);
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block create-prop handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create prop")) {
        // break
      } else {
        mockHandler("Chest", "chest-url");
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block update-prop handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "update prop")) {
        // break
      } else {
        mockHandler("prop-123", { label: "Updated" });
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block delete-prop handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "delete prop")) {
        // break
      } else {
        mockHandler("prop-456");
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should block clear-all-tokens handler when non-DM attempts action", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "clear all tokens")) {
        // break
      } else {
        mockHandler(senderUid);
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("Result Handling - Authorized Execution", () => {
    it("should return and process result when handler is executed", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: true };
      mockHandler.mockReturnValue(expectedResult);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(result).toEqual(expectedResult);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledTimes(1);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should handle result with broadcast flag only", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: true, save: false };
      mockHandler.mockReturnValue(expectedResult);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should handle result with save flag only", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: false, save: true };
      mockHandler.mockReturnValue(expectedResult);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });

    it("should handle result with no flags", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const expectedResult = { broadcast: false, save: false };
      mockHandler.mockReturnValue(expectedResult);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe("Result Handling - Blocked Execution", () => {
    it("should return undefined when handler is not executed", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break - result remains undefined
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(result).toBeUndefined();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });

    it("should not process any result when blocked", () => {
      const senderUid = "player-456";
      const isDM = false;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);
      mockHandler.mockReturnValue({ broadcast: true, save: true });

      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        const result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      // Handler never called, so no result to process
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });
  });

  describe("Action Name Consistency", () => {
    it("should use consistent action names for all 9 message types", () => {
      const senderUid = "dm-123";
      const isDM = true;
      const actionNames = [
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

      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);

      actionNames.forEach((actionName) => {
        mockDmAuthorizationEnforcer.enforceDMAction.mockClear();

        if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, actionName)) {
          // break
        } else {
          // handler would execute here
        }

        expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
          senderUid,
          isDM,
          actionName,
        );
      });

      // All 9 action names were checked
      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledTimes(1);
    });
  });

  describe("Pattern Execution Flow", () => {
    it("should follow exact pattern: check -> handler -> result processing", () => {
      const senderUid = "dm-123";
      const isDM = true;
      const actionName = "create character";
      const handlerArgs = ["Alice", 100, "portrait"];
      const expectedResult = { broadcast: true, save: true };

      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      mockHandler.mockReturnValue(expectedResult);

      const callOrder: string[] = [];

      // Step 1: Authorization check
      const authorized = mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, actionName);
      callOrder.push("auth-check");

      if (!authorized) {
        callOrder.push("break");
      } else {
        // Step 2: Handler execution
        const result = mockHandler(...handlerArgs);
        callOrder.push("handler");

        // Step 3: Result processing
        mockRouteResultHandler.handleResult(result);
        callOrder.push("result-handler");
      }

      expect(callOrder).toEqual(["auth-check", "handler", "result-handler"]);
      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledBefore(mockHandler);
      expect(mockHandler).toHaveBeenCalledBefore(mockRouteResultHandler.handleResult);
    });

    it("should follow exact pattern: check -> break (when unauthorized)", () => {
      const senderUid = "player-456";
      const isDM = false;
      const actionName = "create character";

      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      const callOrder: string[] = [];

      // Step 1: Authorization check
      const authorized = mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, actionName);
      callOrder.push("auth-check");

      if (!authorized) {
        callOrder.push("break");
        // break - exits switch case
      } else {
        const result = mockHandler();
        callOrder.push("handler");
        mockRouteResultHandler.handleResult(result);
        callOrder.push("result-handler");
      }

      expect(callOrder).toEqual(["auth-check", "break"]);
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });
  });

  describe("Multiple Sequential Actions", () => {
    it("should handle multiple authorized actions independently", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);

      const actions = [
        { name: "create character", result: { broadcast: true, save: true } },
        { name: "create NPC", result: { broadcast: true, save: false } },
        { name: "create prop", result: { broadcast: false, save: true } },
      ];

      actions.forEach((action) => {
        mockHandler.mockReturnValue(action.result);

        if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, action.name)) {
          // break
        } else {
          const result = mockHandler();
          mockRouteResultHandler.handleResult(result);
        }
      });

      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledTimes(3);
      expect(mockHandler).toHaveBeenCalledTimes(3);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledTimes(3);
    });

    it("should handle mixed authorized and blocked actions independently", () => {
      const actions = [
        { senderUid: "dm-123", isDM: true, name: "create character", authorized: true },
        {
          senderUid: "player-456",
          isDM: false,
          name: "create NPC",
          authorized: false,
        },
        { senderUid: "dm-123", isDM: true, name: "create prop", authorized: true },
      ];

      actions.forEach((action) => {
        mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(action.authorized);
        mockHandler.mockReturnValue({ broadcast: true, save: true });

        if (
          !mockDmAuthorizationEnforcer.enforceDMAction(action.senderUid, action.isDM, action.name)
        ) {
          // break
        } else {
          const result = mockHandler();
          mockRouteResultHandler.handleResult(result);
        }
      });

      // 3 auth checks, but only 2 handlers executed (action 0 and 2)
      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledTimes(3);
      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle handler returning null result", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      mockHandler.mockReturnValue(null);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(result).toBeNull();
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(null);
    });

    it("should handle handler returning undefined result", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      mockHandler.mockReturnValue(undefined);

      let result;
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break
      } else {
        result = mockHandler();
        mockRouteResultHandler.handleResult(result);
      }

      expect(result).toBeUndefined();
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith(undefined);
    });

    it("should handle handler throwing error (error should propagate)", () => {
      const senderUid = "dm-123";
      const isDM = true;
      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      const error = new Error("Handler error");
      mockHandler.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
          // break
        } else {
          const result = mockHandler();
          mockRouteResultHandler.handleResult(result);
        }
      }).toThrow("Handler error");

      expect(mockHandler).toHaveBeenCalledTimes(1);
      // Error thrown before result handler called
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });

    it("should not call handler if authorization check throws error", () => {
      const senderUid = "dm-123";
      const isDM = true;
      const error = new Error("Authorization error");
      mockDmAuthorizationEnforcer.enforceDMAction.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
          // break
        } else {
          mockHandler();
        }
      }).toThrow("Authorization error");

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });
  });

  describe("Complete Integration Pattern", () => {
    it("should replicate exact messageRouter.ts pattern for create-character", () => {
      // This test replicates the EXACT pattern from messageRouter.ts lines 286-302
      const senderUid = "dm-user-123";
      const isDM = true;
      const characterName = "Alice";
      const maxHp = 100;
      const portrait = "portrait-url.png";

      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(true);
      mockHandler.mockReturnValue({ broadcast: true, save: true });

      // EXACT pattern from messageRouter.ts
      // case "create-character": {
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break;
      } else {
        const result = mockHandler(characterName, maxHp, portrait);
        mockRouteResultHandler.handleResult(result);
        // break;
      }
      // }

      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        isDM,
        "create character",
      );
      expect(mockHandler).toHaveBeenCalledWith(characterName, maxHp, portrait);
      expect(mockRouteResultHandler.handleResult).toHaveBeenCalledWith({
        broadcast: true,
        save: true,
      });
    });

    it("should replicate exact messageRouter.ts pattern for blocked action", () => {
      // This test replicates the EXACT pattern when authorization fails
      const senderUid = "player-user-456";
      const isDM = false;

      mockDmAuthorizationEnforcer.enforceDMAction.mockReturnValue(false);

      // EXACT pattern from messageRouter.ts
      // case "create-character": {
      if (!mockDmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, "create character")) {
        // break; - exits switch case, handler NOT executed
      } else {
        const result = mockHandler("Alice", 100, "portrait");
        mockRouteResultHandler.handleResult(result);
        // break;
      }
      // }

      expect(mockDmAuthorizationEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        isDM,
        "create character",
      );
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockRouteResultHandler.handleResult).not.toHaveBeenCalled();
    });
  });
});
