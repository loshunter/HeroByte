// ============================================================================
// ROUTE RESULT HANDLER - UNIT TESTS
// ============================================================================
// Comprehensive tests for the RouteResultHandler service

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RouteResultHandler } from "../RouteResultHandler.js";

/**
 * RouteResultHandler - Unit Tests
 *
 * **Purpose:**
 * Verify that the RouteResultHandler service correctly processes message handler
 * results and executes the appropriate callbacks based on result flags.
 *
 * **Coverage:**
 * - Broadcast flag handling (true, false, undefined, truthy, falsy)
 * - Save flag handling (true, false, undefined, truthy, falsy)
 * - Both flags combinations
 * - Sequential result handling
 * - Callback execution order
 * - Edge cases and error conditions
 */
describe("RouteResultHandler", () => {
  let broadcastSpy: ReturnType<typeof vi.fn>;
  let saveSpy: ReturnType<typeof vi.fn>;
  let handler: RouteResultHandler;

  beforeEach(() => {
    broadcastSpy = vi.fn();
    saveSpy = vi.fn();
    handler = new RouteResultHandler(broadcastSpy, saveSpy);
  });

  describe("Constructor", () => {
    it("should create instance with broadcast and save callbacks", () => {
      // GIVEN: Callback functions
      const broadcast = vi.fn();
      const save = vi.fn();

      // WHEN: Creating a handler
      const h = new RouteResultHandler(broadcast, save);

      // THEN: Instance is created successfully
      expect(h).toBeInstanceOf(RouteResultHandler);
    });
  });

  describe("Broadcast Flag Handling", () => {
    it("should call broadcast callback when broadcast flag is true", () => {
      // GIVEN: A result with broadcast=true
      const result = { broadcast: true, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Broadcast callback is called once
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call broadcast callback when broadcast flag is false", () => {
      // GIVEN: A result with broadcast=false
      const result = { broadcast: false, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call broadcast callback when broadcast flag is undefined", () => {
      // GIVEN: A result with undefined broadcast flag
      const result = { save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should call broadcast callback for truthy values (number 1)", () => {
      // GIVEN: A result with broadcast=1 (truthy)
      const result = { broadcast: 1, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Broadcast callback is called
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should call broadcast callback for truthy values (string)", () => {
      // GIVEN: A result with broadcast="yes" (truthy)
      const result = { broadcast: "yes", save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Broadcast callback is called
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should call broadcast callback for truthy values (object)", () => {
      // GIVEN: A result with broadcast={} (truthy)
      const result = { broadcast: {}, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Broadcast callback is called
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call broadcast callback for falsy values (number 0)", () => {
      // GIVEN: A result with broadcast=0 (falsy)
      const result = { broadcast: 0, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call broadcast callback for falsy values (empty string)", () => {
      // GIVEN: A result with broadcast="" (falsy)
      const result = { broadcast: "", save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call broadcast callback for falsy values (null)", () => {
      // GIVEN: A result with broadcast=null (falsy)
      const result = { broadcast: null, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("Save Flag Handling", () => {
    it("should call save callback when save flag is true", () => {
      // GIVEN: A result with save=true
      const result = { broadcast: false, save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Save callback is called once
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should NOT call save callback when save flag is false", () => {
      // GIVEN: A result with save=false
      const result = { broadcast: false, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call save callback when save flag is undefined", () => {
      // GIVEN: A result with undefined save flag
      const result = { broadcast: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should call save callback for truthy values (number 1)", () => {
      // GIVEN: A result with save=1 (truthy)
      const result = { broadcast: false, save: 1 };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Save callback is called
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should call save callback for truthy values (string)", () => {
      // GIVEN: A result with save="yes" (truthy)
      const result = { broadcast: false, save: "yes" };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Save callback is called
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should call save callback for truthy values (object)", () => {
      // GIVEN: A result with save={} (truthy)
      const result = { broadcast: false, save: {} };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Save callback is called
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should NOT call save callback for falsy values (number 0)", () => {
      // GIVEN: A result with save=0 (falsy)
      const result = { broadcast: false, save: 0 };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call save callback for falsy values (empty string)", () => {
      // GIVEN: A result with save="" (falsy)
      const result = { broadcast: false, save: "" };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call save callback for falsy values (null)", () => {
      // GIVEN: A result with save=null (falsy)
      const result = { broadcast: false, save: null };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("Both Flags Together", () => {
    it("should call both callbacks when both flags are true", () => {
      // GIVEN: A result with both flags true
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Both callbacks are called once
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should call broadcast before save when both flags are true", () => {
      // GIVEN: A result with both flags true and call tracking
      const callOrder: string[] = [];
      const trackedBroadcast = vi.fn(() => callOrder.push("broadcast"));
      const trackedSave = vi.fn(() => callOrder.push("save"));
      const h = new RouteResultHandler(trackedBroadcast, trackedSave);
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result
      h.handleResult(result);

      // THEN: Broadcast is called before save
      expect(callOrder).toEqual(["broadcast", "save"]);
      expect(trackedBroadcast).toHaveBeenCalledTimes(1);
      expect(trackedSave).toHaveBeenCalledTimes(1);
    });

    it("should handle both flags with truthy values", () => {
      // GIVEN: A result with both flags as truthy non-boolean values
      const result = { broadcast: 1, save: "yes" };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Both callbacks are called
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should NOT call any callback when both flags are false", () => {
      // GIVEN: A result with both flags false
      const result = { broadcast: false, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should NOT call any callback when both flags are undefined", () => {
      // GIVEN: An empty result object
      const result = {};

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("Sequential Result Handling", () => {
    it("should handle multiple results independently", () => {
      // GIVEN: Multiple sequential results
      const results = [
        { broadcast: true, save: false },
        { broadcast: false, save: true },
        { broadcast: true, save: true },
        { broadcast: false, save: false },
      ];

      // WHEN: Handling each result
      results.forEach((result) => handler.handleResult(result));

      // THEN: Callbacks are called correct number of times
      // broadcast called in results[0] and results[2] = 2 times
      // save called in results[1] and results[2] = 2 times
      expect(broadcastSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it("should reset state between calls (no side effects)", () => {
      // GIVEN: A result that triggers broadcast
      const result1 = { broadcast: true, save: false };

      // WHEN: Handling first result
      handler.handleResult(result1);

      // THEN: Broadcast is called once
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();

      // WHEN: Clearing spies and handling a save-only result
      broadcastSpy.mockClear();
      saveSpy.mockClear();
      const result2 = { broadcast: false, save: true };
      handler.handleResult(result2);

      // THEN: Only save is called, no side effects from previous call
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid sequential calls correctly", () => {
      // GIVEN: 100 rapid calls with broadcast=true
      const result = { broadcast: true, save: false };

      // WHEN: Calling handleResult 100 times
      for (let i = 0; i < 100; i++) {
        handler.handleResult(result);
      }

      // THEN: Broadcast is called 100 times (each call is independent)
      expect(broadcastSpy).toHaveBeenCalledTimes(100);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe("Callback Execution", () => {
    it("should pass through callback exceptions without catching them", () => {
      // GIVEN: A broadcast callback that throws an error
      const errorBroadcast = vi.fn(() => {
        throw new Error("Broadcast failed");
      });
      const h = new RouteResultHandler(errorBroadcast, saveSpy);
      const result = { broadcast: true, save: true };

      // WHEN/THEN: Handling the result should throw the error
      expect(() => h.handleResult(result)).toThrow("Broadcast failed");

      // AND: The error should occur before save is called
      expect(errorBroadcast).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled(); // Never reached due to exception
    });

    it("should execute callbacks with no arguments", () => {
      // GIVEN: A result with both flags
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Callbacks are called with no arguments
      expect(broadcastSpy).toHaveBeenCalledWith();
      expect(saveSpy).toHaveBeenCalledWith();
    });

    it("should work with callbacks that return values", () => {
      // GIVEN: Callbacks that return values
      const broadcastWithReturn = vi.fn(() => "broadcasted");
      const saveWithReturn = vi.fn(() => "saved");
      const h = new RouteResultHandler(broadcastWithReturn, saveWithReturn);
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result
      h.handleResult(result);

      // THEN: Callbacks are called and return values are ignored
      expect(broadcastWithReturn).toHaveBeenCalledTimes(1);
      expect(saveWithReturn).toHaveBeenCalledTimes(1);
      expect(broadcastWithReturn).toHaveReturnedWith("broadcasted");
      expect(saveWithReturn).toHaveReturnedWith("saved");
    });

    it("should work with async callbacks (but does not await them)", () => {
      // GIVEN: Async callbacks
      const asyncBroadcast = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done";
      });
      const asyncSave = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done";
      });
      const h = new RouteResultHandler(asyncBroadcast, asyncSave);
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result (not awaited)
      h.handleResult(result);

      // THEN: Callbacks are called but not awaited (fire and forget)
      expect(asyncBroadcast).toHaveBeenCalledTimes(1);
      expect(asyncSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle results with extra properties gracefully", () => {
      // GIVEN: A result with extra properties
      const result = {
        broadcast: true,
        save: true,
        extraProp: "ignored",
        anotherProp: 123,
      };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Only broadcast and save are processed
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle results missing all properties (empty object)", () => {
      // GIVEN: An empty result object
      const result = {};

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No callbacks are called
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should handle results with only broadcast property", () => {
      // GIVEN: A result with only broadcast property
      const result = { broadcast: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Only broadcast is called
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should handle results with only save property", () => {
      // GIVEN: A result with only save property
      const result = { save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Only save is called
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });

  describe("Real-world Usage Patterns", () => {
    it("should handle typical handler result (broadcast and save)", () => {
      // GIVEN: A typical handler result requiring both actions
      const result = { broadcast: true, save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Both actions are executed
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle no-op handler result (no actions needed)", () => {
      // GIVEN: A handler result requiring no actions
      const result = { broadcast: false, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: No actions are executed
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should handle broadcast-only result (like pointer updates)", () => {
      // GIVEN: A result that only needs broadcast (e.g., pointer movement)
      const result = { broadcast: true, save: false };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Only broadcast is executed
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should handle save-only result (rare but possible)", () => {
      // GIVEN: A result that only needs save (no broadcast)
      const result = { broadcast: false, save: true };

      // WHEN: Handling the result
      handler.handleResult(result);

      // THEN: Only save is executed
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should work in high-frequency scenarios (100 sequential results)", () => {
      // GIVEN: 100 sequential results with varying flags
      const results = Array.from({ length: 100 }, (_, i) => ({
        broadcast: i % 2 === 0, // Even indices trigger broadcast
        save: i % 3 === 0, // Indices divisible by 3 trigger save
      }));

      // WHEN: Handling all results
      results.forEach((result) => handler.handleResult(result));

      // THEN: Correct number of callbacks
      // broadcast: 50 times (indices 0, 2, 4, ..., 98)
      // save: 34 times (indices 0, 3, 6, ..., 99)
      expect(broadcastSpy).toHaveBeenCalledTimes(50);
      expect(saveSpy).toHaveBeenCalledTimes(34);
    });
  });
});
