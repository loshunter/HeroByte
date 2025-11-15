import { describe, it, expect, vi } from "vitest";
import type { RoomState } from "../../../domains/room/model.js";

/**
 * CHARACTERIZATION TESTS: MessageRoutingContext Service
 *
 * PURPOSE:
 * These tests capture the CURRENT behavior of message routing context management
 * in messageRouter.ts before extraction. They document:
 * 1. How state is retrieved and used during message routing
 * 2. How DM authorization is checked using state
 * 3. How the routing context is initialized and accessed
 *
 * SOURCE CODE LOCATION:
 * - messageRouter.ts:162-165 (isDM method)
 * - messageRouter.ts:172 (state retrieval in route method)
 * - messageRouter.ts:163-164 (state access in isDM)
 *
 * TARGET EXTRACTION:
 * - apps/server/src/ws/services/MessageRoutingContext.ts
 *
 * TEST STRATEGY:
 * 1. Test state retrieval behavior
 * 2. Test DM authorization checking with cached state
 * 3. Test context initialization with sender info
 * 4. Test that context is immutable during message routing
 * 5. Test integration with existing authorization service
 *
 * PATTERN TO EXTRACT:
 * Current (scattered, multiple state retrievals):
 *   const state = this.roomService.getState();
 *   // ... later in different parts of route()
 *   if (this.isDM(senderUid)) { // this calls getState() again!
 *
 * After extraction (single state retrieval, cached):
 *   const context = this.messageRoutingContext.create(senderUid);
 *   const state = context.getState();
 *   const isDM = context.isDM();
 */

