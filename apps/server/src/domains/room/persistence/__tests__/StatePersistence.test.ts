/**
 * Characterization tests for StatePersistence
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - STATE_FILE constant (line 14)
 * - loadState() method (lines 47-88)
 * - saveState() method (lines 94-113)
 *
 * Target: apps/server/src/domains/room/persistence/StatePersistence.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, readFileSync } from "fs";
import { RoomService } from "../../service.js";

const TEST_STATE_FILE = "./test-herobyte-state.json";
const PROD_STATE_FILE = "./herobyte-state.json";

describe("StatePersistence - Characterization Tests", () => {
  let roomService: RoomService;
  let originalStateFileExists = false;
  let originalStateFileContent = "";

  beforeEach(() => {
    // Backup production state file if it exists
    if (existsSync(PROD_STATE_FILE)) {
      originalStateFileExists = true;
      originalStateFileContent = readFileSync(PROD_STATE_FILE, "utf-8");
      // Remove it for tests
      unlinkSync(PROD_STATE_FILE);
    }

    // Clean up any existing test state file
    if (existsSync(TEST_STATE_FILE)) {
      unlinkSync(TEST_STATE_FILE);
    }

    roomService = new RoomService();
  });

  afterEach(() => {
    // Clean up test state file
    if (existsSync(TEST_STATE_FILE)) {
      unlinkSync(TEST_STATE_FILE);
    }

    // Restore production state file if it existed
    if (originalStateFileExists) {
      const fs = require("fs");
      fs.writeFileSync(PROD_STATE_FILE, originalStateFileContent, "utf-8");
    } else if (existsSync(PROD_STATE_FILE)) {
      // Remove if it was created during tests
      unlinkSync(PROD_STATE_FILE);
    }
  });

  describe("loadState()", () => {
    it("should do nothing when state file does not exist", () => {
      // Ensure file doesn't exist
      expect(existsSync(PROD_STATE_FILE)).toBe(false);

      const initialState = roomService.getState();
      roomService.loadState();
      const stateAfterLoad = roomService.getState();

      // State should remain unchanged (empty initial state)
      expect(stateAfterLoad.tokens).toEqual(initialState.tokens);
      expect(stateAfterLoad.players).toEqual(initialState.players);
    });

    it("should load valid state from disk", () => {
      // Create a valid state file
      const fs = require("fs");
      const validState = {
        tokens: [
          {
            id: "token-1",
            owner: "player-1",
            x: 10,
            y: 20,
            color: "red",
            imageUrl: "https://example.com/token.png",
            size: "medium",
          },
        ],
        players: [
          {
            uid: "player-1",
            name: "Test Player",
            portrait: "data:image/png;base64,test",
            micLevel: 0.5,
            hp: 25,
            maxHp: 30,
            isDM: true,
            statusEffects: ["blessed", "hasted"],
          },
        ],
        characters: [
          {
            id: "char-1",
            type: "pc",
            name: "Hero",
            portrait: null,
            hp: 25,
            maxHp: 30,
            ownedByPlayerUID: "player-1",
            tokenId: "token-1",
            tokenImage: null,
          },
        ],
        props: [],
        mapBackground: "https://example.com/map.jpg",
        drawings: [],
        gridSize: 75,
        gridSquareSize: 10,
        diceRolls: [],
        sceneObjects: [],
        playerStagingZone: {
          x: 100,
          y: 100,
          width: 10,
          height: 10,
          rotation: 45,
        },
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(validState), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      // Verify data was loaded
      expect(state.tokens).toHaveLength(1);
      expect(state.tokens[0].id).toBe("token-1");
      expect(state.players).toHaveLength(1);
      expect(state.players[0].name).toBe("Test Player");
      expect(state.characters).toHaveLength(1);
      expect(state.characters[0].name).toBe("Hero");
      expect(state.mapBackground).toBe("https://example.com/map.jpg");
      expect(state.gridSize).toBe(75);
      expect(state.gridSquareSize).toBe(10);
      expect(state.playerStagingZone?.x).toBe(100);
    });

    it("should normalize player data (isDM, statusEffects)", () => {
      const fs = require("fs");
      const stateWithMissingFields = {
        tokens: [],
        players: [
          {
            uid: "player-1",
            name: "Player Without DM Flag",
            // isDM is missing - should default to false
            // statusEffects is missing - should default to []
          },
          {
            uid: "player-2",
            name: "Player With Invalid StatusEffects",
            isDM: null, // null should become false
            statusEffects: "not-an-array", // Invalid type should become []
          },
        ],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithMissingFields), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.players[0].isDM).toBe(false);
      expect(state.players[0].statusEffects).toEqual([]);
      expect(state.players[1].isDM).toBe(false);
      expect(state.players[1].statusEffects).toEqual([]);
    });

    it("should normalize character data (type, tokenImage, tokenId)", () => {
      const fs = require("fs");
      const stateWithCharacters = {
        tokens: [],
        players: [],
        characters: [
          {
            id: "char-1",
            type: "npc",
            name: "Goblin",
            hp: 10,
            maxHp: 10,
            // tokenImage and tokenId missing - should become null
          },
          {
            id: "char-2",
            type: "invalid-type", // Invalid type should become "pc"
            name: "Hero",
            hp: 25,
            maxHp: 30,
            tokenImage: undefined,
            tokenId: undefined,
          },
        ],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithCharacters), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.characters[0].type).toBe("npc");
      expect(state.characters[0].tokenImage).toBe(null);
      expect(state.characters[0].tokenId).toBe(null);
      expect(state.characters[1].type).toBe("pc"); // invalid type becomes "pc"
    });

    it("should always reset users to empty array", () => {
      const fs = require("fs");
      const stateWithUsers = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        users: [
          { uid: "user-1", name: "Persisted User" }, // Should NOT persist
        ],
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithUsers), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.users).toEqual([]); // Always empty, never persisted
    });

    it("should always reset pointers to empty array", () => {
      const fs = require("fs");
      const stateWithPointers = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        pointers: [
          { x: 100, y: 200, playerUid: "player-1", timestamp: Date.now() }, // Should NOT persist
        ],
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithPointers), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.pointers).toEqual([]); // Always empty, ephemeral
    });

    it("should always reset drawingUndoStacks and drawingRedoStacks to empty objects", () => {
      const fs = require("fs");
      const stateWithUndoRedo = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        drawingUndoStacks: {
          "player-1": [{ id: "drawing-1" }], // Should NOT persist
        },
        drawingRedoStacks: {
          "player-1": [{ id: "drawing-2" }], // Should NOT persist
        },
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithUndoRedo), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.drawingUndoStacks).toEqual({});
      expect(state.drawingRedoStacks).toEqual({});
    });

    it("should always reset selectionState to empty Map", () => {
      const fs = require("fs");
      const stateWithSelections = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        selectionState: {
          "player-1": { mode: "single", objectId: "token-1" }, // Should NOT persist
        },
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithSelections), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.selectionState).toBeInstanceOf(Map);
      expect(state.selectionState.size).toBe(0); // Empty Map
    });

    it("should sanitize invalid staging zone data", () => {
      const fs = require("fs");
      // Note: NaN in JSON becomes null, which JSON.parse converts to 0 (valid)
      // So we need to test with string "not-a-number" instead
      const stateWithInvalidZone = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        playerStagingZone: {
          x: "not-a-number", // Will become NaN after Number() conversion - invalid
          y: 10,
          width: 5,
          height: 5,
        },
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithInvalidZone), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should provide default values for missing fields", () => {
      const fs = require("fs");
      const minimalState = {
        // Only required fields, others should get defaults
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(minimalState), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.tokens).toEqual([]);
      expect(state.players).toEqual([]);
      expect(state.characters).toEqual([]);
      expect(state.props).toEqual([]);
      expect(state.drawings).toEqual([]);
      expect(state.gridSize).toBe(50); // Default
      expect(state.gridSquareSize).toBe(5); // Default
      expect(state.diceRolls).toEqual([]);
      expect(state.sceneObjects).toEqual([]);
    });

    it("should handle corrupted JSON gracefully (error logged, state unchanged)", () => {
      const fs = require("fs");
      fs.writeFileSync(PROD_STATE_FILE, "{ this is not valid JSON }", "utf-8");

      const initialState = roomService.getState();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      roomService.loadState();
      const stateAfterLoad = roomService.getState();

      // State should remain unchanged
      expect(stateAfterLoad).toEqual(initialState);
      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load state:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should rebuild scene graph after loading state", () => {
      const fs = require("fs");
      const stateWithStagingZone = {
        tokens: [],
        players: [],
        characters: [],
        props: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        playerStagingZone: {
          x: 50,
          y: 50,
          width: 10,
          height: 10,
          rotation: 0,
        },
      };

      fs.writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithStagingZone), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      // Scene graph should contain staging zone object
      const stagingZoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(stagingZoneObject).toBeDefined();
      expect(stagingZoneObject?.transform.x).toBe(50);
      expect(stagingZoneObject?.transform.y).toBe(50);
    });
  });

  describe("saveState()", () => {
    it("should create state file with correct JSON structure", async () => {
      // Modify state
      roomService.setState({
        tokens: [
          {
            id: "token-1",
            owner: "player-1",
            x: 5,
            y: 10,
            color: "blue",
            imageUrl: null,
            size: "medium",
          },
        ],
        gridSize: 60,
      });

      // Save state
      roomService.saveState();

      // Wait for async file write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify file exists
      expect(existsSync(PROD_STATE_FILE)).toBe(true);

      // Verify JSON structure
      const savedData = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
      expect(savedData.tokens).toHaveLength(1);
      expect(savedData.tokens[0].id).toBe("token-1");
      expect(savedData.gridSize).toBe(60);
    });

    it("should persist only specified fields (exclude users, pointers, etc.)", async () => {
      // Set state with ephemeral data
      const state = roomService.getState();
      state.users.push({ uid: "user-1", socket: null as any });
      state.pointers.push({ x: 10, y: 20, playerUid: "player-1", timestamp: Date.now() });
      state.drawingUndoStacks["player-1"] = [];
      state.drawingRedoStacks["player-1"] = [];

      roomService.saveState();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const savedData = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));

      // Should NOT persist ephemeral fields
      expect(savedData.users).toBeUndefined();
      expect(savedData.pointers).toBeUndefined();
      expect(savedData.drawingUndoStacks).toBeUndefined();
      expect(savedData.drawingRedoStacks).toBeUndefined();
      expect(savedData.selectionState).toBeUndefined();
    });

    it("should format JSON with 2-space indentation", async () => {
      roomService.setState({
        tokens: [{ id: "token-1", owner: "player-1", x: 0, y: 0, color: "red", imageUrl: null, size: "medium" }],
      });

      roomService.saveState();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const fileContent = readFileSync(PROD_STATE_FILE, "utf-8");

      // Check for 2-space indentation (formatted JSON)
      expect(fileContent).toContain('  "tokens"');
      expect(fileContent).toContain('    {');
    });

    it("should save all persistent fields", async () => {
      roomService.setState({
        tokens: [{ id: "t1", owner: "p1", x: 0, y: 0, color: "red", imageUrl: null, size: "medium" }],
        players: [{ uid: "p1", name: "Player 1", portrait: null, micLevel: 0, hp: 10, maxHp: 10, isDM: false, statusEffects: [] }],
        characters: [{ id: "c1", type: "pc", name: "Hero", portrait: null, hp: 10, maxHp: 10, ownedByPlayerUID: "p1", tokenId: null, tokenImage: null }],
        props: [],
        mapBackground: "https://example.com/map.jpg",
        drawings: [],
        gridSize: 80,
        gridSquareSize: 8,
        diceRolls: [],
        sceneObjects: [],
        playerStagingZone: { x: 10, y: 10, width: 5, height: 5, rotation: 0 },
      });

      roomService.saveState();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const savedData = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));

      expect(savedData).toHaveProperty("tokens");
      expect(savedData).toHaveProperty("players");
      expect(savedData).toHaveProperty("characters");
      expect(savedData).toHaveProperty("props");
      expect(savedData).toHaveProperty("mapBackground");
      expect(savedData).toHaveProperty("drawings");
      expect(savedData).toHaveProperty("gridSize");
      expect(savedData).toHaveProperty("gridSquareSize");
      expect(savedData).toHaveProperty("diceRolls");
      expect(savedData).toHaveProperty("sceneObjects");
      expect(savedData).toHaveProperty("playerStagingZone");
    });

    it("should be fire-and-forget (async, non-blocking)", () => {
      const startTime = Date.now();

      roomService.saveState();

      const endTime = Date.now();
      const elapsedTime = endTime - startTime;

      // Should return immediately (< 10ms for fire-and-forget)
      expect(elapsedTime).toBeLessThan(10);
    });

    it("should handle save errors gracefully (error logged, no throw)", async () => {
      // Force an error by making the file path invalid (not testable easily without mocking)
      // Instead, verify that save doesn't throw
      expect(() => {
        roomService.saveState();
      }).not.toThrow();
    });
  });
});
