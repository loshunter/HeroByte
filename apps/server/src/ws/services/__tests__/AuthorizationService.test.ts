import { describe, it, expect } from "vitest";
import { AuthorizationService } from "../AuthorizationService.js";
import type { RoomState } from "../../../domains/room/model.js";

describe("AuthorizationService", () => {
  let authService: AuthorizationService;
  let mockState: RoomState;

  beforeEach(() => {
    authService = new AuthorizationService();

    mockState = {
      users: [],
      players: [
        {
          uid: "dm-user",
          name: "DM Alice",
          portrait: undefined,
          isDM: true,
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
  });

  describe("isDM", () => {
    it("should return true for player with isDM flag set", () => {
      expect(authService.isDM(mockState, "dm-user")).toBe(true);
    });

    it("should return false for player without isDM flag", () => {
      expect(authService.isDM(mockState, "regular-user")).toBe(false);
    });

    it("should return false for unknown user", () => {
      expect(authService.isDM(mockState, "unknown-user")).toBe(false);
    });

    it("should return false for player with isDM=undefined", () => {
      mockState.players = [
        {
          uid: "undefined-dm",
          name: "Undefined DM",
          portrait: undefined,
          isDM: undefined as any,
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          lastHeartbeat: Date.now(),
          statusEffects: [],
        },
      ];

      expect(authService.isDM(mockState, "undefined-dm")).toBe(false);
    });

    it("should return false when players array is empty", () => {
      mockState.players = [];
      expect(authService.isDM(mockState, "any-user")).toBe(false);
    });
  });

  describe("requiresDMPrivileges", () => {
    const dmOnlyMessageTypes = [
      "create-character",
      "create-npc",
      "update-npc",
      "delete-npc",
      "place-npc-token",
      "create-prop",
      "update-prop",
      "delete-prop",
      "clear-all-tokens",
    ];

    dmOnlyMessageTypes.forEach((messageType) => {
      it(`should return true for ${messageType}`, () => {
        expect(authService.requiresDMPrivileges(messageType)).toBe(true);
      });
    });

    const nonDMMessageTypes = [
      "move",
      "recolor",
      "delete-token",
      "portrait",
      "rename",
      "mic-level",
      "set-hp",
      "claim-character",
      "add-player-character",
      "delete-player-character",
      "update-character-name",
      "update-character-hp",
      "set-character-status-effects",
      "set-initiative",
      "start-combat",
      "end-combat",
      "next-turn",
      "previous-turn",
      "clear-all-initiative",
      "map-background",
      "grid-size",
      "grid-square-size",
      "set-player-staging-zone",
      "point",
      "draw",
      "undo-drawing",
      "redo-drawing",
      "clear-drawings",
      "select-drawing",
      "deselect-drawing",
      "select-object",
      "deselect-object",
      "select-multiple",
      "lock-selected",
      "unlock-selected",
      "move-drawing",
      "delete-drawing",
      "erase-partial",
      "dice-roll",
      "clear-roll-history",
      "set-room-password",
      "load-session",
      "heartbeat",
      "transform-object",
      "rtc-signal",
      "unknown-message-type",
    ];

    nonDMMessageTypes.forEach((messageType) => {
      it(`should return false for ${messageType}`, () => {
        expect(authService.requiresDMPrivileges(messageType)).toBe(false);
      });
    });
  });

  describe("isAuthorized", () => {
    describe("for DM-only message types", () => {
      it("should return true if user is DM", () => {
        expect(authService.isAuthorized(mockState, "dm-user", "create-npc")).toBe(true);
        expect(authService.isAuthorized(mockState, "dm-user", "create-prop")).toBe(true);
        expect(authService.isAuthorized(mockState, "dm-user", "delete-npc")).toBe(true);
      });

      it("should return false if user is not DM", () => {
        expect(authService.isAuthorized(mockState, "regular-user", "create-npc")).toBe(false);
        expect(authService.isAuthorized(mockState, "regular-user", "create-prop")).toBe(false);
        expect(authService.isAuthorized(mockState, "regular-user", "delete-npc")).toBe(false);
      });

      it("should return false if user is unknown", () => {
        expect(authService.isAuthorized(mockState, "unknown-user", "create-npc")).toBe(false);
      });
    });

    describe("for non-DM message types", () => {
      it("should return true for DM user", () => {
        expect(authService.isAuthorized(mockState, "dm-user", "move")).toBe(true);
        expect(authService.isAuthorized(mockState, "dm-user", "rename")).toBe(true);
        expect(authService.isAuthorized(mockState, "dm-user", "dice-roll")).toBe(true);
      });

      it("should return true for regular user", () => {
        expect(authService.isAuthorized(mockState, "regular-user", "move")).toBe(true);
        expect(authService.isAuthorized(mockState, "regular-user", "rename")).toBe(true);
        expect(authService.isAuthorized(mockState, "regular-user", "dice-roll")).toBe(true);
      });

      it("should return true for unknown user", () => {
        expect(authService.isAuthorized(mockState, "unknown-user", "move")).toBe(true);
        expect(authService.isAuthorized(mockState, "unknown-user", "rename")).toBe(true);
      });
    });
  });
});