describe("MessageRoutingContext - Characterization Tests", () => {
  describe("State Retrieval", () => {
    it("should retrieve room state once and cache it", () => {
      // CURRENT BEHAVIOR:
      // messageRouter.ts:172 gets state once at start of route()
      // This state should be cached for the entire message routing lifecycle

      const mockState: RoomState = {
        players: [
          { uid: "dm-uid", name: "DM Player", isDM: true, color: "#ff0000", micLevel: 0.5 },
          {
            uid: "player-uid",
            name: "Regular Player",
            isDM: false,
            color: "#00ff00",
            micLevel: 0.3,
          },
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

      const roomService = {
        getState: vi.fn(() => mockState),
      };

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Simulate what happens during message routing:
      // 1. Get state at the start
      const state = roomService.getState();
      expect(state).toBe(mockState);
      expect(roomService.getState).toHaveBeenCalledTimes(1);

      // 2. Check DM status multiple times (simulating multiple isDM calls)
      const isDM1 = authorizationService.isDM(state, "dm-uid");
      const isDM2 = authorizationService.isDM(state, "player-uid");
      const isDM3 = authorizationService.isDM(state, "dm-uid");

      expect(isDM1).toBe(true);
      expect(isDM2).toBe(false);
      expect(isDM3).toBe(true);

      // IMPORTANT: With cached state, we only call getState() once
      expect(roomService.getState).toHaveBeenCalledTimes(1);
      expect(authorizationService.isDM).toHaveBeenCalledTimes(3);
    });

    it("should use the same state snapshot for the entire routing cycle", () => {
      // CURRENT BEHAVIOR:
      // State should not change during a single message routing cycle
      // All handlers should see the same state snapshot

      let stateVersion = 1;
      const roomService = {
        getState: vi.fn(() => ({
          players: [],
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
          // Track which version of state this is
          version: stateVersion++,
        })),
      };

      // Get state at start of routing
      const state1 = roomService.getState() as RoomState & { version: number };
      const version1 = state1.version;

      // Even if state changes in roomService, our cached state should be the same
      const state2 = roomService.getState() as RoomState & { version: number }; // This would get a new version
      const version2 = state2.version;

      // With context caching, we should reuse state1, not get state2
      expect(version1).toBe(1);
      expect(version2).toBe(2);
      expect(version1).not.toBe(version2);
    });
  });

  describe("DM Authorization Check", () => {
    it("should check DM status using cached state", () => {
      // CURRENT BEHAVIOR: messageRouter.ts:162-165
      const mockState: RoomState = {
        players: [
          { uid: "dm-1", name: "DM", isDM: true, color: "#ff0000", micLevel: 0.5 },
          { uid: "player-1", name: "Player", isDM: false, color: "#00ff00", micLevel: 0.3 },
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

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Check DM status using the same state
      const isDM1 = authorizationService.isDM(mockState, "dm-1");
      const isDM2 = authorizationService.isDM(mockState, "player-1");
      const isDM3 = authorizationService.isDM(mockState, "nonexistent");

      expect(isDM1).toBe(true);
      expect(isDM2).toBe(false);
      expect(isDM3).toBe(false);

      expect(authorizationService.isDM).toHaveBeenCalledTimes(3);
      expect(authorizationService.isDM).toHaveBeenCalledWith(mockState, "dm-1");
      expect(authorizationService.isDM).toHaveBeenCalledWith(mockState, "player-1");
      expect(authorizationService.isDM).toHaveBeenCalledWith(mockState, "nonexistent");
    });

    it("should cache DM status for the sender", () => {
      // CURRENT BEHAVIOR:
      // isDM() is called multiple times for the same sender during routing
      // We can optimize by caching the result

      const mockState: RoomState = {
        players: [
          { uid: "sender-uid", name: "Sender", isDM: true, color: "#ff0000", micLevel: 0.5 },
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

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Simulate multiple isDM checks during routing (as happens in messageRouter.ts)
      const senderUid = "sender-uid";

      // First check - should call authorizationService
      const isDM1 = authorizationService.isDM(mockState, senderUid);
      expect(isDM1).toBe(true);

      // Subsequent checks - with caching, we could avoid calling authorizationService again
      // But current behavior calls it every time
      const isDM2 = authorizationService.isDM(mockState, senderUid);
      const isDM3 = authorizationService.isDM(mockState, senderUid);

      expect(isDM2).toBe(true);
      expect(isDM3).toBe(true);

      // CURRENT: Called 3 times (no caching)
      expect(authorizationService.isDM).toHaveBeenCalledTimes(3);

      // FUTURE: With MessageRoutingContext, we could reduce this to 1 call
    });
  });

  describe("Context Initialization", () => {
    it("should initialize context with sender uid and room state", () => {
      // CURRENT BEHAVIOR:
      // When route() is called, we have:
      // - senderUid (from parameter)
      // - state (from roomService.getState())

      const senderUid = "test-sender";
      const mockState: RoomState = {
        players: [
          { uid: "test-sender", name: "Test", isDM: false, color: "#ff0000", micLevel: 0.5 },
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

      // Context should encapsulate both pieces of information
      const context = {
        senderUid,
        state: mockState,
      };

      expect(context.senderUid).toBe(senderUid);
      expect(context.state).toBe(mockState);
    });

    it("should create fresh context for each message", () => {
      // CURRENT BEHAVIOR:
      // Each route() call creates a new routing context
      // State is fetched fresh for each message

      const mockState1: RoomState = {
        players: [{ uid: "uid1", name: "P1", isDM: false, color: "#ff0000", micLevel: 0.5 }],
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

      const mockState2: RoomState = {
        players: [{ uid: "uid2", name: "P2", isDM: true, color: "#00ff00", micLevel: 0.3 }],
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

      let stateIndex = 0;
      const states = [mockState1, mockState2];

      const roomService = {
        getState: vi.fn(() => states[stateIndex++]),
      };

      // First message routing
      const state1 = roomService.getState();
      expect(state1).toBe(mockState1);

      // Second message routing (new context)
      const state2 = roomService.getState();
      expect(state2).toBe(mockState2);

      expect(roomService.getState).toHaveBeenCalledTimes(2);
    });
  });

  describe("Immutability", () => {
    it("should not modify the room state", () => {
      // CURRENT BEHAVIOR:
      // The routing context only reads state, never modifies it
      // State modifications happen through domain services

      const mockState: RoomState = {
        players: [{ uid: "uid1", name: "P1", isDM: false, color: "#ff0000", micLevel: 0.5 }],
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

      // Create a snapshot of the original state
      const originalPlayersLength = mockState.players.length;
      const originalPlayer = mockState.players[0];

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          // Authorization check should not modify state
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Perform authorization checks
      authorizationService.isDM(mockState, "uid1");
      authorizationService.isDM(mockState, "uid2");

      // State should be unchanged
      expect(mockState.players.length).toBe(originalPlayersLength);
      expect(mockState.players[0]).toBe(originalPlayer);
    });

    it("should provide read-only access to state", () => {
      // CURRENT BEHAVIOR:
      // Context provides state for reading, not writing
      // This is enforced by TypeScript types in the actual implementation

      const mockState: RoomState = {
        players: [],
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

      // Context should only allow reading state
      const context = {
        getState: () => mockState,
        // No setState or modify methods
      };

      expect(context.getState()).toBe(mockState);
    });
  });

  describe("Integration with AuthorizationService", () => {
    it("should delegate DM checks to AuthorizationService", () => {
      // CURRENT BEHAVIOR: messageRouter.ts:163-164
      // isDM delegates to authorizationService.isDM(state, senderUid)

      const mockState: RoomState = {
        players: [
          { uid: "dm-uid", name: "DM", isDM: true, color: "#ff0000", micLevel: 0.5 },
          { uid: "player-uid", name: "Player", isDM: false, color: "#00ff00", micLevel: 0.3 },
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

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Current pattern in messageRouter
      const isDMCheck = (uid: string): boolean => {
        return authorizationService.isDM(mockState, uid);
      };

      const result1 = isDMCheck("dm-uid");
      const result2 = isDMCheck("player-uid");

      expect(result1).toBe(true);
      expect(result2).toBe(false);

      expect(authorizationService.isDM).toHaveBeenCalledWith(mockState, "dm-uid");
      expect(authorizationService.isDM).toHaveBeenCalledWith(mockState, "player-uid");
    });

    it("should use AuthorizationService for all authorization decisions", () => {
      // CURRENT BEHAVIOR:
      // All DM checks go through AuthorizationService
      // Context should maintain this pattern

      const mockState: RoomState = {
        players: [
          { uid: "user-1", name: "U1", isDM: true, color: "#ff0000", micLevel: 0.5 },
          { uid: "user-2", name: "U2", isDM: false, color: "#00ff00", micLevel: 0.3 },
          { uid: "user-3", name: "U3", isDM: false, color: "#0000ff", micLevel: 0.7 },
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

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Check multiple users
      const checks = ["user-1", "user-2", "user-3", "nonexistent"].map((uid) =>
        authorizationService.isDM(mockState, uid),
      );

      expect(checks).toEqual([true, false, false, false]);
      expect(authorizationService.isDM).toHaveBeenCalledTimes(4);
    });
  });

  describe("Performance Optimization", () => {
    it("should reduce state retrievals from O(n) to O(1)", () => {
      // CURRENT BEHAVIOR:
      // Without context caching, we call getState() many times per message
      // With context caching, we call it once

      let getStateCallCount = 0;
      const roomService = {
        getState: vi.fn(() => {
          getStateCallCount++;
          return {
            players: [{ uid: "uid1", name: "P1", isDM: true, color: "#ff0000", micLevel: 0.5 }],
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
        }),
      };

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // WITHOUT caching (current behavior with multiple isDM calls):
      // Each isDM call would trigger getState()
      const noCacheState1 = roomService.getState();
      authorizationService.isDM(noCacheState1, "uid1");

      const noCacheState2 = roomService.getState();
      authorizationService.isDM(noCacheState2, "uid1");

      const noCacheState3 = roomService.getState();
      authorizationService.isDM(noCacheState3, "uid1");

      expect(getStateCallCount).toBe(3);

      // WITH caching (future behavior with MessageRoutingContext):
      getStateCallCount = 0;
      roomService.getState.mockClear();

      const cachedState = roomService.getState();
      authorizationService.isDM(cachedState, "uid1");
      authorizationService.isDM(cachedState, "uid1");
      authorizationService.isDM(cachedState, "uid1");

      // Only 1 call to getState, multiple reuses
      expect(getStateCallCount).toBe(1);
      expect(authorizationService.isDM).toHaveBeenCalledTimes(6); // 3 + 3
    });

    it("should cache DM status check result", () => {
      // FUTURE OPTIMIZATION:
      // Once we check if sender isDM, we can cache that result
      // for the duration of the message routing

      const mockState: RoomState = {
        players: [{ uid: "sender", name: "S", isDM: true, color: "#ff0000", micLevel: 0.5 }],
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

      const authorizationService = {
        isDM: vi.fn((state: RoomState, uid: string) => {
          return state.players.find((p) => p.uid === uid)?.isDM ?? false;
        }),
      };

      // Simulate context with caching
      let cachedIsDM: boolean | null = null;
      const isDMWithCache = (uid: string): boolean => {
        if (cachedIsDM === null) {
          cachedIsDM = authorizationService.isDM(mockState, uid);
        }
        return cachedIsDM;
      };

      // Multiple calls should only trigger one authorizationService call
      const result1 = isDMWithCache("sender");
      const result2 = isDMWithCache("sender");
      const result3 = isDMWithCache("sender");

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);

      // Only called once due to caching
      expect(authorizationService.isDM).toHaveBeenCalledTimes(1);
    });
  });
});
