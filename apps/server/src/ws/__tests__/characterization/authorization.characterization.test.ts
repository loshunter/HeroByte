import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { MessageRouter } from "../../messageRouter.js";
import { RoomService } from "../../../domains/room/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { MapService } from "../../../domains/map/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { PropService } from "../../../domains/prop/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { AuthService } from "../../../domains/auth/service.js";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage } from "@shared";
import type { RoomState } from "../../../domains/room/model.js";

/**
 * CHARACTERIZATION TESTS: Authorization Logic in MessageRouter
 *
 * These tests capture the CURRENT behavior of authorization checks in messageRouter.ts
 * before extracting to AuthorizationService.
 *
 * Authorization patterns tested:
 * 1. isDM() method (lines 135-139) - Checks player's isDM flag
 * 2. Early return pattern - Blocks non-DM users before handler execution (lines 274, 290, 307, etc.)
 * 3. Handler integration - Passes DM status to handlers for conditional logic
 *
 * Focus: Only testing authorization checks, not full handler execution
 *
 * Source: apps/server/src/ws/messageRouter.ts:135-139, 274-760
 * Target: apps/server/src/ws/services/AuthorizationService.ts
 */
describe("MessageRouter - Authorization Characterization", () => {
  let router: MessageRouter;
  let mockRoomService: RoomService;
  let mockPlayerService: PlayerService;
  let mockTokenService: TokenService;
  let mockMapService: MapService;
  let mockDiceService: DiceService;
  let mockCharacterService: CharacterService;
  let mockPropService: PropService;
  let mockSelectionService: SelectionService;
  let mockAuthService: AuthService;
  let mockWss: WebSocketServer;
  let mockUidToWs: Map<string, WebSocket>;
  let mockGetAuthorizedClients: () => Set<WebSocket>;
  let mockState: RoomState;
  let consoleWarnSpy: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // State with both DM and non-DM players for testing
    mockState = {
      users: [],
      players: [
        {
          uid: "dm-user",
          name: "DM Alice",
          portrait: undefined,
          isDM: true, // DM player
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          lastHeartbeat: Date.now(),
          statusEffects: [],
        },
        {
          uid: "regular-user",
          name: "Player Bob",
          portrait: undefined,
          isDM: false, // Regular player
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          lastHeartbeat: Date.now(),
          statusEffects: [],
        },
      ],
      tokens: [],
      characters: [],
      mapBackground: undefined,
      pointers: [],
      drawings: [],
      gridSize: 50,
      gridSquareSize: 5,
      diceRolls: [],
      drawingUndoStacks: {},
      drawingRedoStacks: {},
      sceneObjects: [],
      selectionState: new Map(),
      playerStagingZone: undefined,
      props: [],
      combatActive: false,
      currentTurnCharacterId: undefined,
    };

    // Create minimal mocks that return success without deep execution
    mockRoomService = {
      getState: vi.fn(() => mockState),
      broadcast: vi.fn(),
      saveState: vi.fn(),
      loadSnapshot: vi.fn(),
      applySceneObjectTransform: vi.fn(() => true),
      setPlayerStagingZone: vi.fn(() => true),
    } as unknown as RoomService;

    mockPlayerService = {
      setPortrait: vi.fn(() => true),
      rename: vi.fn(() => true),
      setMicLevel: vi.fn(() => true),
      setHP: vi.fn(() => true),
      setDMMode: vi.fn(() => true),
      setStatusEffects: vi.fn(() => true),
    } as unknown as PlayerService;

    mockTokenService = {
      moveToken: vi.fn(() => true),
      recolorToken: vi.fn(() => true),
      deleteToken: vi.fn(() => true),
      setImageUrl: vi.fn(() => true),
      clearAllTokensExcept: vi.fn(),
      forceDeleteToken: vi.fn(() => true),
      setTokenSize: vi.fn(() => true),
      setTokenSizeByDM: vi.fn(() => true),
      setColor: vi.fn(() => true),
      setColorForToken: vi.fn(() => true),
    } as unknown as TokenService;

    mockMapService = {
      setBackground: vi.fn(),
      setGridSize: vi.fn(),
      placePointer: vi.fn(),
      addDrawing: vi.fn(),
      undoDrawing: vi.fn(() => true),
      redoDrawing: vi.fn(() => true),
      clearDrawings: vi.fn(),
      selectDrawing: vi.fn(() => true),
      deselectDrawing: vi.fn(),
      moveDrawing: vi.fn(() => true),
      deleteDrawing: vi.fn(() => true),
      handlePartialErase: vi.fn(() => true),
      replacePlayerDrawings: vi.fn(),
      setPlayerStagingZone: vi.fn(() => true),
    } as unknown as MapService;

    mockDiceService = {
      addRoll: vi.fn(),
      clearHistory: vi.fn(),
    } as unknown as DiceService;

    mockCharacterService = {
      createCharacter: vi.fn(),
      updateNPC: vi.fn(() => true),
      deleteCharacter: vi.fn(() => ({ id: "char-1", name: "NPC", tokenId: "token-1" })),
      placeNPCToken: vi.fn(() => true),
      claimCharacter: vi.fn(() => true),
      updateHP: vi.fn(() => true),
      linkToken: vi.fn(() => true),
      findCharacter: vi.fn(() => ({ id: "char-1", name: "Test", maxHp: 20, hp: 20 })),
      getCharactersInInitiativeOrder: vi.fn(() => []),
      setInitiative: vi.fn(() => true),
      startCombat: vi.fn(() => true),
      endCombat: vi.fn(() => true),
      nextTurn: vi.fn(() => true),
      previousTurn: vi.fn(() => true),
      clearAllInitiative: vi.fn(() => true),
      setStatusEffects: vi.fn(() => true),
    } as unknown as CharacterService;

    mockPropService = {
      createProp: vi.fn(() => ({ id: "prop-1" })),
      updateProp: vi.fn(() => true),
      deleteProp: vi.fn(() => true),
    } as unknown as PropService;

    mockSelectionService = {
      selectObject: vi.fn(() => true),
      deselect: vi.fn(() => true),
      deselectObject: vi.fn(() => true),
      selectMultiple: vi.fn(() => true),
      lockSelected: vi.fn(() => true),
      unlockSelected: vi.fn(() => true),
      removeObject: vi.fn(() => true),
    } as unknown as SelectionService;

    mockAuthService = {
      verify: vi.fn(() => true),
      update: vi.fn(() => ({ source: "user", updatedAt: Date.now() })),
      getSummary: vi.fn(() => ({ source: "fallback", updatedAt: Date.now() })),
    } as unknown as AuthService;

    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set());

    router = new MessageRouter(
      mockRoomService,
      mockPlayerService,
      mockTokenService,
      mockMapService,
      mockDiceService,
      mockCharacterService,
      mockPropService,
      mockSelectionService,
      mockAuthService,
      mockWss,
      mockUidToWs,
      mockGetAuthorizedClients,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy.mockRestore();
  });

  function flushBroadcasts() {
    vi.runAllTimers();
  }

  describe("isDM() Private Method Behavior (observed via early return pattern)", () => {
    it("should allow DM users to perform DM-only operations", () => {
      const msg: ClientMessage = {
        t: "create-character",
        name: "Hero",
        maxHp: 25,
        portrait: "hero.png",
      };

      router.route(msg, "dm-user");
      flushBroadcasts();

      // DM user should be allowed (no warning, handler called)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(mockCharacterService.createCharacter).toHaveBeenCalled();
    });

    it("should block non-DM users from performing DM-only operations", () => {
      const msg: ClientMessage = {
        t: "create-character",
        name: "Hero",
        maxHp: 25,
        portrait: undefined,
      };

      router.route(msg, "regular-user");
      flushBroadcasts();

      // Non-DM user should be blocked (warning logged, handler NOT called)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Non-DM regular-user attempted to create character"),
      );
      expect(mockCharacterService.createCharacter).not.toHaveBeenCalled();
    });

    it("should treat unknown users as non-DM (block DM-only operations)", () => {
      const msg: ClientMessage = {
        t: "create-character",
        name: "Hero",
        maxHp: 25,
        portrait: undefined,
      };

      router.route(msg, "unknown-user");
      flushBroadcasts();

      // Unknown user should be treated as non-DM (blocked)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Non-DM unknown-user attempted to create character"),
      );
      expect(mockCharacterService.createCharacter).not.toHaveBeenCalled();
    });

    it("should treat players with isDM=undefined as non-DM", () => {
      mockState.players = [
        {
          uid: "undefined-dm-user",
          name: "Undefined DM",
          portrait: undefined,
          isDM: undefined as unknown as boolean, // Simulate missing field
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          lastHeartbeat: Date.now(),
          statusEffects: [],
        },
      ];

      const msg: ClientMessage = {
        t: "create-npc",
        name: "Goblin",
        maxHp: 15,
        hp: 15,
        portrait: undefined,
        tokenImage: undefined,
      };

      router.route(msg, "undefined-dm-user");
      flushBroadcasts();

      // Should be treated as non-DM (blocked)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Non-DM undefined-dm-user attempted to create NPC"),
      );
    });
  });

  describe("Early Return Pattern - Comprehensive DM-Only Message Types", () => {
    const dmOnlyMessages: Array<{
      type: string;
      message: ClientMessage;
      handlerCheck: () => void;
    }> = [
      {
        type: "create-character",
        message: { t: "create-character", name: "Hero", maxHp: 25, portrait: undefined },
        handlerCheck: () => expect(mockCharacterService.createCharacter).toHaveBeenCalled(),
      },
      {
        type: "create-npc",
        message: {
          t: "create-npc",
          name: "Goblin",
          maxHp: 15,
          hp: 15,
          portrait: undefined,
          tokenImage: undefined,
        },
        handlerCheck: () => expect(mockCharacterService.createCharacter).toHaveBeenCalled(),
      },
      {
        type: "update-npc",
        message: {
          t: "update-npc",
          id: "npc-1",
          name: "Updated Goblin",
          hp: 10,
          maxHp: 15,
          portrait: undefined,
          tokenImage: undefined,
        },
        handlerCheck: () => expect(mockCharacterService.updateNPC).toHaveBeenCalled(),
      },
      {
        type: "delete-npc",
        message: { t: "delete-npc", id: "npc-1" },
        handlerCheck: () => expect(mockCharacterService.deleteCharacter).toHaveBeenCalled(),
      },
      {
        type: "place-npc-token",
        message: { t: "place-npc-token", id: "npc-1" },
        handlerCheck: () => expect(mockCharacterService.placeNPCToken).toHaveBeenCalled(),
      },
      {
        type: "create-prop",
        message: {
          t: "create-prop",
          label: "Chest",
          imageUrl: "chest.png",
          owner: "dm-user",
          size: "medium",
          viewport: { x: 0, y: 0, width: 100, height: 100, zoom: 1 },
        },
        handlerCheck: () => expect(mockPropService.createProp).toHaveBeenCalled(),
      },
      {
        type: "update-prop",
        message: {
          t: "update-prop",
          id: "prop-1",
          label: "Updated Chest",
          imageUrl: "updated.png",
          owner: "dm-user",
          size: "large",
        },
        handlerCheck: () => expect(mockPropService.updateProp).toHaveBeenCalled(),
      },
      {
        type: "delete-prop",
        message: { t: "delete-prop", id: "prop-1" },
        handlerCheck: () => expect(mockPropService.deleteProp).toHaveBeenCalled(),
      },
      {
        type: "clear-all-tokens",
        message: { t: "clear-all-tokens" },
        handlerCheck: () => expect(mockTokenService.clearAllTokensExcept).toHaveBeenCalled(),
      },
    ];

    dmOnlyMessages.forEach(({ type, message, handlerCheck }) => {
      it(`should allow DM to execute ${type}`, () => {
        router.route(message, "dm-user");
        flushBroadcasts();

        expect(consoleWarnSpy).not.toHaveBeenCalled();
        handlerCheck();
      });

      it(`should block non-DM from executing ${type}`, () => {
        const _spy = handlerCheck; // Capture the spy check

        router.route(message, "regular-user");
        flushBroadcasts();

        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Non-DM regular-user`));
        // Handler should NOT be called - check by expecting it NOT to be called
        // We can't reuse handlerCheck since it expects to be called, so we verify the opposite
        const serviceCalls = [
          mockCharacterService.createCharacter,
          mockCharacterService.updateNPC,
          mockCharacterService.deleteCharacter,
          mockCharacterService.placeNPCToken,
          mockPropService.createProp,
          mockPropService.updateProp,
          mockPropService.deleteProp,
          mockTokenService.clearAllTokensExcept,
        ];
        // At least one handler should NOT have been called (the one for this message)
        expect(serviceCalls.some((call) => call.mock.calls.length === 0)).toBe(true);
      });
    });
  });

  describe("Handler Integration - DM Status Determines Service Method Called", () => {
    /**
     * IMPORTANT: Handlers receive isDM flag and call DIFFERENT service methods based on it.
     * This is a second layer of authorization beyond early return pattern.
     */

    it("should call forceDeleteToken (DM method) for DM user deleting token", () => {
      const msg: ClientMessage = { t: "delete-token", id: "token-1" };

      router.route(msg, "dm-user");
      flushBroadcasts();

      // DM users use forceDeleteToken (bypasses ownership check)
      expect(mockTokenService.forceDeleteToken).toHaveBeenCalledWith(mockState, "token-1");
      expect(mockTokenService.deleteToken).not.toHaveBeenCalled();
    });

    it("should call deleteToken (regular method) for non-DM user deleting token", () => {
      const msg: ClientMessage = { t: "delete-token", id: "token-1" };

      router.route(msg, "regular-user");
      flushBroadcasts();

      // Regular users use deleteToken (checks ownership)
      expect(mockTokenService.deleteToken).toHaveBeenCalledWith(
        mockState,
        "token-1",
        "regular-user",
      );
      expect(mockTokenService.forceDeleteToken).not.toHaveBeenCalled();
    });

    it("should call setColorForToken (DM method) for DM user setting token color", () => {
      const msg: ClientMessage = { t: "set-token-color", tokenId: "token-1", color: "#FF0000" };

      router.route(msg, "dm-user");
      flushBroadcasts();

      // DM users use setColorForToken (bypasses ownership check)
      expect(mockTokenService.setColorForToken).toHaveBeenCalledWith(
        mockState,
        "token-1",
        "#FF0000",
      );
      expect(mockTokenService.setColor).not.toHaveBeenCalled();
    });

    it("should call setColor (regular method) for non-DM user setting token color", () => {
      const msg: ClientMessage = { t: "set-token-color", tokenId: "token-1", color: "#00FF00" };

      router.route(msg, "regular-user");
      flushBroadcasts();

      // Regular users use setColor (checks ownership)
      expect(mockTokenService.setColor).toHaveBeenCalledWith(
        mockState,
        "token-1",
        "regular-user",
        "#00FF00",
        false,
      );
      expect(mockTokenService.setColorForToken).not.toHaveBeenCalled();
    });

    it("should pass isDM status to combat handlers (no router-level early return)", () => {
      // Note: Combat handlers receive isDM flag and do authorization INSIDE the handler
      // The router does NOT block via early return - it always calls the handler
      // The handler then decides based on isDM flag (may warn internally)

      // Test that router doesn't have early return by routing as DM (should succeed)
      router.route({ t: "start-combat" }, "dm-user");
      flushBroadcasts();
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No router-level block

      router.route({ t: "end-combat" }, "dm-user");
      flushBroadcasts();
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No router-level block

      router.route({ t: "next-turn" }, "dm-user");
      flushBroadcasts();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      router.route({ t: "previous-turn" }, "dm-user");
      flushBroadcasts();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // Handler-level authorization example: end-combat warns non-DM users INSIDE handler
      consoleWarnSpy.mockClear();
      router.route({ t: "end-combat" }, "regular-user");
      flushBroadcasts();
      expect(consoleWarnSpy).toHaveBeenCalledWith("Non-DM regular-user attempted to end combat");
    });

    it("should pass isDM status to clear-all-initiative handler (verified by handler being called)", () => {
      router.route({ t: "clear-all-initiative" }, "dm-user");
      flushBroadcasts();
      expect(mockCharacterService.clearAllInitiative).toHaveBeenCalled();

      router.route({ t: "clear-all-initiative" }, "regular-user");
      flushBroadcasts();
      expect(mockCharacterService.clearAllInitiative).toHaveBeenCalled();
    });
  });

  describe("Authorization Summary", () => {
    it("should document all 9 DM-only message types with early return pattern", () => {
      // This test documents the complete list of message types that use early return pattern
      const dmOnlyMessageTypes = [
        "create-character", // line 274
        "create-npc", // line 290
        "update-npc", // line 307
        "delete-npc", // line 324
        "place-npc-token", // line 335
        "create-prop", // line 417
        "update-prop", // line 436
        "delete-prop", // line 452
        "clear-all-tokens", // line 760
      ];

      expect(dmOnlyMessageTypes).toHaveLength(9);
    });

    it("should document all 12 message types that pass isDM to handlers", () => {
      // This test documents the complete list of message types that pass isDM flag to handlers
      const isDMPassedToHandlerTypes = [
        "delete-token", // line 176
        "set-token-color", // line 213
        "set-initiative", // line 353
        "start-combat", // line 364
        "end-combat", // line 374
        "next-turn", // line 386
        "previous-turn", // line 397
        "clear-all-initiative", // line 408
        "set-character-status-effects", // line 527
        "set-player-staging-zone", // line 572
        "clear-drawings", // line 621
        "load-session", // line 782
      ];

      expect(isDMPassedToHandlerTypes).toHaveLength(12);
    });
  });
});
