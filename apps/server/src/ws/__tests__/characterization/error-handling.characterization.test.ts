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
 * CHARACTERIZATION TESTS: Error Handling in MessageRouter
 *
 * These tests capture the CURRENT behavior of error handling in messageRouter.ts
 * before extracting to MessageErrorHandler service.
 *
 * Error handling pattern tested:
 * 1. Try-catch wraps entire switch statement (lines 148-825)
 * 2. Logs error with message type and sender UID (line 820-823)
 * 3. Logs full message details as JSON (line 824)
 * 4. Does not rethrow errors (graceful degradation)
 *
 * Focus: Only testing error handling behavior, not full message routing
 *
 * Source: apps/server/src/ws/messageRouter.ts:148-825
 * Target: apps/server/src/ws/services/MessageErrorHandler.ts
 */
describe("MessageRouter - Error Handling Characterization", () => {
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
  let consoleErrorSpy: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockState = {
      users: [],
      players: [
        {
          uid: "player-1",
          name: "Alice",
          portrait: undefined,
          isDM: false,
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
    consoleErrorSpy.mockRestore();
  });

  describe("Error Logging Format (lines 820-824)", () => {
    it("should log error with message type and sender UID when handler throws", () => {
      // Make a handler throw an error
      const testError = new Error("Test handler error");
      mockPlayerService.rename = vi.fn(() => {
        throw testError;
      });

      const msg: ClientMessage = { t: "rename", name: "NewName" };
      const senderUid = "player-1";

      // Route the message (should catch error internally)
      router.route(msg, senderUid);

      // Verify error logging format (2 console.error calls)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      // First call: Error with message type and sender
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        "[MessageRouter] Error routing message type=rename from=player-1:",
        testError,
      );

      // Second call: Full message details as JSON
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        "[MessageRouter] Message details:",
        JSON.stringify(msg),
      );
    });

    it("should include full message content in error log", () => {
      mockPlayerService.setHP = vi.fn(() => {
        throw new Error("HP error");
      });

      const msg: ClientMessage = { t: "set-hp", hp: 50, maxHp: 100 };
      router.route(msg, "player-1");

      // Verify message details are logged as JSON
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify({ t: "set-hp", hp: 50, maxHp: 100 }),
      );
    });

    it("should log complex nested message structures", () => {
      mockMapService.addDrawing = vi.fn(() => {
        throw new Error("Drawing error");
      });

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

      router.route(complexMsg, "player-1");

      // Should log full complex structure
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[MessageRouter] Message details:",
        JSON.stringify(complexMsg),
      );
    });
  });

  describe("Error Recovery Behavior", () => {
    it("should NOT rethrow errors (graceful degradation)", () => {
      mockTokenService.moveToken = vi.fn(() => {
        throw new Error("Movement failed");
      });

      const msg: ClientMessage = { t: "move", id: "token-1", x: 100, y: 200 };

      // Should NOT throw (error is caught internally)
      expect(() => {
        router.route(msg, "player-1");
      }).not.toThrow();

      // But should still log the error
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should continue processing after an error occurs", () => {
      // First message fails
      mockPlayerService.rename = vi.fn(() => {
        throw new Error("Rename failed");
      });
      router.route({ t: "rename", name: "Name1" }, "player-1");

      // Clear spy to verify next message works
      consoleErrorSpy.mockClear();
      mockPlayerService.rename = vi.fn(() => true);

      // Second message should succeed
      router.route({ t: "rename", name: "Name2" }, "player-1");

      // No error logged for second message
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(mockPlayerService.rename).toHaveBeenCalledWith(mockState, "player-1", "Name2");
    });
  });

  describe("Error Context Capture", () => {
    it("should capture error for different message types", () => {
      const messageTypes: Array<{
        msg: ClientMessage;
        mockSetup: () => void;
        expectedType: string;
      }> = [
        {
          msg: { t: "portrait", data: "portrait.png" },
          mockSetup: () => {
            mockPlayerService.setPortrait = vi.fn(() => {
              throw new Error("Portrait error");
            });
          },
          expectedType: "portrait",
        },
        {
          msg: { t: "dice-roll", roll: { formula: "1d20", result: 15 } },
          mockSetup: () => {
            mockDiceService.addRoll = vi.fn(() => {
              throw new Error("Dice error");
            });
          },
          expectedType: "dice-roll",
        },
        {
          msg: { t: "grid-size", size: 60 },
          mockSetup: () => {
            mockMapService.setGridSize = vi.fn(() => {
              throw new Error("Grid error");
            });
          },
          expectedType: "grid-size",
        },
      ];

      messageTypes.forEach(({ msg, mockSetup, expectedType }) => {
        consoleErrorSpy.mockClear();
        mockSetup();

        router.route(msg, "player-1");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(`message type=${expectedType}`),
          expect.any(Error),
        );
      });
    });

    it("should handle errors from unknown/invalid message types", () => {
      const invalidMsg = { t: "invalid-message-type" } as ClientMessage;

      // Should log warning for unknown type (not an error)
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      router.route(invalidMsg, "player-1");

      // Unknown messages log warning, not error
      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", "invalid-message-type");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Error Metadata Preservation", () => {
    it("should preserve error stack traces in logs", () => {
      const errorWithStack = new Error("Error with stack");
      mockPlayerService.setHP = vi.fn(() => {
        throw errorWithStack;
      });

      router.route({ t: "set-hp", hp: 10, maxHp: 20 }, "player-1");

      // Error object should be logged with stack trace intact
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: "Error with stack",
          stack: expect.any(String),
        }),
      );
    });

    it("should handle errors that are not Error instances", () => {
      mockTokenService.deleteToken = vi.fn(() => {
        throw "String error"; // Non-Error throw
      });

      router.route({ t: "delete-token", id: "token-1" }, "player-1");

      // Should still log (even though it's not an Error object)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("message type=delete-token"),
        "String error",
      );
    });
  });
});
