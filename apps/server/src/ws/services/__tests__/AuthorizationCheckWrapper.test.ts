/**
 * Unit Tests: AuthorizationCheckWrapper
 *
 * Tests the Authorization Check Wrapper service that wraps handler execution with DM authorization checks.
 *
 * Coverage:
 * - Authorized execution (DM users)
 * - Unauthorized blocking (non-DM users)
 * - Handler return value preservation
 * - Type safety and generic types
 * - Integration with DMAuthorizationEnforcer
 * - Edge cases (errors, null, undefined, complex returns)
 * - High-frequency scenarios
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationCheckWrapper } from "../AuthorizationCheckWrapper.js";
import { DMAuthorizationEnforcer } from "../DMAuthorizationEnforcer.js";

describe("AuthorizationCheckWrapper", () => {
  let wrapper: AuthorizationCheckWrapper;
  let mockEnforcer: DMAuthorizationEnforcer;

  beforeEach(() => {
    // Create mock enforcer
    mockEnforcer = {
      enforceDMAction: vi.fn(),
    } as unknown as DMAuthorizationEnforcer;

    wrapper = new AuthorizationCheckWrapper(mockEnforcer);
  });

  describe("Constructor", () => {
    it("should create a new AuthorizationCheckWrapper instance", () => {
      expect(wrapper).toBeInstanceOf(AuthorizationCheckWrapper);
    });

    it("should accept DMAuthorizationEnforcer dependency", () => {
      const enforcer = {} as DMAuthorizationEnforcer;
      const newWrapper = new AuthorizationCheckWrapper(enforcer);
      expect(newWrapper).toBeInstanceOf(AuthorizationCheckWrapper);
    });
  });

  describe("executeIfDMAuthorized - Authorized Cases", () => {
    beforeEach(() => {
      // Mock enforcer to return true (authorized)
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    it("should execute handler when authorized", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, "create character", handler);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return handler result when authorized", () => {
      const expectedResult = { broadcast: true, save: true };
      const handler = vi.fn(() => expectedResult);

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "create character", handler);

      expect(result).toBe(expectedResult);
    });

    it("should call enforceDMAction with correct parameters", () => {
      const handler = vi.fn(() => "result");
      const senderUid = "dm-user-456";
      const isDM = true;
      const action = "create NPC";

      wrapper.executeIfDMAuthorized(senderUid, isDM, action, handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(senderUid, isDM, action);
      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledTimes(1);
    });

    it("should handle handler returning object", () => {
      const result = { broadcast: true, save: true, data: { id: "123" } };
      const handler = () => result;

      const actual = wrapper.executeIfDMAuthorized("dm-123", true, "create prop", handler);

      expect(actual).toEqual(result);
    });

    it("should handle handler returning primitive string", () => {
      const handler = () => "success";

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "delete token", handler);

      expect(result).toBe("success");
    });

    it("should handle handler returning primitive number", () => {
      const handler = () => 42;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "update prop", handler);

      expect(result).toBe(42);
    });

    it("should handle handler returning primitive boolean", () => {
      const handler = () => true;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "place token", handler);

      expect(result).toBe(true);
    });

    it("should handle handler returning array", () => {
      const array = [1, 2, 3, 4, 5];
      const handler = () => array;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "get tokens", handler);

      expect(result).toBe(array);
    });

    it("should handle handler returning complex nested object", () => {
      const complex = {
        character: { name: "Hero", hp: 100, maxHp: 100 },
        tokens: [{ id: "t1", x: 0, y: 0 }],
        metadata: { created: new Date(), owner: "dm-123" },
      };
      const handler = () => complex;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "create scene", handler);

      expect(result).toBe(complex);
    });

    it("should execute handler exactly once even when called multiple times", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, "action 1", handler);
      wrapper.executeIfDMAuthorized("dm-123", true, "action 2", handler);
      wrapper.executeIfDMAuthorized("dm-123", true, "action 3", handler);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("should allow sequential calls with different handlers", () => {
      const handler1 = vi.fn(() => "result1");
      const handler2 = vi.fn(() => "result2");
      const handler3 = vi.fn(() => "result3");

      const result1 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler1);
      const result2 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler2);
      const result3 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler3);

      expect(result1).toBe("result1");
      expect(result2).toBe("result2");
      expect(result3).toBe("result3");
    });

    it("should preserve handler context", () => {
      let handlerExecuted = false;
      const handler = function (this: any) {
        handlerExecuted = true;
        return "result";
      };

      wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      // Handler should execute
      expect(handlerExecuted).toBe(true);
    });

    it("should handle handler with side effects", () => {
      let sideEffect = 0;
      const handler = () => {
        sideEffect = 42;
        return "done";
      };

      wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(sideEffect).toBe(42);
    });
  });

  describe("executeIfDMAuthorized - Unauthorized Cases", () => {
    beforeEach(() => {
      // Mock enforcer to return false (not authorized)
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(false);
    });

    it("should NOT execute handler when unauthorized", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("player-123", false, "create character", handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should return undefined when unauthorized", () => {
      const handler = vi.fn(() => "result");

      const result = wrapper.executeIfDMAuthorized(
        "player-123",
        false,
        "create character",
        handler,
      );

      expect(result).toBeUndefined();
    });

    it("should call enforceDMAction with correct parameters", () => {
      const handler = vi.fn(() => "result");
      const senderUid = "player-456";
      const isDM = false;
      const action = "create NPC";

      wrapper.executeIfDMAuthorized(senderUid, isDM, action, handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(senderUid, isDM, action);
      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledTimes(1);
    });

    it("should not throw error when unauthorized", () => {
      const handler = vi.fn(() => "result");

      expect(() => {
        wrapper.executeIfDMAuthorized("player-123", false, "create character", handler);
      }).not.toThrow();
    });

    it("should block multiple unauthorized attempts", () => {
      const handler = vi.fn(() => "result");

      const result1 = wrapper.executeIfDMAuthorized("player-123", false, "action 1", handler);
      const result2 = wrapper.executeIfDMAuthorized("player-123", false, "action 2", handler);
      const result3 = wrapper.executeIfDMAuthorized("player-123", false, "action 3", handler);

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(result3).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });

    it("should block unauthorized attempts from different users", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("player-1", false, "action", handler);
      wrapper.executeIfDMAuthorized("player-2", false, "action", handler);
      wrapper.executeIfDMAuthorized("player-3", false, "action", handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should not execute handler with side effects when unauthorized", () => {
      let sideEffect = 0;
      const handler = () => {
        sideEffect = 42;
        return "done";
      };

      wrapper.executeIfDMAuthorized("player-123", false, "action", handler);

      expect(sideEffect).toBe(0);
    });

    it("should return undefined even if handler would return complex object", () => {
      const handler = vi.fn(() => ({ complex: "object", data: [1, 2, 3] }));

      const result = wrapper.executeIfDMAuthorized("player-123", false, "action", handler);

      expect(result).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases - Handler Return Values", () => {
    beforeEach(() => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    it("should handle handler returning null", () => {
      const handler = () => null;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBeNull();
    });

    it("should handle handler returning undefined", () => {
      const handler = () => undefined;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBeUndefined();
    });

    it("should handle handler returning empty object", () => {
      const handler = () => ({});

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toEqual({});
    });

    it("should handle handler returning empty array", () => {
      const handler = () => [];

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toEqual([]);
    });

    it("should handle handler returning empty string", () => {
      const handler = () => "";

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBe("");
    });

    it("should handle handler returning zero", () => {
      const handler = () => 0;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBe(0);
    });

    it("should handle handler returning false", () => {
      const handler = () => false;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBe(false);
    });

    it("should handle handler returning NaN", () => {
      const handler = () => NaN;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBeNaN();
    });

    it("should handle handler returning Date object", () => {
      const date = new Date("2025-01-01");
      const handler = () => date;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBe(date);
    });

    it("should handle handler returning Promise", () => {
      const promise = Promise.resolve("async result");
      const handler = () => promise;

      const result = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result).toBe(promise);
    });
  });

  describe("Edge Cases - Handler Errors", () => {
    beforeEach(() => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    it("should propagate handler errors", () => {
      const handler = () => {
        throw new Error("Handler error");
      };

      expect(() => {
        wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      }).toThrow("Handler error");
    });

    it("should propagate handler string throws", () => {
      const handler = () => {
        throw "String error";
      };

      expect(() => {
        wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      }).toThrow("String error");
    });

    it("should propagate handler object throws", () => {
      const errorObj = { code: "ERR_123", message: "Error" };
      const handler = () => {
        throw errorObj;
      };

      expect(() => {
        wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      }).toThrow();
    });

    it("should not execute handler if enforcer throws", () => {
      const handler = vi.fn(() => "result");
      vi.mocked(mockEnforcer.enforceDMAction).mockImplementation(() => {
        throw new Error("Enforcer error");
      });

      expect(() => {
        wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      }).toThrow("Enforcer error");

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases - Parameter Values", () => {
    beforeEach(() => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    it("should handle empty string senderUid", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("", true, "action", handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith("", true, "action");
      expect(handler).toHaveBeenCalled();
    });

    it("should handle empty string action", () => {
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, "", handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith("dm-123", true, "");
      expect(handler).toHaveBeenCalled();
    });

    it("should handle very long senderUid", () => {
      const longUid = "dm-" + "x".repeat(1000);
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized(longUid, true, "action", handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(longUid, true, "action");
      expect(handler).toHaveBeenCalled();
    });

    it("should handle very long action name", () => {
      const longAction = "perform " + "complex ".repeat(100) + "action";
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, longAction, handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith("dm-123", true, longAction);
      expect(handler).toHaveBeenCalled();
    });

    it("should handle action with special characters", () => {
      const specialAction = "create character (with special chars!@#$%^&*)";
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, specialAction, handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith("dm-123", true, specialAction);
      expect(handler).toHaveBeenCalled();
    });

    it("should handle senderUid with special characters", () => {
      const specialUid = "dm-user@example.com!123";
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized(specialUid, true, "action", handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(specialUid, true, "action");
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Type Safety", () => {
    beforeEach(() => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    it("should preserve string type", () => {
      const result: string | undefined = wrapper.executeIfDMAuthorized(
        "dm-123",
        true,
        "action",
        () => "string result",
      );

      expect(typeof result).toBe("string");
      expect(result).toBe("string result");
    });

    it("should preserve number type", () => {
      const result: number | undefined = wrapper.executeIfDMAuthorized(
        "dm-123",
        true,
        "action",
        () => 42,
      );

      expect(typeof result).toBe("number");
      expect(result).toBe(42);
    });

    it("should preserve boolean type", () => {
      const result: boolean | undefined = wrapper.executeIfDMAuthorized(
        "dm-123",
        true,
        "action",
        () => true,
      );

      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });

    it("should preserve object type structure", () => {
      type ResultType = { broadcast: boolean; save: boolean };
      const result: ResultType | undefined = wrapper.executeIfDMAuthorized(
        "dm-123",
        true,
        "action",
        () => ({ broadcast: true, save: true }),
      );

      expect(result).toEqual({ broadcast: true, save: true });
    });

    it("should preserve array type", () => {
      const result: number[] | undefined = wrapper.executeIfDMAuthorized(
        "dm-123",
        true,
        "action",
        () => [1, 2, 3],
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should return undefined when unauthorized (type safety)", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(false);

      const result: string | undefined = wrapper.executeIfDMAuthorized(
        "player-123",
        false,
        "action",
        () => "never executed",
      );

      expect(result).toBeUndefined();
    });
  });

  describe("Integration with DMAuthorizationEnforcer", () => {
    it("should call enforceDMAction exactly once per call", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const handler = vi.fn(() => "result");

      wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledTimes(1);
    });

    it("should call enforceDMAction before executing handler", () => {
      const callOrder: string[] = [];
      vi.mocked(mockEnforcer.enforceDMAction).mockImplementation(() => {
        callOrder.push("enforcer");
        return true;
      });
      const handler = () => {
        callOrder.push("handler");
        return "result";
      };

      wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(callOrder).toEqual(["enforcer", "handler"]);
    });

    it("should pass exact senderUid to enforcer", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const senderUid = "exact-dm-uid-789";

      wrapper.executeIfDMAuthorized(senderUid, true, "action", () => "result");

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(
        senderUid,
        expect.any(Boolean),
        expect.any(String),
      );
    });

    it("should pass exact isDM flag to enforcer", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);

      wrapper.executeIfDMAuthorized("dm-123", true, "action", () => "result");
      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(
        expect.any(String),
        true,
        expect.any(String),
      );

      vi.mocked(mockEnforcer.enforceDMAction).mockClear();

      wrapper.executeIfDMAuthorized("player-123", false, "action", () => "result");
      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(
        expect.any(String),
        false,
        expect.any(String),
      );
    });

    it("should pass exact action to enforcer", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const action = "create special character";

      wrapper.executeIfDMAuthorized("dm-123", true, action, () => "result");

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Boolean),
        action,
      );
    });

    it("should respect enforcer return value for execution", () => {
      const handler = vi.fn(() => "result");

      // Enforcer allows
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      expect(handler).toHaveBeenCalledTimes(1);

      handler.mockClear();

      // Enforcer blocks
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(false);
      wrapper.executeIfDMAuthorized("player-123", false, "action", handler);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should call enforcer for each wrapper call", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);

      wrapper.executeIfDMAuthorized("dm-1", true, "action 1", () => "r1");
      wrapper.executeIfDMAuthorized("dm-2", true, "action 2", () => "r2");
      wrapper.executeIfDMAuthorized("dm-3", true, "action 3", () => "r3");

      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledTimes(3);
    });
  });

  describe("Real-World Action Names", () => {
    beforeEach(() => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
    });

    const realWorldActions = [
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

    realWorldActions.forEach(({ action, description }) => {
      it(`should handle DM-only action: ${description}`, () => {
        const handler = vi.fn(() => ({ broadcast: true, save: true }));

        const result = wrapper.executeIfDMAuthorized("dm-123", true, action, handler);

        expect(mockEnforcer.enforceDMAction).toHaveBeenCalledWith("dm-123", true, action);
        expect(handler).toHaveBeenCalled();
        expect(result).toEqual({ broadcast: true, save: true });
      });
    });
  });

  describe("High-Frequency Scenarios", () => {
    it("should handle rapid sequential calls", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const handler = vi.fn(() => "result");

      for (let i = 0; i < 100; i++) {
        wrapper.executeIfDMAuthorized(`dm-${i}`, true, "action", handler);
      }

      expect(handler).toHaveBeenCalledTimes(100);
      expect(mockEnforcer.enforceDMAction).toHaveBeenCalledTimes(100);
    });

    it("should handle mixed authorized and unauthorized calls", () => {
      const handler = vi.fn(() => "result");
      let authorizedCount = 0;

      vi.mocked(mockEnforcer.enforceDMAction).mockImplementation((uid, isDM) => {
        if (isDM) {
          authorizedCount++;
          return true;
        }
        return false;
      });

      // Mix of DM and player calls
      wrapper.executeIfDMAuthorized("dm-1", true, "action", handler);
      wrapper.executeIfDMAuthorized("player-1", false, "action", handler);
      wrapper.executeIfDMAuthorized("dm-2", true, "action", handler);
      wrapper.executeIfDMAuthorized("player-2", false, "action", handler);
      wrapper.executeIfDMAuthorized("dm-3", true, "action", handler);

      expect(handler).toHaveBeenCalledTimes(3); // Only DM calls
      expect(authorizedCount).toBe(3);
    });

    it("should handle same handler called multiple times", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      let callCount = 0;
      const sharedHandler = () => {
        callCount++;
        return `call ${callCount}`;
      };

      const result1 = wrapper.executeIfDMAuthorized("dm-1", true, "action", sharedHandler);
      const result2 = wrapper.executeIfDMAuthorized("dm-2", true, "action", sharedHandler);
      const result3 = wrapper.executeIfDMAuthorized("dm-3", true, "action", sharedHandler);

      expect(result1).toBe("call 1");
      expect(result2).toBe("call 2");
      expect(result3).toBe("call 3");
      expect(callCount).toBe(3);
    });

    it("should handle different actions in rapid succession", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const handler = vi.fn(() => "result");

      const actions = [
        "create character",
        "create NPC",
        "update prop",
        "delete token",
        "clear all tokens",
      ];

      actions.forEach((action) => {
        wrapper.executeIfDMAuthorized("dm-123", true, action, handler);
      });

      expect(handler).toHaveBeenCalledTimes(actions.length);
    });
  });

  describe("Statelessness", () => {
    it("should not maintain state between calls", () => {
      const handler = vi.fn(() => "result");

      // First call - blocked
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(false);
      const result1 = wrapper.executeIfDMAuthorized("user-123", false, "action", handler);
      expect(result1).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();

      handler.mockClear();

      // Second call - allowed (simulating privilege elevation)
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const result2 = wrapper.executeIfDMAuthorized("user-123", true, "action", handler);
      expect(result2).toBe("result");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should produce consistent results for same inputs", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      const handler = () => ({ value: 42 });

      const result1 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      const result2 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result1).toEqual({ value: 42 });
      expect(result2).toEqual({ value: 42 });
    });

    it("should not cache handler results", () => {
      vi.mocked(mockEnforcer.enforceDMAction).mockReturnValue(true);
      let counter = 0;
      const handler = () => ++counter;

      const result1 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      const result2 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);
      const result3 = wrapper.executeIfDMAuthorized("dm-123", true, "action", handler);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(result3).toBe(3);
    });
  });
});
