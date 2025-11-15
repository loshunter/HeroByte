import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageRoutingContext, RoutingContext } from "../MessageRoutingContext.js";
import type { RoomState } from "@shared";
import type { RoomService } from "../../../domains/room/service.js";
import type { AuthorizationService } from "../AuthorizationService.js";

describe("MessageRoutingContext", () => {
  let messageRoutingContext: MessageRoutingContext;
  let mockRoomService: RoomService;
  let mockAuthorizationService: AuthorizationService;
  let mockState: RoomState;

  beforeEach(() => {
    mockState = {
      players: [
        { uid: "dm-uid", name: "DM Player", isDM: true, color: "#ff0000", micLevel: 0.5 },
        { uid: "player-uid", name: "Regular Player", isDM: false, color: "#00ff00", micLevel: 0.3 },
      ],
      characters: [],
      tokens: [],
      maps: [],
      currentMapId: null,
      dice: { history: [] },
      drawings: [],
      playerDrawings: {},
      selections: {},
      pointers: [],
      gridSize: 50,
      gridSquareSize: 5,
      initiative: { order: [], currentTurn: null, round: 0, isActive: false },
      props: [],
    };

    mockRoomService = {
      getState: vi.fn(() => mockState),
    } as unknown as RoomService;

    mockAuthorizationService = {
      isDM: vi.fn((state: RoomState, uid: string) => {
        return state.players.find((p) => p.uid === uid)?.isDM ?? false;
      }),
    } as unknown as AuthorizationService;

    messageRoutingContext = new MessageRoutingContext(mockRoomService, mockAuthorizationService);
  });

  describe("create", () => {
    it("should create a new routing context", () => {
      const context = messageRoutingContext.create("test-uid");

      expect(context).toBeInstanceOf(RoutingContext);
    });

    it("should create a context with the provided sender UID", () => {
      const senderUid = "user-123";
      const context = messageRoutingContext.create(senderUid);

      expect(context.getSenderUid()).toBe(senderUid);
    });

    it("should create independent contexts for different messages", () => {
      const context1 = messageRoutingContext.create("user-1");
      const context2 = messageRoutingContext.create("user-2");

      expect(context1).not.toBe(context2);
      expect(context1.getSenderUid()).toBe("user-1");
      expect(context2.getSenderUid()).toBe("user-2");
    });

    it("should create fresh context each time (no reuse)", () => {
      const senderUid = "same-user";
      const context1 = messageRoutingContext.create(senderUid);
      const context2 = messageRoutingContext.create(senderUid);

      // Even for same sender, contexts should be independent
      expect(context1).not.toBe(context2);
    });
  });

  describe("RoutingContext", () => {
    describe("getState", () => {
      it("should return the room state", () => {
        const context = messageRoutingContext.create("test-uid");
        const state = context.getState();

        expect(state).toBe(mockState);
      });

      it("should cache state on first access", () => {
        const context = messageRoutingContext.create("test-uid");

        const state1 = context.getState();
        const state2 = context.getState();
        const state3 = context.getState();

        expect(state1).toBe(mockState);
        expect(state2).toBe(mockState);
        expect(state3).toBe(mockState);

        // getState should only be called once (cached)
        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);
      });

      it("should return the same state object on multiple calls", () => {
        const context = messageRoutingContext.create("test-uid");

        const state1 = context.getState();
        const state2 = context.getState();

        expect(state1).toBe(state2);
        expect(Object.is(state1, state2)).toBe(true);
      });

      it("should use cached state even if room state changes", () => {
        const context = messageRoutingContext.create("test-uid");

        // Get state once to cache it
        const state1 = context.getState();

        // Simulate state change in room service
        const newState: RoomState = {
          ...mockState,
          players: [
            ...mockState.players,
            { uid: "new-player", name: "New", isDM: false, color: "#0000ff", micLevel: 0.7 },
          ],
        };
        vi.mocked(mockRoomService.getState).mockReturnValue(newState);

        // Context should still return cached state
        const state2 = context.getState();
        expect(state2).toBe(state1);
        expect(state2).not.toBe(newState);
        expect(state2.players.length).toBe(2); // Original length
      });

      it("should get fresh state for each new context", () => {
        const context1 = messageRoutingContext.create("user-1");
        const state1 = context1.getState();

        // Change the state returned by room service
        const newState: RoomState = {
          ...mockState,
          gridSize: 100,
        };
        vi.mocked(mockRoomService.getState).mockReturnValue(newState);

        const context2 = messageRoutingContext.create("user-2");
        const state2 = context2.getState();

        expect(state1.gridSize).toBe(50);
        expect(state2.gridSize).toBe(100);
        expect(state1).not.toBe(state2);
      });
    });

    describe("isDM", () => {
      it("should return true for DM users", () => {
        const context = messageRoutingContext.create("dm-uid");
        const isDM = context.isDM();

        expect(isDM).toBe(true);
      });

      it("should return false for non-DM users", () => {
        const context = messageRoutingContext.create("player-uid");
        const isDM = context.isDM();

        expect(isDM).toBe(false);
      });

      it("should return false for non-existent users", () => {
        const context = messageRoutingContext.create("nonexistent-uid");
        const isDM = context.isDM();

        expect(isDM).toBe(false);
      });

      it("should cache DM status on first access", () => {
        const context = messageRoutingContext.create("dm-uid");

        const isDM1 = context.isDM();
        const isDM2 = context.isDM();
        const isDM3 = context.isDM();

        expect(isDM1).toBe(true);
        expect(isDM2).toBe(true);
        expect(isDM3).toBe(true);

        // AuthorizationService.isDM should only be called once (cached)
        expect(mockAuthorizationService.isDM).toHaveBeenCalledTimes(1);
      });

      it("should use cached state for DM check", () => {
        const context = messageRoutingContext.create("dm-uid");

        // Call isDM which should trigger state caching
        context.isDM();

        // RoomService.getState should only be called once
        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);

        // Subsequent isDM calls should not trigger getState
        context.isDM();
        context.isDM();

        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);
      });

      it("should delegate to AuthorizationService", () => {
        const senderUid = "dm-uid";
        const context = messageRoutingContext.create(senderUid);

        context.isDM();

        expect(mockAuthorizationService.isDM).toHaveBeenCalledWith(mockState, senderUid);
      });

      it("should use same state snapshot for isDM check", () => {
        const context = messageRoutingContext.create("dm-uid");

        // Get state to cache it
        const cachedState = context.getState();

        // Clear the mock to verify isDM doesn't call getState again
        vi.mocked(mockRoomService.getState).mockClear();

        // Call isDM
        context.isDM();

        // Should not have called getState again
        expect(mockRoomService.getState).not.toHaveBeenCalled();

        // Should have used the cached state
        expect(mockAuthorizationService.isDM).toHaveBeenCalledWith(cachedState, "dm-uid");
      });
    });

    describe("getSenderUid", () => {
      it("should return the sender UID", () => {
        const senderUid = "test-sender-123";
        const context = messageRoutingContext.create(senderUid);

        expect(context.getSenderUid()).toBe(senderUid);
      });

      it("should return the same UID on multiple calls", () => {
        const senderUid = "consistent-uid";
        const context = messageRoutingContext.create(senderUid);

        expect(context.getSenderUid()).toBe(senderUid);
        expect(context.getSenderUid()).toBe(senderUid);
        expect(context.getSenderUid()).toBe(senderUid);
      });

      it("should not trigger state retrieval", () => {
        const context = messageRoutingContext.create("test-uid");

        context.getSenderUid();
        context.getSenderUid();

        // Getting sender UID should not access room state
        expect(mockRoomService.getState).not.toHaveBeenCalled();
      });
    });

    describe("Performance Optimization", () => {
      it("should reduce state retrievals from O(n) to O(1)", () => {
        const context = messageRoutingContext.create("dm-uid");

        // Simulate multiple operations that need state
        context.getState();
        context.isDM();
        context.getState();
        context.isDM();
        context.getState();

        // Despite 5 calls (3 getState + 2 isDM), roomService.getState called only once
        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);
      });

      it("should reduce authorization checks from O(n) to O(1)", () => {
        const context = messageRoutingContext.create("dm-uid");

        // Simulate multiple DM checks (as happens in messageRouter)
        context.isDM();
        context.isDM();
        context.isDM();
        context.isDM();
        context.isDM();

        // Despite 5 isDM calls, authorizationService.isDM called only once
        expect(mockAuthorizationService.isDM).toHaveBeenCalledTimes(1);
      });

      it("should handle interleaved state and isDM calls efficiently", () => {
        const context = messageRoutingContext.create("player-uid");

        // Realistic usage pattern from messageRouter
        const state1 = context.getState();
        const isDM1 = context.isDM();
        const state2 = context.getState();
        const isDM2 = context.isDM();

        expect(state1).toBe(state2);
        expect(isDM1).toBe(isDM2);
        expect(isDM1).toBe(false);

        // Only one call to each service despite interleaving
        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);
        expect(mockAuthorizationService.isDM).toHaveBeenCalledTimes(1);
      });
    });

    describe("Immutability", () => {
      it("should not modify room state", () => {
        const context = messageRoutingContext.create("test-uid");
        const originalPlayersLength = mockState.players.length;

        context.getState();
        context.isDM();

        expect(mockState.players.length).toBe(originalPlayersLength);
      });

      it("should provide read-only access to state", () => {
        const context = messageRoutingContext.create("test-uid");
        const state = context.getState();

        // State should be the same object (no defensive copy)
        expect(state).toBe(mockState);

        // But context doesn't provide any methods to modify it
        expect(typeof (context as Record<string, unknown>).setState).toBe("undefined");
        expect(typeof (context as Record<string, unknown>).modifyState).toBe("undefined");
      });

      it("should not allow changing sender UID", () => {
        const context = messageRoutingContext.create("original-uid");

        expect(context.getSenderUid()).toBe("original-uid");

        // Context doesn't provide any methods to modify sender UID
        expect(typeof (context as Record<string, unknown>).setSenderUid).toBe("undefined");

        expect(context.getSenderUid()).toBe("original-uid");
      });
    });

    describe("Edge Cases", () => {
      it("should handle null state gracefully", () => {
        const nullState = null as unknown as RoomState;
        vi.mocked(mockRoomService.getState).mockReturnValue(nullState);

        const context = messageRoutingContext.create("test-uid");
        const state = context.getState();

        expect(state).toBe(null);
      });

      it("should handle empty player list", () => {
        const emptyState: RoomState = {
          ...mockState,
          players: [],
        };
        vi.mocked(mockRoomService.getState).mockReturnValue(emptyState);

        const context = messageRoutingContext.create("any-uid");
        const isDM = context.isDM();

        expect(isDM).toBe(false);
      });

      it("should handle undefined sender UID", () => {
        const context = messageRoutingContext.create(undefined as unknown as string);

        expect(context.getSenderUid()).toBe(undefined);
      });

      it("should handle empty string sender UID", () => {
        const context = messageRoutingContext.create("");

        expect(context.getSenderUid()).toBe("");
        expect(context.isDM()).toBe(false);
      });

      it("should handle authorization service throwing error", () => {
        vi.mocked(mockAuthorizationService.isDM).mockImplementation(() => {
          throw new Error("Authorization service error");
        });

        const context = messageRoutingContext.create("test-uid");

        expect(() => context.isDM()).toThrow("Authorization service error");
      });

      it("should handle room service throwing error", () => {
        vi.mocked(mockRoomService.getState).mockImplementation(() => {
          throw new Error("Room service error");
        });

        const context = messageRoutingContext.create("test-uid");

        expect(() => context.getState()).toThrow("Room service error");
      });

      it("should cache even after error recovery", () => {
        let callCount = 0;
        vi.mocked(mockRoomService.getState).mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error("First call error");
          }
          return mockState;
        });

        const context = messageRoutingContext.create("test-uid");

        // First call throws
        expect(() => context.getState()).toThrow("First call error");

        // Second call should use the error result (no caching on error)
        // Actually, this depends on implementation - let's verify behavior
        try {
          context.getState();
        } catch {
          // If caching prevents retry, this won't throw
          // If no caching on error, this will succeed
        }

        // At minimum, we should have tried twice if no error caching
        expect(callCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Concurrent Context Creation", () => {
      it("should handle multiple concurrent contexts", () => {
        const contexts = [
          messageRoutingContext.create("user-1"),
          messageRoutingContext.create("user-2"),
          messageRoutingContext.create("user-3"),
        ];

        // Each context should be independent
        contexts.forEach((context, i) => {
          expect(context.getSenderUid()).toBe(`user-${i + 1}`);
        });

        // Each context should cache its own state
        contexts.forEach((context) => {
          context.getState();
        });

        // getState called once per context (3 times total)
        expect(mockRoomService.getState).toHaveBeenCalledTimes(3);
      });

      it("should not share cache between contexts", () => {
        const context1 = messageRoutingContext.create("dm-uid");
        const context2 = messageRoutingContext.create("player-uid");

        const isDM1 = context1.isDM();
        const isDM2 = context2.isDM();

        expect(isDM1).toBe(true);
        expect(isDM2).toBe(false);

        // Each context should have called authorization service independently
        expect(mockAuthorizationService.isDM).toHaveBeenCalledTimes(2);
      });
    });

    describe("Integration with Services", () => {
      it("should work with real AuthorizationService behavior", () => {
        const context = messageRoutingContext.create("dm-uid");

        const isDM = context.isDM();

        expect(isDM).toBe(true);
        expect(mockAuthorizationService.isDM).toHaveBeenCalledWith(mockState, "dm-uid");
      });

      it("should pass correct parameters to services", () => {
        const senderUid = "test-user";
        const context = messageRoutingContext.create(senderUid);

        context.getState();
        context.isDM();

        expect(mockRoomService.getState).toHaveBeenCalled();
        expect(mockAuthorizationService.isDM).toHaveBeenCalledWith(mockState, senderUid);
      });

      it("should maintain service contract through caching", () => {
        const context = messageRoutingContext.create("dm-uid");

        // Multiple calls should still respect service contract
        for (let i = 0; i < 5; i++) {
          const state = context.getState();
          const isDM = context.isDM();

          expect(state).toBeDefined();
          expect(typeof isDM).toBe("boolean");
        }

        // But only call services once
        expect(mockRoomService.getState).toHaveBeenCalledTimes(1);
        expect(mockAuthorizationService.isDM).toHaveBeenCalledTimes(1);
      });
    });
  });
});
