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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  const writeFileMock = vi.fn(actual.writeFile);
  const renameMock = vi.fn(actual.rename);
  return {
    ...actual,
    writeFile: writeFileMock,
    rename: renameMock,
  };
});

import * as fsPromises from "fs/promises";
import { RoomService } from "../../service.js";

const TEST_STATE_FILE = "./test-herobyte-state.json";
// A SCRATCH path, deliberately not the real "./herobyte-state.json". This
// suite unlinks, rewrites and restores its state file directly, and pointing
// that at the package-root file meant parallel workers (and the dev server)
// fought over it — the observed result was a torn file quarantined as
// herobyte-state.json.corrupt. The behaviour under test is identical; only
// the path changes, and RoomService is now given it explicitly.
const PROD_STATE_FILE = "./.tmp/state-persistence-suite.json";

describe("StatePersistence - Characterization Tests", () => {
  let roomService: RoomService;
  let originalStateFileExists = false;
  let originalStateFileContent = "";

  beforeEach(() => {
    mkdirSync(".tmp", { recursive: true });
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

    roomService = new RoomService({ stateFile: PROD_STATE_FILE });
  });

  afterEach(async () => {
    // Wait for any pending async file writes to complete
    await roomService.awaitPendingWrites();

    // Clean up test state file (and atomic-write/quarantine leftovers)
    for (const leftover of [TEST_STATE_FILE, `${PROD_STATE_FILE}.corrupt`]) {
      if (existsSync(leftover)) {
        unlinkSync(leftover);
      }
    }
    // Atomic-write leftovers now carry a pid/counter suffix.
    for (const entry of readdirSync(".tmp")) {
      if (/^state-persistence-suite\.json\.\d+\.\d+\.tmp$/.test(entry)) {
        unlinkSync(`.tmp/${entry}`);
      }
    }

    // Restore production state file if it existed
    if (originalStateFileExists) {
      writeFileSync(PROD_STATE_FILE, originalStateFileContent, "utf-8");
    } else if (existsSync(PROD_STATE_FILE)) {
      // Remove if it was created during tests
      unlinkSync(PROD_STATE_FILE);
    }
  });

  describe("published terrain (mapTerrain)", () => {
    it("persists published terrain across save/load", async () => {
      const state = roomService.getState();
      state.mapTerrain = {
        terrain: {
          schemaVersion: 1,
          palette: ["terrain:water"],
          chunks: { "0,0": [1, 1, 255, 0] },
        },
        grid: { size: 50, offsetX: 0, offsetY: 0 },
        opacity: 0.5,
      };
      roomService.saveState();
      await roomService.awaitPendingWrites();

      const restored = new RoomService({ stateFile: PROD_STATE_FILE });
      restored.loadState();

      expect(restored.getState().mapTerrain).toEqual(state.mapTerrain);
    });
  });

  describe("loadState()", () => {
    it("round-trips monsterHpDisplay through the state file, coercing garbage", () => {
      // S4: the recipient filter branches on this value, and the whole point
      // of "hidden" is defeated if a restart silently reverts it to "exact".
      roomService.getState().monsterHpDisplay = "hidden";
      roomService.saveState();
      return roomService.awaitPendingWrites().then(() => {
        const fresh = new RoomService({ stateFile: PROD_STATE_FILE });
        fresh.loadState();
        expect(fresh.getState().monsterHpDisplay).toBe("hidden");

        // And a hand-edited file cannot smuggle a fourth mode into the branch.
        const raw = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
        raw.monsterHpDisplay = "exact-but-evil";
        writeFileSync(PROD_STATE_FILE, JSON.stringify(raw));
        const poisoned = new RoomService({ stateFile: PROD_STATE_FILE });
        poisoned.loadState();
        expect(poisoned.getState().monsterHpDisplay).toBe("exact");
      });
    });

    it("round-trips diagonalRule through the state file, coercing garbage", async () => {
      // S6: the table agreed on a rule; a restart that silently reverted it
      // would change every distance on the map without telling anyone.
      roomService.getState().diagonalRule = "pathfinder";
      roomService.saveState();
      await roomService.awaitPendingWrites();

      const fresh = new RoomService({ stateFile: PROD_STATE_FILE });
      fresh.loadState();
      expect(fresh.getState().diagonalRule).toBe("pathfinder");

      // A hand-edited file cannot smuggle a fourth rule into the maths.
      const raw = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
      raw.diagonalRule = "chebyshev";
      writeFileSync(PROD_STATE_FILE, JSON.stringify(raw));
      const poisoned = new RoomService({ stateFile: PROD_STATE_FILE });
      poisoned.loadState();
      expect(poisoned.getState().diagonalRule).toBe("5e");
    });

    it("gives a file written before S6 the corrected default, not Euclidean", async () => {
      roomService.saveState();
      await roomService.awaitPendingWrites();
      const raw = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
      delete raw.diagonalRule;
      writeFileSync(PROD_STATE_FILE, JSON.stringify(raw));

      const legacy = new RoomService({ stateFile: PROD_STATE_FILE });
      legacy.loadState();
      expect(legacy.getState().diagonalRule).toBe("5e");
    });

    it("round-trips the player-props toggle, refusing a hand-edited truthy string", async () => {
      roomService.getState().playerPropsEnabled = true;
      roomService.saveState();
      await roomService.awaitPendingWrites();

      const fresh = new RoomService({ stateFile: PROD_STATE_FILE });
      fresh.loadState();
      expect(fresh.getState().playerPropsEnabled).toBe(true);

      // This flag ADMITS writes (PropDispatcher checks it), so a hand-edited
      // "yes" must read as off — `=== true`, not truthiness.
      const raw = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
      raw.playerPropsEnabled = "yes";
      writeFileSync(PROD_STATE_FILE, JSON.stringify(raw));
      const poisoned = new RoomService({ stateFile: PROD_STATE_FILE });
      poisoned.loadState();
      expect(poisoned.getState().playerPropsEnabled).toBe(false);

      // A file written before this slice has no key at all: off, the default.
      delete raw.playerPropsEnabled;
      writeFileSync(PROD_STATE_FILE, JSON.stringify(raw));
      const legacy = new RoomService({ stateFile: PROD_STATE_FILE });
      legacy.loadState();
      expect(legacy.getState().playerPropsEnabled).toBe(false);
    });

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
            tokenImage: undefined,
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(validState), "utf-8");

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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithMissingFields), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.players[0].isDM).toBe(false);
      expect(state.players[0].statusEffects).toEqual([]);
      expect(state.players[1].isDM).toBe(false);
      expect(state.players[1].statusEffects).toEqual([]);
    });

    it("should normalize character data (type, tokenImage, tokenId)", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithCharacters), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.characters[0].type).toBe("npc");
      expect(state.characters[0].tokenImage).toBeUndefined();
      expect(state.characters[0].tokenId).toBeUndefined();
      expect(state.characters[1].type).toBe("pc"); // invalid type becomes "pc"
    });

    it("should always reset users to empty array", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithUsers), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.users).toEqual([]); // Always empty, never persisted
    });

    it("should always reset pointers to empty array", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithPointers), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.pointers).toEqual([]); // Always empty, ephemeral
    });

    it("should always reset drawingUndoStacks and drawingRedoStacks to empty objects", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithUndoRedo), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.drawingUndoStacks).toEqual({});
      expect(state.drawingRedoStacks).toEqual({});
    });

    it("should always reset selectionState to empty Map", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithSelections), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.selectionState).toBeInstanceOf(Map);
      expect(state.selectionState.size).toBe(0); // Empty Map
    });

    it("should sanitize invalid staging zone data", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithInvalidZone), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should provide default values for missing fields", () => {
      const minimalState = {
        // Only required fields, others should get defaults
      };

      writeFileSync(PROD_STATE_FILE, JSON.stringify(minimalState), "utf-8");

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

    // A poisoned `tokens` is worse than a poisoned field: every broadcast
    // walks state.tokens inside the DEBOUNCED timer, outside route()'s
    // try/catch, in a process with no uncaughtException handler. Before the
    // guard, `tokens: data.tokens || []` let a non-array through and the
    // first broadcast took down the process serving every room — then did it
    // again on the next restart, because the file is still on disk.
    it.each([
      ["an object", { nope: true }],
      ["a string", "tokens"],
      ["a number", 7],
      ["true", true],
    ])("survives %s where the tokens array should be", (_label, poison) => {
      writeFileSync(PROD_STATE_FILE, JSON.stringify({ tokens: poison }), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      expect(Array.isArray(state.tokens)).toBe(true);
      expect(state.tokens).toEqual([]);
      // The collection is walked on every broadcast — prove it actually can be.
      expect(() => state.tokens.filter((token) => token.owner === "anyone")).not.toThrow();
    });

    // Tokens are the one collection this loader copies VERBATIM — no per-field
    // work at all — so the coercion here is the only thing standing between a
    // hand-edited herobyte-state.json and the vision sweep. A negative radius
    // would silently blind a player; an absurd one would hand the geometry
    // nonsense. `diagonalRule` and `monsterHpDisplay` are whitelist-coerced on
    // the same object for exactly this reason.
    it("coerces a hand-edited vision radius on the way in", () => {
      writeFileSync(
        PROD_STATE_FILE,
        JSON.stringify({
          tokens: [
            { id: "sane", owner: "p1", x: 0, y: 0, color: "red", visionRadius: 60 },
            { id: "negative", owner: "p1", x: 1, y: 0, color: "red", visionRadius: -40 },
            { id: "absurd", owner: "p1", x: 2, y: 0, color: "red", visionRadius: 1e12 },
            { id: "stringy", owner: "p1", x: 3, y: 0, color: "red", visionRadius: "60" },
          ],
        }),
        "utf-8",
      );

      roomService.loadState();
      const byId = new Map(roomService.getState().tokens.map((token) => [token.id, token]));

      expect(byId.get("sane")!.visionRadius).toBe(60);
      expect(byId.get("negative")!.visionRadius).toBe(0);
      expect(byId.get("absurd")!.visionRadius).toBe(1000);
      // Not a number at all, so it degrades to UNLIMITED — the pre-S7
      // behaviour — rather than to a garbage value or a blinded token.
      expect("visionRadius" in byId.get("stringy")!).toBe(false);
    });

    it("should handle corrupted JSON gracefully (error logged, state unchanged)", () => {
      writeFileSync(PROD_STATE_FILE, "{ this is not valid JSON }", "utf-8");

      const initialState = roomService.getState();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      roomService.loadState();
      const stateAfterLoad = roomService.getState();

      // State should remain unchanged
      expect(stateAfterLoad).toEqual(initialState);
      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load state:", expect.any(Error));

      consoleSpy.mockRestore();
    });

    it("quarantines an unreadable state file so the next save cannot destroy it", () => {
      // Before this behavior existed the loss was PERMANENT: the parse failure
      // left the room empty and the next broadcast saved empty state over the
      // only copy of the data.
      const corruptBytes = '{"tokens": [{"id": "half-written';
      writeFileSync(PROD_STATE_FILE, corruptBytes, "utf-8");

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      roomService.loadState();
      consoleSpy.mockRestore();

      // The unreadable bytes are preserved for manual recovery...
      expect(readFileSync(`${PROD_STATE_FILE}.corrupt`, "utf-8")).toBe(corruptBytes);
      // ...and the original path is clear, so subsequent saves start clean
      // instead of overwriting the evidence.
      expect(existsSync(PROD_STATE_FILE)).toBe(false);
    });

    it("should rebuild scene graph after loading state", () => {
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

      writeFileSync(PROD_STATE_FILE, JSON.stringify(stateWithStagingZone), "utf-8");

      roomService.loadState();
      const state = roomService.getState();

      // Scene graph should contain staging zone object
      const stagingZoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(stagingZoneObject).toBeDefined();
      expect(stagingZoneObject?.transform.x).toBe(50);
      expect(stagingZoneObject?.transform.y).toBe(50);
    });
  });

  describe.sequential("saveState()", () => {
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
            imageUrl: undefined,
            size: "medium",
          },
        ],
        gridSize: 60,
      });

      // Save state
      roomService.saveState();

      // Wait for async file write to complete
      await roomService.awaitPendingWrites();

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
      state.users.push("user-1");
      state.pointers.push({
        id: "pointer-1",
        name: "Player 1",
        uid: "player-1",
        x: 10,
        y: 20,
        timestamp: Date.now(),
      });
      state.drawingUndoStacks["player-1"] = [];
      state.drawingRedoStacks["player-1"] = [];

      roomService.saveState();
      await roomService.awaitPendingWrites();

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
        tokens: [
          {
            id: "token-1",
            owner: "player-1",
            x: 0,
            y: 0,
            color: "red",
            imageUrl: undefined,
            size: "medium",
          },
        ],
      });

      roomService.saveState();
      await roomService.awaitPendingWrites();

      const fileContent = readFileSync(PROD_STATE_FILE, "utf-8");

      // Check for 2-space indentation (formatted JSON)
      expect(fileContent).toContain('  "tokens"');
      expect(fileContent).toContain("    {");
    });

    it("should save all persistent fields", async () => {
      roomService.setState({
        tokens: [
          { id: "t1", owner: "p1", x: 0, y: 0, color: "red", imageUrl: undefined, size: "medium" },
        ],
        players: [
          {
            uid: "p1",
            name: "Player 1",
            portrait: undefined,
            micLevel: 0,
            hp: 10,
            maxHp: 10,
            isDM: false,
            statusEffects: [],
          },
        ],
        characters: [
          {
            id: "c1",
            type: "pc",
            name: "Hero",
            portrait: undefined,
            hp: 10,
            maxHp: 10,
            ownedByPlayerUID: "p1",
            tokenId: undefined,
            tokenImage: undefined,
          },
        ],
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
      await roomService.awaitPendingWrites();

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
      expect(savedData).toHaveProperty("playerPropsEnabled");
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
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const actualFs = await vi.importActual<typeof import("fs/promises")>("fs/promises");
      const writeFileSpy = fsPromises.writeFile as ReturnType<typeof vi.fn>;
      writeFileSpy.mockRejectedValueOnce(new Error("Disk full"));

      expect(() => roomService.saveState()).not.toThrow();
      await roomService.awaitPendingWrites();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to save state:", expect.any(Error));

      writeFileSpy.mockImplementation(actualFs.writeFile);
      consoleSpy.mockRestore();
    });

    it("persists combat state across a RESTART, not just the session export path", async () => {
      // D5: save used to omit combatActive/currentTurnCharacterId as
      // "session-specific" while the explicit session export/import kept them —
      // so a passing export round-trip was never evidence for restart safety.
      const state = roomService.getState();
      state.combatActive = true;
      state.currentTurnCharacterId = "char-goblin-3";

      roomService.saveState();
      await roomService.awaitPendingWrites();

      const restarted = new RoomService({ stateFile: PROD_STATE_FILE });
      restarted.loadState();

      expect(restarted.getState().combatActive).toBe(true);
      expect(restarted.getState().currentTurnCharacterId).toBe("char-goblin-3");
    });

    it("stages the write in a .tmp file and renames it onto the state file", async () => {
      roomService.saveState();
      await roomService.awaitPendingWrites();

      const writeFileSpy = fsPromises.writeFile as ReturnType<typeof vi.fn>;
      const renameSpy = fsPromises.rename as ReturnType<typeof vi.fn>;

      const lastWrite = writeFileSpy.mock.calls.at(-1);
      expect(String(lastWrite?.[0])).toMatch(/state-persistence-suite\.json\.\d+\.\d+\.tmp$/);

      const lastRename = renameSpy.mock.calls.at(-1);
      expect(String(lastRename?.[0])).toMatch(/state-persistence-suite\.json\.\d+\.\d+\.tmp$/);
      expect(String(lastRename?.[1])).toMatch(/state-persistence-suite\.json$/);
    });

    it("round-trips the chat log across a restart, whispers included", async () => {
      // Chat persists for the same reason initiative does. Whispers are kept
      // on disk deliberately — the file is server-local and the per-recipient
      // filter runs on the way OUT — so this asserts they survive rather than
      // quietly documenting a gap.
      const state = roomService.getState();
      state.chatLog.push(
        { id: "c1", authorUid: "u1", authorName: "Alice", text: "public", timestamp: 1 },
        { id: "c2", authorUid: "u1", authorName: "Alice", text: "private", to: "u2", timestamp: 2 },
      );

      roomService.saveState();
      await roomService.awaitPendingWrites();

      const restarted = new RoomService({ stateFile: PROD_STATE_FILE });
      restarted.loadState();

      expect(restarted.getState().chatLog).toHaveLength(2);
      expect(restarted.getState().chatLog[1]).toMatchObject({ text: "private", to: "u2" });
    });

    it("refuses to load a non-array chatLog instead of reviving a crash loop", async () => {
      // `data.chatLog || []` kept a poisoned {} ({} is truthy), so a state
      // file written before the load-session validator existed would take the
      // process down on the first broadcast after every restart.
      writeFileSync(PROD_STATE_FILE, JSON.stringify({ chatLog: { not: "an array" } }), "utf-8");

      roomService.loadState();

      expect(roomService.getState().chatLog).toEqual([]);
    });

    it("refuses to load a non-array diceRolls for the same reason", async () => {
      // chatLog got this guard when the crash was found; diceRolls kept the
      // bare `|| []` next to it. Since S5 the roll log is also read inside the
      // debounced broadcast (visibleRollsFor) and mapped in a client render
      // path, so a poisoned one is the same crash loop with a different name.
      writeFileSync(PROD_STATE_FILE, JSON.stringify({ diceRolls: { not: "an array" } }), "utf-8");

      roomService.loadState();

      expect(roomService.getState().diceRolls).toEqual([]);
      expect(() => roomService.createSnapshotForPlayer("anyone")).not.toThrow();
    });

    it("uses a tmp path unique per process AND per write", async () => {
      // A fixed `<file>.tmp` is safe only within one process. The dev server,
      // the e2e server and parallel vitest workers all default to this same
      // state file — two of them writing one shared tmp name interleave their
      // bytes, and the rename then publishes the torn result. Found in the
      // wild as a quarantined herobyte-state.json.corrupt.
      const writeFileSpy = fsPromises.writeFile as ReturnType<typeof vi.fn>;
      writeFileSpy.mockClear();

      roomService.setState({ gridSize: 71 });
      roomService.saveState();
      roomService.setState({ gridSize: 72 });
      roomService.saveState();
      await roomService.awaitPendingWrites();

      const tmpPaths = writeFileSpy.mock.calls.map(([p]) => String(p));
      expect(tmpPaths.length).toBeGreaterThanOrEqual(2);
      expect(new Set(tmpPaths).size).toBe(tmpPaths.length); // all distinct
      for (const tmpPath of tmpPaths) {
        expect(tmpPath).toContain(`.${process.pid}.`);
      }
    });

    it("a crash between write and rename leaves the previous good file intact", async () => {
      // Commit a known-good state.
      roomService.setState({ gridSize: 61 });
      roomService.saveState();
      await roomService.awaitPendingWrites();

      // Simulate dying mid-save: the tmp write lands but the rename never runs.
      const renameSpy = fsPromises.rename as ReturnType<typeof vi.fn>;
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      renameSpy.mockRejectedValueOnce(new Error("simulated crash before rename"));

      roomService.setState({ gridSize: 99 });
      roomService.saveState();
      await roomService.awaitPendingWrites();
      consoleSpy.mockRestore();

      // The state file still holds the last COMPLETED save — parseable, not torn.
      const saved = JSON.parse(readFileSync(PROD_STATE_FILE, "utf-8"));
      expect(saved.gridSize).toBe(61);

      // And the room loads cleanly from it on the next boot.
      const restarted = new RoomService({ stateFile: PROD_STATE_FILE });
      restarted.loadState();
      expect(restarted.getState().gridSize).toBe(61);
    });

    it("should serialize rapid save requests to avoid overlapping file writes", async () => {
      const actualFs = await vi.importActual<typeof import("fs/promises")>("fs/promises");
      const actualWriteFile = actualFs.writeFile;
      type WriteFileArgs = Parameters<typeof actualWriteFile>;
      let concurrentWrites = 0;
      let maxConcurrentWrites = 0;

      const writeFileSpy = fsPromises.writeFile as ReturnType<typeof vi.fn>;
      writeFileSpy.mockImplementation(async (...args: WriteFileArgs) => {
        concurrentWrites += 1;
        maxConcurrentWrites = Math.max(maxConcurrentWrites, concurrentWrites);
        // Slow down writes enough so overlapping calls would be noticeable without serialization.
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
          return await actualWriteFile(...args);
        } finally {
          concurrentWrites -= 1;
        }
      });

      // Kick off several saves without awaiting their completion.
      for (let i = 0; i < 5; i += 1) {
        roomService.setState({
          gridSize: 50 + i,
          tokens: [
            {
              id: `token-${i}`,
              owner: "player",
              x: i,
              y: i,
              color: "red",
              imageUrl: undefined,
              size: "medium",
            },
          ],
        });
        roomService.saveState();
      }

      await roomService.awaitPendingWrites();

      expect(maxConcurrentWrites).toBe(1);

      const fileContent = readFileSync(PROD_STATE_FILE, "utf-8");
      const savedData = JSON.parse(fileContent);
      expect(savedData.gridSize).toBe(54);
      expect(savedData.tokens).toHaveLength(1);
      expect(savedData.tokens[0].id).toBe("token-4");

      writeFileSpy.mockImplementation(actualWriteFile);
    });
  });
});
