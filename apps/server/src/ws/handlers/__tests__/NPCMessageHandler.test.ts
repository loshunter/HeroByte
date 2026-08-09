/**
 * Characterization tests for NPCMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-npc (lines 237-252)
 * - update-npc (lines 254-271)
 * - delete-npc (lines 273-288)
 * - place-npc-token (lines 290-301)
 *
 * Target: apps/server/src/ws/handlers/NPCMessageHandler.ts
 */

import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
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
import type { ClientMessage } from "@herobyte/shared";
import type { WebSocketServer, WebSocket } from "ws";

// Isolated state file. A bare `new RoomService({ stateFile: TEST_STATE_FILE })` writes the REAL
// apps/server/herobyte-state.json — the same file the dev server reads —
// so parallel vitest workers tore it and polluted a live table more than
// once. Scratch path per test file keeps them from racing each other too.
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "NPCMessageHandler-state.json");

describe("NPCMessageHandler - Characterization Tests", () => {
  let messageRouter: MessageRouter;
  let roomService: RoomService;
  let playerService: PlayerService;
  let tokenService: TokenService;
  let mapService: MapService;
  let diceService: DiceService;
  let characterService: CharacterService;
  let propService: PropService;
  let selectionService: SelectionService;
  let authService: AuthService;
  let mockWss: WebSocketServer;
  let mockUidToWs: Map<string, WebSocket>;
  let mockGetAuthorizedClients: () => Set<WebSocket>;

  const playerUid = "player-123";
  const dmUid = "dm-456";

  beforeEach(() => {
    // Initialize services
    roomService = new RoomService({ stateFile: TEST_STATE_FILE });
    playerService = new PlayerService();
    tokenService = new TokenService();
    mapService = new MapService();
    diceService = new DiceService();
    characterService = new CharacterService();
    propService = new PropService();
    selectionService = new SelectionService();
    authService = new AuthService();

    // Mock WebSocket infrastructure
    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set<WebSocket>());

    // Setup initial state with players
    roomService.setState({
      players: [
        {
          uid: playerUid,
          name: "Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
        {
          uid: dmUid,
          name: "DM",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: true,
          statusEffects: [],
        },
      ],
      characters: [],
    });

    // Create MessageRouter instance
    messageRouter = new MessageRouter(
      roomService,
      playerService,
      tokenService,
      mapService,
      diceService,
      characterService,
      propService,
      selectionService,
      authService,
      mockWss,
      mockUidToWs,
      mockGetAuthorizedClients,
    );
  });

  describe("create-npc message", () => {
    it("should create NPC when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-npc",
        name: "Goblin",
        maxHp: 50,
        hp: 30,
        portrait: "goblin.png",
        tokenImage: "goblin-token.png",
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(1);
      expect(state.characters[0].name).toBe("Goblin");
      expect(state.characters[0].maxHp).toBe(50);
      expect(state.characters[0].hp).toBe(30);
      expect(state.characters[0].portrait).toBe("goblin.png");
      expect(state.characters[0].type).toBe("npc");
      expect(state.characters[0].tokenImage).toBe("goblin-token.png");
    });

    it("should not create NPC when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-npc",
        name: "Hacked NPC",
        maxHp: 100,
        hp: 100,
        portrait: "",
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(0);
    });
  });

  /**
   * S8: one message creates several. Note these route through the real
   * dispatcher, so the DM gate is exercised too — but NOT the validator, which
   * runs before route() in production. The count bound is tested in
   * middleware/__tests__/validation.test.ts.
   */
  describe("create-npc with a count", () => {
    const bulk = (count: number | undefined, name = "Goblin"): ClientMessage => ({
      t: "create-npc",
      name,
      hp: 7,
      maxHp: 7,
      ...(count === undefined ? {} : { count }),
    });

    it("creates exactly count NPCs from one message", () => {
      messageRouter.route(bulk(5), dmUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(5);
      expect(state.characters.every((c) => c.type === "npc")).toBe(true);
      expect(state.characters.every((c) => c.maxHp === 7)).toBe(true);
    });

    it("numbers them so a DM can tell one from another", () => {
      messageRouter.route(bulk(5), dmUid);

      expect(roomService.getState().characters.map((c) => c.name)).toEqual([
        "Goblin 1",
        "Goblin 2",
        "Goblin 3",
        "Goblin 4",
        "Goblin 5",
      ]);
    });

    it("continues the series on a second batch instead of repeating it", () => {
      messageRouter.route(bulk(5), dmUid);
      messageRouter.route(bulk(3), dmUid);

      const names = roomService.getState().characters.map((c) => c.name);
      expect(names).toHaveLength(8);
      expect(new Set(names).size).toBe(8);
      expect(names.slice(5)).toEqual(["Goblin 6", "Goblin 7", "Goblin 8"]);
    });

    it("leaves a single unnumbered create exactly as it always behaved", () => {
      // The plain "+ Add NPC" button sends no count at all.
      messageRouter.route(bulk(undefined, "New NPC"), dmUid);

      expect(roomService.getState().characters.map((c) => c.name)).toEqual(["New NPC"]);
    });

    it("still refuses a non-DM, however many are asked for", () => {
      messageRouter.route(bulk(20), playerUid);

      expect(roomService.getState().characters).toHaveLength(0);
    });

    it("gives every NPC in the batch its own identity", () => {
      messageRouter.route(bulk(4), dmUid);

      const ids = roomService.getState().characters.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);
    });

    it("copies portrait and token art to every NPC in the batch", () => {
      messageRouter.route(
        { ...bulk(3), portrait: "goblin.png", tokenImage: "goblin-token.png" } as ClientMessage,
        dmUid,
      );

      const state = roomService.getState();
      expect(state.characters.every((c) => c.portrait === "goblin.png")).toBe(true);
      expect(state.characters.every((c) => c.tokenImage === "goblin-token.png")).toBe(true);
    });

    it("stops at the 500-character snapshot limit rather than making an unloadable table", () => {
      // A room past the limit exports a session file that fails its own load
      // validation — the DM's backup silently stops being a backup.
      const state = roomService.getState();
      for (let i = 0; i < 495; i += 1) {
        characterService.createCharacter(state, `Filler ${i}`, 1, undefined, "npc");
      }

      messageRouter.route(bulk(20), dmUid);

      // Partial batch, not zero: 5 goblins beats none, and the DM can see it.
      expect(roomService.getState().characters).toHaveLength(500);
    });

    it("refuses outright once the room is already full", () => {
      const state = roomService.getState();
      for (let i = 0; i < 500; i += 1) {
        characterService.createCharacter(state, `Filler ${i}`, 1, undefined, "npc");
      }

      messageRouter.route(bulk(3), dmUid);

      expect(roomService.getState().characters).toHaveLength(500);
    });
  });

  describe("create-npc carrying a hidden flag (Duplicate)", () => {
    const create = (visibleToPlayers?: unknown): ClientMessage =>
      ({
        t: "create-npc",
        name: "Assassin",
        hp: 20,
        maxHp: 20,
        ...(visibleToPlayers === undefined ? {} : { visibleToPlayers }),
      }) as ClientMessage;

    it("creates a hidden NPC when the flag is explicitly false", () => {
      messageRouter.route(create(false), dmUid);

      expect(roomService.getState().characters[0]?.visibleToPlayers).toBe(false);
    });

    it("leaves an ordinary create visible", () => {
      messageRouter.route(create(undefined), dmUid);

      expect(roomService.getState().characters[0]?.visibleToPlayers).not.toBe(false);
    });

    it("puts no field on a created character beyond the Character shape", () => {
      // The real guard against forwarding wire-only options into a per-entity
      // constructor is COMPILE-TIME (a fresh object literal at the call site
      // restores TypeScript's excess-property check), which no runtime test can
      // observe. What this pins instead is the consequence, from any cause: the
      // recipient filter spreads `...character` into the snapshot and
      // StatePersistence writes the array straight to the session file, so an
      // unexpected key here reaches every player AND the DM's backup. It fails
      // if createCharacter ever starts spreading its options, whatever the call
      // site hands it.
      messageRouter.route(
        { t: "create-npc", name: "Goblin", hp: 7, maxHp: 7, count: 3 } as ClientMessage,
        dmUid,
      );

      const allowed = new Set([
        "id",
        "type",
        "name",
        "portrait",
        "hp",
        "maxHp",
        "tempHp",
        "tokenId",
        "ownedByPlayerUID",
        "tokenImage",
        "initiative",
        "initiativeModifier",
        "statusEffects",
        "visibleToPlayers",
      ]);

      const created = roomService.getState().characters;
      expect(created).toHaveLength(3);
      for (const character of created) {
        const unexpected = Object.keys(character).filter((key) => !allowed.has(key));
        expect(unexpected).toEqual([]);
      }
    });

    it("honours only an exact false, so a junk value cannot hide an NPC", () => {
      // The flag has no validator branch of its own — it drives a boolean, not
      // a loop — so the handler's `=== false` is what makes anything else inert.
      for (const junk of ["false", 0, null, {}]) {
        messageRouter.route(create(junk), dmUid);
      }

      const created = roomService.getState().characters;
      expect(created).toHaveLength(4);
      expect(created.every((c) => c.visibleToPlayers !== false)).toBe(true);
    });
  });

  describe("update-npc message", () => {
    let npcId: string;

    beforeEach(() => {
      // Create an NPC
      const state = roomService.getState();
      const npc = characterService.createCharacter(state, "Orc", 80, "orc.png", "npc", {
        hp: 80,
        tokenImage: "orc-token.png",
      });
      npcId = npc.id;
      roomService.createSnapshot();
    });

    it("should update NPC when DM updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-npc",
        id: npcId,
        name: "Orc Warrior",
        hp: 60,
        maxHp: 100,
        portrait: "orc-warrior.png",
        tokenImage: "orc-warrior-token.png",
      };

      messageRouter.route(updateMessage, dmUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);
      expect(npc?.name).toBe("Orc Warrior");
      expect(npc?.hp).toBe(60);
      expect(npc?.maxHp).toBe(100);
      expect(npc?.portrait).toBe("orc-warrior.png");
      expect(npc?.tokenImage).toBe("orc-warrior-token.png");
    });

    it("should not update NPC when non-DM tries", () => {
      const updateMessage: ClientMessage = {
        t: "update-npc",
        id: npcId,
        name: "Hacked Orc",
        hp: 10,
        maxHp: 10,
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);
      expect(npc?.name).toBe("Orc"); // Should not change
      expect(npc?.hp).toBe(80);
      expect(npc?.maxHp).toBe(80);
    });
  });

  describe("delete-npc message", () => {
    let npcId: string;
    let tokenId: string;

    beforeEach(() => {
      // Create an NPC with a linked token
      const state = roomService.getState();
      const npc = characterService.createCharacter(state, "Troll", 120, "troll.png", "npc");
      npcId = npc.id;

      // Create and link a token
      const token = tokenService.createToken(state, dmUid, 100, 100);
      tokenId = token.id;
      characterService.linkToken(state, npcId, tokenId);

      roomService.createSnapshot();
    });

    it("should delete NPC and linked token when DM deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === npcId)).toBeUndefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("should remove token from selection when deleted", () => {
      // Select the token first
      selectionService.selectObject(roomService.getState(), dmUid, tokenId);

      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      const selectedEntry = state.selectionState.get(dmUid);
      expect(selectedEntry).toBeUndefined();
    });

    it("should not delete NPC when non-DM tries", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === npcId)).toBeDefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeDefined();
    });
  });

  describe("place-npc-token message", () => {
    let npcId: string;

    beforeEach(() => {
      // Create an NPC without a token
      const state = roomService.getState();
      const npc = characterService.createCharacter(state, "Dragon", 200, "dragon.png", "npc", {
        tokenImage: "dragon-token.png",
      });
      npcId = npc.id;
      roomService.createSnapshot();
    });

    it("should place token for NPC when DM requests it", () => {
      const placeMessage: ClientMessage = {
        t: "place-npc-token",
        id: npcId,
      };

      const stateBefore = roomService.getState();
      const tokenCountBefore = stateBefore.tokens.length;

      messageRouter.route(placeMessage, dmUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);

      // Should create a token
      expect(state.tokens).toHaveLength(tokenCountBefore + 1);

      // Should link token to NPC
      expect(npc?.tokenId).toBeDefined();
      const token = state.tokens.find((t) => t.id === npc?.tokenId);
      expect(token).toBeDefined();
      expect(token?.owner).toBe(dmUid);
      expect(token?.imageUrl).toBe("dragon-token.png");
    });

    it("should not place token when non-DM tries", () => {
      const placeMessage: ClientMessage = {
        t: "place-npc-token",
        id: npcId,
      };

      const stateBefore = roomService.getState();
      const tokenCountBefore = stateBefore.tokens.length;

      messageRouter.route(placeMessage, playerUid);

      const state = roomService.getState();
      expect(state.tokens).toHaveLength(tokenCountBefore); // Should not change
    });
  });

  describe("toggle-npc-visibility message", () => {
    let npcId: string;

    beforeEach(() => {
      // Create an NPC
      const state = roomService.getState();
      const npc = characterService.createCharacter(state, "Assassin", 40, "assassin.png", "npc");
      npcId = npc.id;
      roomService.createSnapshot();
    });

    it("should toggle NPC visibility when DM toggles it", () => {
      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);

      // Initially should be undefined (visible by default)
      expect(npc?.visibleToPlayers).toBeUndefined();

      // Hide NPC
      const hideMessage: ClientMessage = {
        t: "toggle-npc-visibility",
        id: npcId,
        visible: false,
      };

      messageRouter.route(hideMessage, dmUid);

      expect(npc?.visibleToPlayers).toBe(false);

      // Reveal NPC
      const showMessage: ClientMessage = {
        t: "toggle-npc-visibility",
        id: npcId,
        visible: true,
      };

      messageRouter.route(showMessage, dmUid);

      expect(npc?.visibleToPlayers).toBe(true);
    });

    it("should not toggle visibility when non-DM tries", () => {
      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);

      // Player attempts to hide NPC
      const hideMessage: ClientMessage = {
        t: "toggle-npc-visibility",
        id: npcId,
        visible: false,
      };

      messageRouter.route(hideMessage, playerUid);

      // Visibility should remain unchanged (undefined = visible)
      expect(npc?.visibleToPlayers).toBeUndefined();
    });

    it("should handle visibility toggle for NPC with token", () => {
      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId)!;

      // Place token for NPC
      characterService.placeNPCToken(state, tokenService, npcId, dmUid);
      expect(npc.tokenId).toBeDefined();

      // Hide NPC
      const hideMessage: ClientMessage = {
        t: "toggle-npc-visibility",
        id: npcId,
        visible: false,
      };

      messageRouter.route(hideMessage, dmUid);

      expect(npc.visibleToPlayers).toBe(false);

      // Token should still exist in state (filtering happens in toSnapshot)
      const token = state.tokens.find((t) => t.id === npc.tokenId);
      expect(token).toBeDefined();
    });

    it("should handle toggle for non-existent NPC gracefully", () => {
      const toggleMessage: ClientMessage = {
        t: "toggle-npc-visibility",
        id: "non-existent-npc-id",
        visible: false,
      };

      // Should not throw error
      expect(() => {
        messageRouter.route(toggleMessage, dmUid);
      }).not.toThrow();

      // State should remain unchanged
      const state = roomService.getState();
      expect(state.characters).toHaveLength(1);
    });
  });
});
