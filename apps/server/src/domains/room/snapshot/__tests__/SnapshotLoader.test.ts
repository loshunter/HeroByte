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

import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomService } from "../../service.js";
import { toSnapshot } from "../../model.js";
import type {
  RoomSnapshot,
  Player,
  Character,
  PlayerStagingZone,
  SceneObject,
  Token,
} from "@herobyte/shared";

// Scratch state file: a bare `new RoomService({ stateFile: TEST_STATE_FILE })` writes the REAL
// apps/server/herobyte-state.json, which parallel workers and the dev
// server then fight over (observed: a torn file, quarantined as .corrupt).
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "SnapshotLoader-state.json");

const seat = (uid: string, isDM: boolean): Player => ({
  uid,
  name: uid,
  portrait: "",
  micLevel: 0.5,
  lastHeartbeat: Date.now(),
  hp: 10,
  maxHp: 10,
  isDM,
  statusEffects: [],
});

/** A bare session file: only what a test names is in it. */
const fileOf = (overrides: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  users: [],
  tokens: [],
  players: [],
  characters: [],
  props: [],
  pointers: [],
  drawings: [],
  gridSize: 50,
  gridSquareSize: 5,
  diceRolls: [],
  sceneObjects: [],
  combatActive: false,
  ...overrides,
});

