/**
 * Characterization tests for SnapshotLoader
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - loadSnapshot() method (lines 70-161)
 *
 * Target: apps/server/src/domains/room/snapshot/SnapshotLoader.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../service.js";
import type { RoomSnapshot, Player, Character, PlayerStagingZone } from "@shared";

describe("SnapshotLoader - Characterization Tests", () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  describe("Player merging", () => {
    it("should merge players by UID, preserving connection metadata", () => {
      // Setup: Add currently connected player
      const currentPlayer: Player = {
        uid: "player-1",
        name: "Current Player",
        portrait: "current-portrait.png",
        micLevel: 0.75,
        lastHeartbeat: Date.now(),
        hp: 10,
        maxHp: 10,
        isDM: false,
        statusEffects: [],
      };
      roomService.setState({ players: [currentPlayer] });

      // Load snapshot with same player but different saved data
      const snapshot: RoomSnapshot = {
        users: [],
        players: [
          {
            uid: "player-1",
            name: "Saved Player Name",
            portrait: "saved-portrait.png",
            micLevel: 0.0, // This should be ignored
            lastHeartbeat: 0, // This should be ignored
            hp: 25,
            maxHp: 30,
            isDM: true,
            statusEffects: ["blessed"],
          },
        ],
        characters: [],
        tokens: [],
        props: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const mergedPlayers = roomService.getState().players;
      expect(mergedPlayers).toHaveLength(1);

      const mergedPlayer = mergedPlayers[0];
      // Saved data restored
      expect(mergedPlayer.name).toBe("Saved Player Name");
      expect(mergedPlayer.portrait).toBe("saved-portrait.png");
      expect(mergedPlayer.hp).toBe(25);
      expect(mergedPlayer.maxHp).toBe(30);
      expect(mergedPlayer.isDM).toBe(true);
      expect(mergedPlayer.statusEffects).toEqual(["blessed"]);

      // Connection metadata preserved from current state
      expect(mergedPlayer.lastHeartbeat).toBe(currentPlayer.lastHeartbeat);
      expect(mergedPlayer.micLevel).toBe(0.75);
    });

    it("should keep currently connected players not in snapshot", () => {
      // Setup: Two connected players
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Player 1",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
          {
            uid: "player-2",
            name: "Player 2",
            portrait: "",
            micLevel: 0.6,
            lastHeartbeat: Date.now(),
            hp: 15,
            maxHp: 15,
            isDM: false,
            statusEffects: [],
          },
        ],
      });

      // Load snapshot with only player-1
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [
          {
            uid: "player-1",
            name: "Player 1 Saved",
            portrait: "",
            micLevel: 0,
            lastHeartbeat: 0,
            hp: 20,
            maxHp: 20,
            isDM: false,
            statusEffects: [],
          },
        ],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const mergedPlayers = roomService.getState().players;
      expect(mergedPlayers).toHaveLength(2);

      // Player 1 merged
      const player1 = mergedPlayers.find((p) => p.uid === "player-1");
      expect(player1?.name).toBe("Player 1 Saved");

      // Player 2 kept as-is (connected but not in snapshot)
      const player2 = mergedPlayers.find((p) => p.uid === "player-2");
      expect(player2?.name).toBe("Player 2");
      expect(player2?.hp).toBe(15);
    });

    it("should handle empty players in snapshot", () => {
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Current",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      // Current player still exists (not removed)
      const players = roomService.getState().players;
      expect(players).toHaveLength(1);
      expect(players[0].uid).toBe("player-1");
    });

    it("should normalize isDM field to false if missing", () => {
      // Setup: Connected player first
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Current",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 5,
            maxHp: 5,
            isDM: false,
            statusEffects: [],
          },
        ],
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [
          {
            uid: "player-1",
            name: "Player",
            portrait: "",
            micLevel: 0,
            lastHeartbeat: 0,
            hp: 10,
            maxHp: 10,
            // isDM field omitted
            statusEffects: [],
          } as Player,
        ],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const players = roomService.getState().players;
      expect(players[0].isDM).toBe(false);
    });

    it("should normalize statusEffects to empty array if not array", () => {
      // Setup: Connected player first
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Current",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 5,
            maxHp: 5,
            isDM: false,
            statusEffects: [],
          },
        ],
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [
          {
            uid: "player-1",
            name: "Player",
            portrait: "",
            micLevel: 0,
            lastHeartbeat: 0,
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: null as unknown as string[], // Invalid value
          },
        ],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const players = roomService.getState().players;
      expect(players[0].statusEffects).toEqual([]);
    });
  });

  describe("Character merging", () => {
    it("should preserve characters owned by connected players", () => {
      // Setup: Connected player with character
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Player 1",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
        characters: [
          {
            id: "char-current",
            name: "Current Character",
            ownedByPlayerUID: "player-1",
            type: "pc",
            hp: 15,
            maxHp: 20,
            ac: 16,
            tokenId: "token-1",
            tokenImage: null,
          },
        ],
      });

      // Load snapshot with different character
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [
          {
            id: "char-saved",
            name: "Saved Character",
            ownedByPlayerUID: "player-disconnected",
            type: "pc",
            hp: 10,
            maxHp: 10,
            tokenId: null,
            tokenImage: null,
          },
        ],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const characters = roomService.getState().characters;
      expect(characters).toHaveLength(2);

      // Current player's character preserved
      const currentChar = characters.find((c) => c.id === "char-current");
      expect(currentChar).toBeDefined();
      expect(currentChar?.name).toBe("Current Character");

      // Snapshot character added (no ID conflict)
      const savedChar = characters.find((c) => c.id === "char-saved");
      expect(savedChar).toBeDefined();
    });

    it("should prevent duplicate character IDs (current wins)", () => {
      // Setup: Connected player with character
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Player 1",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
        characters: [
          {
            id: "char-1",
            name: "Current Version",
            ownedByPlayerUID: "player-1",
            type: "pc",
            hp: 20,
            maxHp: 20,
            ac: 16,
            tokenId: null,
            tokenImage: null,
          },
        ],
      });

      // Load snapshot with same character ID
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [
          {
            id: "char-1", // Same ID!
            name: "Saved Version",
            ownedByPlayerUID: "player-disconnected",
            type: "pc",
            hp: 10,
            maxHp: 10,
            tokenId: null,
            tokenImage: null,
          },
        ],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const characters = roomService.getState().characters;
      expect(characters).toHaveLength(1);

      // Current character wins (preserved, not overwritten)
      expect(characters[0].name).toBe("Current Version");
      expect(characters[0].hp).toBe(20);
    });

    it("should normalize character type to pc or npc", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [
          {
            id: "char-1",
            name: "NPC Character",
            ownedByPlayerUID: null,
            type: "npc",
            hp: 10,
            maxHp: 10,
            tokenId: null,
            tokenImage: null,
          },
          {
            id: "char-2",
            name: "PC Character",
            ownedByPlayerUID: "player-1",
            type: "invalid" as unknown as "pc" | "npc", // Invalid type
            hp: 10,
            maxHp: 10,
            tokenId: null,
            tokenImage: null,
          },
        ],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const characters = roomService.getState().characters;
      expect(characters[0].type).toBe("npc");
      expect(characters[1].type).toBe("pc"); // Invalid normalized to "pc"
    });

    it("should normalize tokenId and tokenImage to null if missing", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [
          {
            id: "char-1",
            name: "Character",
            ownedByPlayerUID: null,
            type: "npc",
            hp: 10,
            maxHp: 10,
            // tokenId and tokenImage omitted
          } as Character,
        ],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const characters = roomService.getState().characters;
      expect(characters[0].tokenId).toBeNull();
      expect(characters[0].tokenImage).toBeNull();
    });
  });

  describe("Token merging", () => {
    it("should preserve tokens owned by connected players", () => {
      // Setup: Connected player with token
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Player 1",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
        tokens: [
          {
            id: "token-current",
            owner: "player-1",
            x: 100,
            y: 200,
            color: "red",
            imageUrl: "current.png",
            size: "medium",
          },
        ],
      });

      // Load snapshot with different token
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [
          {
            id: "token-saved",
            owner: "player-disconnected",
            x: 300,
            y: 400,
            color: "blue",
            imageUrl: "saved.png",
            size: "large",
          },
        ],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const tokens = roomService.getState().tokens;
      expect(tokens).toHaveLength(2);

      // Current player's token preserved
      const currentToken = tokens.find((t) => t.id === "token-current");
      expect(currentToken).toBeDefined();
      expect(currentToken?.color).toBe("red");

      // Snapshot token added
      const savedToken = tokens.find((t) => t.id === "token-saved");
      expect(savedToken).toBeDefined();
    });

    it("should prevent duplicate token IDs (current wins)", () => {
      roomService.setState({
        players: [
          {
            uid: "player-1",
            name: "Player 1",
            portrait: "",
            micLevel: 0.5,
            lastHeartbeat: Date.now(),
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
        tokens: [
          {
            id: "token-1",
            owner: "player-1",
            x: 100,
            y: 200,
            color: "red",
            imageUrl: "current.png",
            size: "medium",
          },
        ],
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [
          {
            id: "token-1", // Same ID!
            owner: "player-disconnected",
            x: 300,
            y: 400,
            color: "blue",
            imageUrl: "saved.png",
            size: "large",
          },
        ],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const tokens = roomService.getState().tokens;
      expect(tokens).toHaveLength(1);

      // Current token wins
      expect(tokens[0].color).toBe("red");
      expect(tokens[0].owner).toBe("player-1");
    });
  });

  describe("Other state fields", () => {
    it("should load props directly from snapshot", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [
          {
            id: "prop-1",
            owner: "player-1",
            x: 100,
            y: 200,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            imageUrl: "prop.png",
            label: "Chest",
            size: "medium",
          },
        ],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      const props = roomService.getState().props;
      expect(props).toHaveLength(1);
      expect(props[0].label).toBe("Chest");
    });

    it("should clear pointers on load", () => {
      // Set current pointers
      roomService.setState({
        pointers: [
          {
            uid: "player-1",
            name: "Player 1",
            x: 100,
            y: 200,
            timestamp: Date.now(),
          },
        ],
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      // Pointers should be cleared
      expect(roomService.getState().pointers).toEqual([]);
    });

    it("should handle sceneObjects vs drawings logic", () => {
      // Case 1: sceneObjects present - drawings should be empty (even if provided)
      // Need to have tokens in snapshot so rebuildSceneGraph creates scene objects
      const snapshotWithSceneObjects: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [
          {
            id: "token-1",
            owner: "player-1",
            x: 100,
            y: 200,
            color: "red",
            imageUrl: undefined,
            size: "medium",
          },
        ],
        props: [],
        drawings: [
          {
            id: "drawing-1",
            owner: "player-1",
            points: [],
          },
        ],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [
          {
            id: "obj-1",
            type: "token",
            owner: "player-1",
            locked: false,
            zIndex: 10,
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            data: {},
          },
        ],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshotWithSceneObjects);
      // Drawings array should be empty when sceneObjects is present
      expect(roomService.getState().drawings).toEqual([]);
      // SceneObjects rebuilt from tokens (rebuildSceneGraph called at end)
      expect(roomService.getState().sceneObjects.length).toBeGreaterThan(0);

      // Case 2: No sceneObjects - drawings loaded
      roomService = new RoomService();
      const snapshotWithoutSceneObjects: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [
          {
            id: "drawing-1",
            owner: "player-1",
            points: [],
          },
        ],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshotWithoutSceneObjects);
      expect(roomService.getState().drawings).toHaveLength(1);
    });

    it("should preserve current gridSquareSize if snapshot missing it", () => {
      roomService.setState({ gridSquareSize: 10 });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        // gridSquareSize omitted
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      } as RoomSnapshot;

      roomService.loadSnapshot(snapshot);

      expect(roomService.getState().gridSquareSize).toBe(10);
    });

    it("should reset undo/redo stacks", () => {
      roomService.setState({
        drawingUndoStacks: { "player-1": [] },
        drawingRedoStacks: { "player-1": [] },
      });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      expect(roomService.getState().drawingUndoStacks).toEqual({});
      expect(roomService.getState().drawingRedoStacks).toEqual({});
    });

    it("should reset selectionState", () => {
      // Set current selections
      const selectionMap = new Map();
      selectionMap.set("player-1", { mode: "single", objectId: "obj-1" });
      roomService.setState({ selectionState: selectionMap });

      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshot);

      // Selection state should be empty Map
      expect(roomService.getState().selectionState.size).toBe(0);
    });

    it("should load combat state", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: true,
        currentTurnCharacterId: "char-123",
      };

      roomService.loadSnapshot(snapshot);

      expect(roomService.getState().combatActive).toBe(true);
      expect(roomService.getState().currentTurnCharacterId).toBe("char-123");
    });
  });

  describe("Staging zone sanitization", () => {
    it("should sanitize staging zone via StagingZoneManager", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
        playerStagingZone: {
          x: 100,
          y: 200,
          width: 300,
          height: 400,
          rotation: 45,
          scaleX: 1,
          scaleY: 1,
        },
      };

      roomService.loadSnapshot(snapshot);

      const stagingZone = roomService.getState().playerStagingZone;
      expect(stagingZone).toBeDefined();
      expect(stagingZone?.x).toBe(100);
      expect(stagingZone?.y).toBe(200);
      expect(stagingZone?.width).toBe(300);
      expect(stagingZone?.height).toBe(400);
    });

    it("should handle invalid staging zone (sanitize returns undefined)", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
        playerStagingZone: {
          x: NaN, // Invalid
          y: 200,
          width: 300,
          height: 400,
        } as PlayerStagingZone,
      };

      roomService.loadSnapshot(snapshot);

      // Sanitize should return undefined for invalid zone
      expect(roomService.getState().playerStagingZone).toBeUndefined();
    });
  });
});