describe("SnapshotLoader - Characterization Tests", () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService({ stateFile: TEST_STATE_FILE });
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
      expect(mergedPlayer.statusEffects).toEqual(["blessed"]);
      // Not the DM flag: the file says DM, the room says player, and the room
      // wins — see "a restore never moves the DM seat".
      expect(mergedPlayer.isDM).toBe(false);

      // Connection metadata preserved from current state
      expect(mergedPlayer.lastHeartbeat).toBe(currentPlayer.lastHeartbeat);
      expect(mergedPlayer.micLevel).toBe(0.75);
    });

    it("a restore never changes who is in the voice call, whatever the file says", () => {
      roomService.setState({
        players: [{ ...seat("in-call", false), voice: "muted" }, { ...seat("not-in-call", false) }],
      });

      roomService.loadSnapshot(
        fileOf({
          players: [
            { ...seat("in-call", false), name: "Restored", voice: "live" },
            { ...seat("not-in-call", false), voice: "live" },
          ],
        }),
      );

      const [inCall, notInCall] = roomService.getState().players;
      expect(inCall.name).toBe("Restored");
      expect(inCall.voice).toBe("muted");
      expect(notInCall.voice).toBeUndefined();
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

    it("coerces the movement-budget fields on a loaded session", () => {
      roomService.loadSnapshot({
        ...roomService.createSnapshot(),
        characters: [
          {
            id: "c1",
            type: "pc",
            name: "Runner",
            hp: 10,
            maxHp: 10,
            speed: Number.POSITIVE_INFINITY,
            movementUsed: Number.NaN,
            movementDiagonals: 2,
          },
        ],
      });
      const loaded = roomService.getState().characters.find((c) => c.id === "c1")!;
      expect("speed" in loaded).toBe(false);
      // A loaded session is a fresh boundary: the file's spend never opens the
      // fight (review round 3 — a file saved mid-round carried its spend in).
      expect(loaded).toMatchObject({ movementUsed: 0, movementDiagonals: 0 });
      expect("movementRound" in loaded).toBe(false);
      expect(roomService.getState().combatRound).toBe(1);
    });

    it("gives a session saved before characters had condition lists its lists on load", () => {
      // settleLegacyConditionLists at the session-file door.
      roomService.setState({
        ...roomService.getState(),
        players: [{ uid: "alice", name: "Alice", statusEffects: ["poisoned"] } as Player],
      });
      roomService.loadSnapshot({
        ...roomService.createSnapshot(),
        players: [{ uid: "alice", name: "Alice", statusEffects: ["poisoned"] } as Player],
        characters: [
          { id: "a1", type: "pc", name: "Kira", hp: 1, maxHp: 1, ownedByPlayerUID: "alice" },
          { id: "a2", type: "pc", name: "Wolf", hp: 1, maxHp: 1, ownedByPlayerUID: "alice" },
        ] as Character[],
      });

      const lists = roomService
        .getState()
        .characters.filter((c) => c.ownedByPlayerUID === "alice")
        .map((c) => c.statusEffects);
      expect(lists).toEqual([[], []]);
    });

    it("a file's sole legacy character keeps its seat's list though its player is seated again", () => {
      // Settled against the FILE's seats, before the merge: seated players keep
      // their live characters, so after the merge Alice has two and the file's
      // sole Kira could no longer claim the seat's list.
      roomService.setState({
        ...roomService.getState(),
        players: [{ uid: "alice", name: "Alice", statusEffects: [] } as Player],
        characters: [
          {
            id: "live",
            type: "pc",
            name: "Fresh",
            hp: 1,
            maxHp: 1,
            ownedByPlayerUID: "alice",
            statusEffects: [],
          } as Character,
        ],
      });
      roomService.loadSnapshot({
        ...roomService.createSnapshot(),
        players: [{ uid: "alice", name: "Alice", statusEffects: ["poisoned"] } as Player],
        characters: [
          { id: "kira", type: "pc", name: "Kira", hp: 1, maxHp: 1, ownedByPlayerUID: "alice" },
        ] as Character[],
      });

      const kira = roomService.getState().characters.find((c) => c.id === "kira");
      expect(kira?.statusEffects).toEqual(["poisoned"]);
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

  // An uploaded session file is the least trustworthy source there is, and
  // tokens are merged VERBATIM out of it — no per-field work, unlike the
  // characters rebuilt directly above them in the same function. S7's sight
  // radius rides that path straight into the vision sweep, so it is coerced on
  // the way in, exactly as diagonalRule and monsterHpDisplay are.
  describe("Token vision radius coercion (S7)", () => {
    function snapshotWithTokens(tokens: unknown[]) {
      return {
        players: [],
        characters: [],
        tokens,
        props: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      } as unknown as Parameters<typeof roomService.loadSnapshot>[0];
    }

    it("keeps a sane radius", () => {
      roomService.loadSnapshot(
        snapshotWithTokens([{ id: "t", owner: "p", x: 0, y: 0, color: "red", visionRadius: 60 }]),
      );

      expect(roomService.getState().tokens[0]!.visionRadius).toBe(60);
    });

    it("clamps a radius the file put outside the range", () => {
      roomService.loadSnapshot(
        snapshotWithTokens([
          { id: "negative", owner: "p", x: 0, y: 0, color: "red", visionRadius: -40 },
          { id: "absurd", owner: "p", x: 1, y: 0, color: "red", visionRadius: 1e12 },
        ]),
      );

      const byId = new Map(roomService.getState().tokens.map((token) => [token.id, token]));
      expect(byId.get("negative")!.visionRadius).toBe(0);
      expect(byId.get("absurd")!.visionRadius).toBe(1000);
    });

    it("drops a non-numeric radius back to unlimited", () => {
      roomService.loadSnapshot(
        snapshotWithTokens([{ id: "t", owner: "p", x: 0, y: 0, color: "red", visionRadius: "60" }]),
      );

      expect("visionRadius" in roomService.getState().tokens[0]!).toBe(false);
    });
  });

  describe("NPC stance coercion — the SECOND load door", () => {
    function snapshotWithCharacters(characters: unknown[]) {
      return {
        players: [],
        characters,
        tokens: [],
        props: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
      } as unknown as Parameters<typeof roomService.loadSnapshot>[0];
    }
    const npc = { id: "n1", type: "npc", name: "Ogre", hp: 10, maxHp: 10 };

    it("keeps a stance on the list", () => {
      roomService.loadSnapshot(snapshotWithCharacters([{ ...npc, disposition: "neutral" }]));

      expect(roomService.getState().characters[0]!.disposition).toBe("neutral");
    });

    it("drops one off the list rather than letting it reach a renderer", () => {
      // The state-file door (loadCoercions) was hardened and this one was not,
      // so a hand-edited session file put an unknown stance into live state,
      // broadcast it to every client, and the card's look-up — a Record index
      // with no fallback — threw during render with no ErrorBoundary between
      // the Entities panel and the root. The whole table went blank, for
      // everyone, and it recurred on reload.
      for (const disposition of ["banana", "", 42, null, {}, ["neutral"]]) {
        roomService.loadSnapshot(snapshotWithCharacters([{ ...npc, disposition }]));
        const loaded = roomService.getState().characters[0]!;
        expect("disposition" in loaded, JSON.stringify(disposition)).toBe(false);
      }
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
            tokenId: "token-1",
            tokenImage: undefined,
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
            tokenId: undefined,
            tokenImage: undefined,
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
            tokenId: undefined,
            tokenImage: undefined,
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
            tokenId: undefined,
            tokenImage: undefined,
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
            ownedByPlayerUID: undefined,
            type: "npc",
            hp: 10,
            maxHp: 10,
            tokenId: undefined,
            tokenImage: undefined,
          },
          {
            id: "char-2",
            name: "PC Character",
            ownedByPlayerUID: "player-1",
            type: "invalid" as unknown as "pc" | "npc", // Invalid type
            hp: 10,
            maxHp: 10,
            tokenId: undefined,
            tokenImage: undefined,
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
            ownedByPlayerUID: undefined,
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

    it("never stores a PC's wire-only colour (it is derived from the token at send time)", () => {
      roomService.loadSnapshot(
        fileOf({
          characters: [{ id: "pc-1", name: "Hero", type: "pc", hp: 5, maxHp: 5, color: "#123456" }],
        }),
      );
      expect(roomService.getState().characters[0]).not.toHaveProperty("color");
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

    it("coerces the player-props toggle — boolean true only, absent means off", () => {
      const base: RoomSnapshot = {
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

      roomService.loadSnapshot({ ...base, playerPropsEnabled: true });
      expect(roomService.getState().playerPropsEnabled).toBe(true);

      // A session file is attacker-editable and this flag ADMITS writes:
      // a truthy string must not open the prop tools to the table.
      roomService.loadSnapshot({
        ...base,
        playerPropsEnabled: "yes" as unknown as boolean,
      });
      expect(roomService.getState().playerPropsEnabled).toBe(false);

      // And loading a pre-slice file switches the toggle OFF rather than
      // preserving whatever the room had — the file is authoritative, the
      // same rule mapElements settled.
      roomService.getState().playerPropsEnabled = true;
      roomService.loadSnapshot(base);
      expect(roomService.getState().playerPropsEnabled).toBe(false);
    });

    it("coerces the table sight default — clamped, junk means none, 0 survives", () => {
      const base: RoomSnapshot = {
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

      roomService.loadSnapshot({ ...base, defaultVisionRadius: 60 });
      expect(roomService.getState().defaultVisionRadius).toBe(60);

      // 0 is a real table setting — total darkness — and must survive a path
      // that is full of chances to mistake it for "unset".
      roomService.loadSnapshot({ ...base, defaultVisionRadius: 0 });
      expect(roomService.getState().defaultVisionRadius).toBe(0);

      roomService.loadSnapshot({ ...base, defaultVisionRadius: 5000 });
      expect(roomService.getState().defaultVisionRadius).toBe(1000);

      // An uploaded session file is the least trustworthy source there is.
      roomService.loadSnapshot({
        ...base,
        defaultVisionRadius: "60" as unknown as number,
      });
      expect(roomService.getState().defaultVisionRadius).toBeNull();

      // A pre-slice file clears the default rather than preserving whatever
      // the room happened to have — the file is authoritative.
      roomService.getState().defaultVisionRadius = 60;
      roomService.loadSnapshot(base);
      expect(roomService.getState().defaultVisionRadius).toBeNull();
    });

    it("should clear pointers on load", () => {
      // Set current pointers
      roomService.setState({
        pointers: [
          {
            id: "pointer-player-1",
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
      // Case 1: sceneObjects present - drawings still load (the scene graph needs them)
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
            type: "freehand",
            points: [],
            color: "#ff0000",
            width: 2,
            opacity: 1,
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
            data: { color: "red", size: "medium" },
          },
        ],
        combatActive: false,
      };

      roomService.loadSnapshot(snapshotWithSceneObjects);
      // Drawings load even with sceneObjects present: the scene graph builds drawing objects
      // only from `drawings`, so dropping them here emptied every restored table's drawings.
      expect(roomService.getState().drawings.map((d) => d.id)).toEqual(["drawing-1"]);
      // SceneObjects rebuilt from tokens (rebuildSceneGraph called at end)
      expect(roomService.getState().sceneObjects.length).toBeGreaterThan(0);

      // Case 2: No sceneObjects - drawings loaded
      roomService = new RoomService({ stateFile: TEST_STATE_FILE });
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
            type: "freehand",
            points: [],
            color: "#ff0000",
            width: 2,
            opacity: 1,
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

    it("should load combat state — the turn pointer survives when its holder stands in the order", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [
          { id: "char-123", name: "Fighter", type: "npc", ownedByPlayerUID: null, initiative: 12 },
        ],
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
      expect(
        roomService.getState().characters.find((c) => c.id === "char-123")?.movementRound,
      ).toBe(1);
    });

    it("drops a turn pointer whose holder is not in the loaded order (dropTurnPointerOutsideOrder)", () => {
      // A file can name a combatant the merge did not keep, or one with no
      // roll: the pointer rides the snapshot and would mark a non-combatant as
      // acting in every banner.
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
      expect(roomService.getState().currentTurnCharacterId).toBeUndefined();
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

  describe("Asset hydration", () => {
    it("hydrates map background and drawings from asset references", () => {
      const snapshot: RoomSnapshot = {
        users: [],
        pointers: [],
        players: [],
        characters: [],
        tokens: [],
        props: [],
        gridSize: 50,
        gridSquareSize: 5,
        diceRolls: [],
        sceneObjects: [],
        combatActive: false,
        assets: [
          {
            id: "map-background:abc",
            type: "map-background",
            hash: "abc",
            size: 10,
            payload: "https://example.com/map.png",
          },
          {
            id: "drawings:def",
            type: "drawings",
            hash: "def",
            size: 10,
            payload: [
              {
                id: "drawing-1",
                type: "freehand",
                points: [{ x: 0, y: 0 }],
                color: "#fff",
                width: 2,
                opacity: 1,
              },
            ],
          },
        ],
        assetRefs: {
          "map-background": "map-background:abc",
          drawings: "drawings:def",
        },
      };

      roomService.loadSnapshot(snapshot);
      const state = roomService.getState();
      expect(state.mapBackground).toBe("https://example.com/map.png");
      expect(state.drawings).toHaveLength(1);
      expect(state.drawings[0]?.id).toBe("drawing-1");
    });
  });

  describe("live map restore (the ephemeral-disk workaround)", () => {
    // A session file exists to carry a table across a server wipe: the deployed
    // filesystem is ephemeral, so a restart loses room state AND maps. These
    // load onto a FRESH RoomService for that reason — the earlier tests all
    // restore into a room that already has state, which is exactly the case
    // where dropping a field looks like "preserving" it and hides the bug.
    const mapElements = {
      grid: { size: 50, offsetX: 0, offsetY: 0 },
      layers: [
        {
          opacity: 1,
          elements: [
            {
              id: "tile-1",
              type: "tile" as const,
              transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
              data: { assetId: "tile:crate", columns: 1, rows: 1 },
            },
          ],
        },
      ],
    };

    function sessionSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
      return {
        users: [],
        tokens: [],
        players: [],
        characters: [],
        props: [],
        pointers: [],
        drawings: [],
        gridSize: 50,
        diceRolls: [],
        ...overrides,
      };
    }

    it("restores authored scenery onto a fresh server", () => {
      // THE BUG: mapElements was absent from the merge literal, so Object.assign
      // never wrote it. In-process that reads as "preserved"; onto a wiped
      // server it meant the walls and floor came back with every tile, stamp and
      // label silently missing.
      roomService.loadSnapshot(sessionSnapshot({ mapElements }));

      expect(roomService.getState().mapElements).toEqual(mapElements);
    });

    it("restores the live map binding onto a fresh server", () => {
      roomService.loadSnapshot(sessionSnapshot({ liveMapDocumentId: "doc-A" }));

      expect(roomService.getState().liveMapDocumentId).toBe("doc-A");
    });

    it("treats the file as authoritative — a session without a map clears one", () => {
      // Consistency with compiledScene/mapTerrain, which already behaved this
      // way. A load that replaced the walls but kept the previous room's
      // scenery would leave a map that never existed.
      roomService.loadSnapshot(sessionSnapshot({ mapElements, liveMapDocumentId: "doc-A" }));
      roomService.loadSnapshot(sessionSnapshot());

      const state = roomService.getState();
      expect(state.mapElements).toBeUndefined();
      expect(state.liveMapDocumentId).toBeUndefined();
    });

    it("round-trips the whole map channel set together", () => {
      // The four fields are one map. Restoring a subset yields a table whose
      // floor, walls and scenery disagree — worse than restoring none.
      const compiledScene = {
        schemaVersion: 1 as const,
        sourceDocumentId: "doc-A",
        sourceRevision: 2,
        compiledAt: 1,
        width: 500,
        height: 500,
        walls: [
          { id: "w#0", x1: 0, y1: 0, x2: 50, y2: 0, blocksMovement: true, blocksVision: true },
        ],
        doors: [],
        lights: [],
      };
      const mapTerrain = {
        terrain: { schemaVersion: 1 as const, palette: ["terrain:stone-floor"], chunks: {} },
        grid: { size: 50, offsetX: 0, offsetY: 0 },
        opacity: 1,
      };

      roomService.loadSnapshot(
        sessionSnapshot({ compiledScene, mapTerrain, mapElements, liveMapDocumentId: "doc-A" }),
      );

      const state = roomService.getState();
      expect({
        compiledScene: state.compiledScene,
        mapTerrain: state.mapTerrain,
        mapElements: state.mapElements,
        liveMapDocumentId: state.liveMapDocumentId,
      }).toEqual({ compiledScene, mapTerrain, mapElements, liveMapDocumentId: "doc-A" });
    });
  });

  describe("a restore never moves the DM seat", () => {
    // DM status is earned at the table, with the DM password, and lives in the
    // room's own record of the seat. A session file carries every seat's flag
    // too — and a file can be hand-edited, or belong to another night's table,
    // where someone else held the seat. "Restore" must not be a second way to
    // become the DM, or a way to lose the seat by restoring.
    const isDMOf = (uid: string) =>
      roomService.getState().players.find((player) => player.uid === uid)?.isDM;

    it("does not make a seated player the DM because the file says so", () => {
      roomService.setState({ players: [seat("dm-1", true), seat("player-1", false)] });

      roomService.loadSnapshot(fileOf({ players: [seat("dm-1", true), seat("player-1", true)] }));

      expect(isDMOf("player-1")).toBe(false);
      expect(isDMOf("dm-1")).toBe(true);
    });

    it("does not take the seat from the DM who restores a file that names them a player", () => {
      roomService.setState({ players: [seat("dm-1", true), seat("player-1", false)] });

      roomService.loadSnapshot(fileOf({ players: [seat("dm-1", false), seat("player-1", false)] }));

      expect(isDMOf("dm-1")).toBe(true);
      expect(isDMOf("player-1")).toBe(false);
    });

    it("does not seat a DM the file names who is not at the table", () => {
      roomService.setState({ players: [seat("dm-1", true)] });

      roomService.loadSnapshot(fileOf({ players: [seat("dm-1", true), seat("ghost-dm", true)] }));

      expect(roomService.getState().players.map((player) => player.uid)).toEqual(["dm-1"]);
    });
  });

  describe("a restore keeps a token only with its character", () => {
    // The merge keeps every token a SEATED uid owns, and the DM owns the token of
    // each NPC they placed — but an NPC's record belongs to the file, not to a
    // seat. Keep the token of a character the file dropped and it is left on the
    // map with no character behind it, and so no hidden flag: the players are
    // sent it, image and all, however secret the monster was.
    const pcToken: Token = {
      id: "tok-pc",
      owner: "player-1",
      x: 1,
      y: 1,
      color: "red",
      size: "medium",
    };
    const pc: Character = {
      id: "char-pc",
      name: "Hero",
      type: "pc",
      ownedByPlayerUID: "player-1",
      hp: 10,
      maxHp: 10,
      tokenId: "tok-pc",
      tokenImage: undefined,
    };
    const mimicToken: Token = {
      id: "tok-mimic",
      owner: "dm-1",
      x: 9,
      y: 9,
      color: "blue",
      imageUrl: "/tokens/mimic-chest.webp",
      size: "medium",
    };
    const mimic: Character = {
      id: "npc-mimic",
      name: "Mimic",
      type: "npc",
      hp: 30,
      maxHp: 30,
      tokenId: "tok-mimic",
      tokenImage: undefined,
      visibleToPlayers: false,
    };
    const seatTheTable = () =>
      roomService.setState({
        players: [seat("dm-1", true), seat("player-1", false)],
        characters: [pc, mimic],
        tokens: [pcToken, mimicToken],
      });
    const tokenIds = () =>
      roomService
        .getState()
        .tokens.map((token) => token.id)
        .sort();

    it("drops the token of an NPC the file does not have, and keeps a seated player's own", () => {
      seatTheTable();

      // A backup from before the mimic was placed.
      roomService.loadSnapshot(fileOf({ players: [seat("dm-1", true), seat("player-1", false)] }));

      const state = roomService.getState();
      expect(state.characters.map((character) => character.id)).toEqual(["char-pc"]);
      expect(tokenIds()).toEqual(["tok-pc"]);
    });

    it("never sends a player the token of a hidden monster the restore removed", () => {
      seatTheTable();

      roomService.loadSnapshot(fileOf({ players: [seat("dm-1", true), seat("player-1", false)] }));

      const playerView = toSnapshot(roomService.getState(), false, "player-1");
      expect(playerView.tokens.map((token) => token.id)).toEqual(["tok-pc"]);
      expect(JSON.stringify(playerView)).not.toContain("mimic-chest");
    });

    it("drops the token of an NPC the file points at a different token", () => {
      seatTheTable();
      const fileToken: Token = {
        id: "tok-file",
        owner: "someone-gone",
        x: 2,
        y: 2,
        color: "green",
        size: "medium",
      };

      roomService.loadSnapshot(
        fileOf({
          players: [seat("dm-1", true), seat("player-1", false)],
          characters: [{ ...mimic, tokenId: "tok-file" }],
          tokens: [fileToken],
        }),
      );

      const npc = roomService.getState().characters.find((c) => c.id === "npc-mimic");
      expect(npc?.tokenId).toBe("tok-file");
      expect(tokenIds()).toEqual(["tok-file", "tok-pc"]);
    });

    it("keeps the live token of an NPC the file also has, where it stands now", () => {
      seatTheTable();
      const backedUp = { ...mimicToken, x: 0, y: 0 };

      roomService.loadSnapshot(
        fileOf({
          players: [seat("dm-1", true), seat("player-1", false)],
          characters: [mimic],
          tokens: [backedUp],
        }),
      );

      const tokens = roomService.getState().tokens.filter((token) => token.id === "tok-mimic");
      expect(tokens).toHaveLength(1);
      expect([tokens[0].x, tokens[0].y]).toEqual([9, 9]);
    });
  });

  describe("a restore leaves a seated player's tokens as they are", () => {
    // "Players already seated keep their own characters and tokens as they are now" is what the
    // confirm says. A token follows its character on the file's side too, and its lock, scale and
    // rotation live in the scene object, which the file's list used to replace.
    const mine: Token = {
      id: "tok-me",
      owner: "player-1",
      x: 3,
      y: 4,
      color: "red",
      size: "medium",
    };
    const hero: Character = {
      id: "char-me",
      name: "Hero",
      type: "pc",
      ownedByPlayerUID: "player-1",
      hp: 10,
      maxHp: 10,
      tokenId: "tok-me",
      tokenImage: undefined,
    };
    const sceneOf = (tokenId: string, overrides: Partial<SceneObject> = {}): SceneObject =>
      ({
        id: `token:${tokenId}`,
        type: "token",
        owner: "player-1",
        locked: false,
        zIndex: 10,
        transform: { x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { color: "red", size: "medium" },
        ...overrides,
      }) as SceneObject;
    const sceneFor = (tokenId: string) =>
      roomService.getState().sceneObjects.find((object) => object.id === `token:${tokenId}`);
    const tokenIds = () =>
      roomService
        .getState()
        .tokens.map((token) => token.id)
        .sort();
    const seated = () => [seat("player-1", false)];

    it("does not add the file's token for a character the room already has", () => {
      // The live character wins over the file's, and points at the live token; the file's token
      // for the same character would be a second, character-less one the player controls.
      roomService.setState({ players: seated(), characters: [hero], tokens: [mine] });
      const oldToken: Token = { ...mine, id: "tok-old", x: 9, y: 9 };

      roomService.loadSnapshot(
        fileOf({
          players: seated(),
          characters: [{ ...hero, tokenId: "tok-old" }],
          tokens: [oldToken],
        }),
      );

      expect(tokenIds()).toEqual(["tok-me"]);
      expect(roomService.getState().characters.find((c) => c.id === "char-me")?.tokenId).toBe(
        "tok-me",
      );
    });

    it("still adds a file token no character points at, and the token of a file character it carries", () => {
      roomService.setState({ players: seated(), characters: [hero], tokens: [mine] });
      const loose: Token = { id: "tok-loose", owner: "someone-gone", x: 1, y: 1, color: "green" };
      const goblin: Character = {
        id: "npc-goblin",
        name: "Goblin",
        type: "npc",
        hp: 7,
        maxHp: 7,
        tokenId: "tok-goblin",
        tokenImage: undefined,
      };
      const goblinToken: Token = { id: "tok-goblin", owner: "dm-1", x: 5, y: 5, color: "blue" };

      roomService.loadSnapshot(
        fileOf({
          players: seated(),
          characters: [goblin],
          tokens: [loose, goblinToken],
        }),
      );

      expect(tokenIds()).toEqual(["tok-goblin", "tok-loose", "tok-me"]);
    });

    it("keeps the lock, scale and rotation a seated player's token has now, not the file's", () => {
      roomService.setState({
        players: seated(),
        characters: [hero],
        tokens: [mine],
        sceneObjects: [sceneOf("tok-me")],
      });

      roomService.loadSnapshot(
        fileOf({
          players: seated(),
          characters: [hero],
          tokens: [{ ...mine, x: 0, y: 0 }],
          sceneObjects: [
            sceneOf("tok-me", {
              locked: true,
              transform: { x: 0, y: 0, scaleX: 3, scaleY: 3, rotation: 90 },
            }),
          ],
        }),
      );

      const kept = sceneFor("tok-me");
      expect([kept?.locked, kept?.transform.scaleX, kept?.transform.rotation]).toEqual([
        false,
        1,
        0,
      ]);
      // And where it stands is the live token's.
      expect([kept?.transform.x, kept?.transform.y]).toEqual([3, 4]);
    });

    it("keeps the scene state of a token the file does not list at all", () => {
      roomService.setState({
        players: seated(),
        characters: [hero],
        tokens: [mine],
        sceneObjects: [
          sceneOf("tok-me", {
            locked: true,
            transform: { x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 45 },
          }),
        ],
      });

      roomService.loadSnapshot(fileOf({ players: seated() }));

      const kept = sceneFor("tok-me");
      expect([kept?.locked, kept?.transform.rotation]).toEqual([true, 45]);
    });

    it("says in its log how many of the room's tokens it kept", () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        roomService.setState({
          players: seated(),
          characters: [hero],
          tokens: [mine, { id: "tok-npc", owner: "player-1", x: 8, y: 8, color: "blue" }],
        });
        // The second token is a seated player's, but its NPC is not in the file: it goes.
        roomService.setState({
          characters: [
            hero,
            {
              id: "npc-1",
              name: "Imp",
              type: "npc",
              hp: 3,
              maxHp: 3,
              tokenId: "tok-npc",
              tokenImage: undefined,
            },
          ],
        });

        roomService.loadSnapshot(fileOf({ players: seated() }));

        const said = log.mock.calls.map((call) => String(call[0])).join("\n");
        expect(said).toContain("preserved 1 current tokens");
      } finally {
        log.mockRestore();
      }
    });
  });
});
