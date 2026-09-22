/**
 * Characterization tests for CharacterMessageHandler — and, since the
 * keyboard-movement arc, the character road's newer messages routed beside
 * it: set-character-speed (slice 3) and reset-movement-budget (F2, whose
 * handler is ws/handlers/movementBudgetMessages.ts, never in messageRouter).
 *
 * The characterization block captures the behavior of the original code
 * BEFORE extraction and serves as regression tests during and after it.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-character (lines 213-226)
 * - claim-character (lines 461-466)
 * - add-player-character (lines 468-501)
 * - delete-player-character (lines 503-526)
 * - update-character-name (lines 528-547)
 * - update-character-hp (lines 549-556)
 * - set-character-status-effects (lines 558-579)
 *
 * Target: apps/server/src/ws/handlers/CharacterMessageHandler.ts
 */

import { handleResetMovementBudget } from "../movementBudgetMessages.js";
import { resetMovementBudget } from "@herobyte/shared";
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
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "CharacterMessageHandler-state.json");

describe("CharacterMessageHandler - Characterization Tests", () => {
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

  describe("create-character message", () => {
    it("should create character when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-character",
        name: "Test Character",
        maxHp: 100,
        portrait: "portrait.png",
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(1);
      expect(state.characters[0].name).toBe("Test Character");
      expect(state.characters[0].maxHp).toBe(100);
      expect(state.characters[0].hp).toBe(100);
      expect(state.characters[0].portrait).toBe("portrait.png");
      expect(state.characters[0].type).toBe("pc");
    });

    it("should not create character when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-character",
        name: "Hacked Character",
        maxHp: 100,
        portrait: "",
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(0);
    });
  });

  describe("claim-character message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create an unclaimed character
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Unclaimed Char", 80, "");
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should allow player to claim unclaimed character", () => {
      const claimMessage: ClientMessage = {
        t: "claim-character",
        characterId: characterId,
      };

      messageRouter.route(claimMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.ownedByPlayerUID).toBe(playerUid);
    });

    it("refuses an NPC: an unclaimed monster is the DM's, and a claim would hand a player delete over it", () => {
      const state = roomService.getState();
      const goblin = characterService.createCharacter(state, "Goblin", 7, "", "npc");
      const save = vi.spyOn(roomService, "saveState");

      messageRouter.route({ t: "claim-character", characterId: goblin.id }, playerUid);

      expect(state.characters.find((c) => c.id === goblin.id)?.ownedByPlayerUID ?? null).toBeNull();
      expect(save).not.toHaveBeenCalled();
      // And the road a claim would have opened stays shut.
      messageRouter.route({ t: "delete-player-character", characterId: goblin.id }, playerUid);
      expect(state.characters.find((c) => c.id === goblin.id)).toBeDefined();
    });
  });

  describe("add-player-character message", () => {
    it("a DM's added character gets a token too — a DM-run ally is a combatant (F3) and needs a piece", () => {
      messageRouter.route({ t: "add-player-character", name: "Sidekick", maxHp: 30 }, dmUid);
      const state = roomService.getState();
      const character = state.characters.find((c) => c.name === "Sidekick")!;
      expect(character.ownedByPlayerUID).toBe(dmUid);
      const token = state.tokens.find((t) => t.owner === dmUid);
      expect(token).toBeDefined();
      expect(character.tokenId).toBe(token!.id);
    });

    it("should create character, auto-claim, and spawn token for player", () => {
      const addMessage: ClientMessage = {
        t: "add-player-character",
        name: "Player Character",
        maxHp: 120,
      };

      messageRouter.route(addMessage, playerUid);

      const state = roomService.getState();

      // Should create character
      expect(state.characters).toHaveLength(1);
      const character = state.characters[0];
      expect(character.name).toBe("Player Character");
      expect(character.maxHp).toBe(120);
      expect(character.hp).toBe(120);
      expect(character.type).toBe("pc");
      expect(character.ownedByPlayerUID).toBe(playerUid);

      // Should auto-claim (sets ownedByPlayerUID)
      expect(character.ownedByPlayerUID).toBe(playerUid);

      // Should create and link token
      expect(state.tokens).toHaveLength(1);
      const token = state.tokens[0];
      expect(token.owner).toBe(playerUid);
      expect(character.tokenId).toBe(token.id);
    });

    it("should use default maxHp if not provided", () => {
      const addMessage: ClientMessage = {
        t: "add-player-character",
        name: "Default HP Character",
      };

      messageRouter.route(addMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters[0];
      expect(character.maxHp).toBe(100); // Default
    });
  });

  describe("delete-player-character message", () => {
    let characterId: string;
    let tokenId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "My Character", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;

      // Create and link a token
      const token = tokenService.createToken(state, playerUid, 100, 100);
      tokenId = token.id;
      characterService.linkToken(state, characterId, tokenId);

      roomService.createSnapshot();
    });

    it("should delete character and linked token when owner deletes", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === characterId)).toBeUndefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("a DM deleting a SEATED player's last character mints them a replacement with a token", () => {
      // The owner's own delete mints a replacement client-side; a DM's delete
      // of another player's last character reaches here with no such client
      // path, and "Add Character" lives on the card they no longer have.
      const state = roomService.getState();
      state.users = [playerUid, dmUid];

      messageRouter.route({ t: "delete-player-character", characterId }, dmUid);

      const after = roomService.getState();
      expect(after.characters.find((c) => c.id === characterId)).toBeUndefined();
      const replacement = after.characters.find((c) => c.ownedByPlayerUID === playerUid);
      expect(replacement).toBeDefined();
      expect(replacement?.name).toBe("New Character");
      expect(replacement?.tokenId).toBeDefined();
      expect(after.tokens.find((t) => t.id === replacement?.tokenId)?.owner).toBe(playerUid);
    });

    it("a DM deleting an ABSENT player's last character leaves the seat empty — that is the point", () => {
      const state = roomService.getState();
      state.users = [dmUid];

      messageRouter.route({ t: "delete-player-character", characterId }, dmUid);

      const after = roomService.getState();
      expect(after.characters.filter((c) => c.ownedByPlayerUID === playerUid)).toEqual([]);
      expect(after.tokens.filter((t) => t.owner === playerUid)).toEqual([]);
    });

    it("should not delete character when non-owner tries", () => {
      const otherPlayerUid = "other-player";

      // Ensure character has the correct owner
      const beforeState = roomService.getState();
      const charBefore = beforeState.characters.find((c) => c.id === characterId);
      expect(charBefore?.ownedByPlayerUID).toBe(playerUid);

      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, otherPlayerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === characterId)).toBeDefined();
    });

    it("should remove token from selection when deleted", () => {
      // Select the token first
      selectionService.selectObject(roomService.getState(), playerUid, tokenId);

      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      const selectedEntry = state.selectionState.get(playerUid);
      expect(selectedEntry).toBeUndefined();
    });
  });

  describe("update-character-name message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Old Name", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should update character name when owner updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-character-name",
        characterId: characterId,
        name: "New Name",
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.name).toBe("New Name");
    });

    it("should not update character name when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const updateMessage: ClientMessage = {
        t: "update-character-name",
        characterId: characterId,
        name: "Hacked Name",
      };

      messageRouter.route(updateMessage, otherPlayerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.name).toBe("Old Name"); // Should not change
    });
  });

  describe("update-character-hp message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character CLAIMED by the sender — HP writes are permission
      // gated (owner or DM) like every other character mutation.
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Test Char", 100, "");
      characterService.claimCharacter(state, character.id, playerUid);
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should update character HP", () => {
      const updateMessage: ClientMessage = {
        t: "update-character-hp",
        characterId: characterId,
        hp: 50,
        maxHp: 120,
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.hp).toBe(50);
      expect(character?.maxHp).toBe(120);
    });

    it("carries tempHp from the wire — the Entities panel's Temp HP field wrote nothing", () => {
      // update-character-hp is the path with a LIVE UI (handleCharacterTempHpSubmit);
      // its dispatcher literal dropped tempHp exactly as update-npc's did.
      messageRouter.route(
        { t: "update-character-hp", characterId, hp: 50, maxHp: 120, tempHp: 6 },
        playerUid,
      );
      expect(roomService.getState().characters.find((c) => c.id === characterId)?.tempHp).toBe(6);
      messageRouter.route({ t: "update-character-hp", characterId, hp: 40, maxHp: 120 }, playerUid);
      expect(roomService.getState().characters.find((c) => c.id === characterId)?.tempHp).toBe(6);
      messageRouter.route(
        { t: "update-character-hp", characterId, hp: 40, maxHp: 120, tempHp: 0 },
        playerUid,
      );
      expect(roomService.getState().characters.find((c) => c.id === characterId)?.tempHp).toBe(0);
    });

    it("denies an HP write from a player who does not control the character", () => {
      // The hole the S4 review closed: hp had NO permission check, so any
      // player could rewrite any character's numbers — including a monster
      // whose hp the recipient filter hides (choose the values, know them).
      const updateMessage: ClientMessage = {
        t: "update-character-hp",
        characterId: characterId,
        hp: 1,
        maxHp: 1,
      };

      messageRouter.route(updateMessage, "some-other-player");

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.hp).toBe(100); // unchanged
      expect(character?.maxHp).toBe(100);
    });
  });

  describe("deleting a combatant mid-fight — the turn is passed, not skipped", () => {
    // Order: Leader 20, Runner 15, Rear 10 — the player's three PCs, round 2.
    let leaderId: string;
    let runnerId: string;
    let rearId: string;

    beforeEach(() => {
      const state = roomService.getState();
      const make = (name: string, initiative: number) => {
        const c = characterService.createCharacter(state, name, 100, "", "pc");
        c.ownedByPlayerUID = playerUid;
        c.initiative = initiative;
        c.movementUsed = 10;
        const token = tokenService.createToken(state, playerUid, 1, 1);
        characterService.linkToken(state, c.id, token.id);
        return c.id;
      };
      leaderId = make("Leader", 20);
      runnerId = make("Runner", 15);
      rearId = make("Rear", 10);
      state.combatActive = true;
      state.combatRound = 2;
      roomService.createSnapshot();
    });

    it("the DM deletes the ACTING combatant at the TOP of the order: the turn passes to the next, the round holds, and the next NEXT walks on down the order instead of restarting it", () => {
      roomService.getState().currentTurnCharacterId = leaderId;
      messageRouter.route({ t: "delete-player-character", characterId: leaderId }, dmUid);
      let after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(runnerId);
      expect(after.combatRound).toBe(2);
      expect(after.characters.find((c) => c.id === runnerId)).toMatchObject({
        movementUsed: 0,
        movementRound: 2,
      });
      // Before the fix the pointer dangled and this NEXT went to the top —
      // Runner again, with round 3 counted; Rear never got its round-2 turn.
      messageRouter.route({ t: "next-turn" }, dmUid);
      after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(rearId);
      expect(after.combatRound).toBe(2);
    });

    it("the DM deletes the ACTING combatant in the MIDDLE: the one behind it acts, its budget starts", () => {
      roomService.getState().currentTurnCharacterId = runnerId;
      messageRouter.route({ t: "delete-player-character", characterId: runnerId }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(rearId);
      expect(after.combatRound).toBe(2);
      expect(after.characters.find((c) => c.id === rearId)).toMatchObject({
        movementUsed: 0,
        movementRound: 2,
      });
    });

    it("deleting the LAST in the order while it acts wraps to the top and counts the lap exactly once", () => {
      roomService.getState().currentTurnCharacterId = rearId;
      messageRouter.route({ t: "delete-player-character", characterId: rearId }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(leaderId);
      expect(after.combatRound).toBe(3);
      messageRouter.route({ t: "next-turn" }, dmUid);
      expect(roomService.getState().currentTurnCharacterId).toBe(runnerId);
      expect(roomService.getState().combatRound).toBe(3);
    });

    it("deleting someone who is NOT acting leaves the turn and the round where they were", () => {
      roomService.getState().currentTurnCharacterId = runnerId;
      messageRouter.route({ t: "delete-player-character", characterId: leaderId }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(runnerId);
      expect(after.combatRound).toBe(2);
    });

    it("the owner deleting their own acting character passes the turn the same way", () => {
      roomService.getState().currentTurnCharacterId = leaderId;
      messageRouter.route({ t: "delete-player-character", characterId: leaderId }, playerUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(runnerId);
      expect(after.combatRound).toBe(2);
    });

    it("deleting an acting combatant that was never IN the order blanks the pointer rather than guessing a successor (the loaded-file case)", () => {
      const state = roomService.getState();
      state.characters.find((c) => c.id === runnerId)!.initiative = undefined; // holds the turn, not in the order
      state.currentTurnCharacterId = runnerId;
      messageRouter.route({ t: "delete-player-character", characterId: runnerId }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBeUndefined();
      expect(after.combatRound).toBe(2); // no lap invented for a turn nobody was in
    });

    it("the seat replacement and the turn hand-off compose: the DM deletes a seated owner's ONLY acting PC, the NPC behind it acts, the minted replacement stays out of the order", () => {
      const state = roomService.getState();
      state.users = [playerUid, dmUid];
      // Only Leader is the player's; the other two become the DM's monsters.
      for (const id of [runnerId, rearId]) {
        const c = state.characters.find((x) => x.id === id)!;
        c.type = "npc";
        c.ownedByPlayerUID = null;
      }
      state.currentTurnCharacterId = leaderId;
      messageRouter.route({ t: "delete-player-character", characterId: leaderId }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(runnerId);
      expect(after.combatRound).toBe(2);
      const replacement = after.characters.find((c) => c.name === "New Character");
      expect(replacement?.ownedByPlayerUID).toBe(playerUid);
      expect(replacement?.initiative).toBeUndefined();
    });
  });

  describe("a monster created mid-fight", () => {
    it("is born with a zeroed budget and NO round stamp — its first turn start resets it", () => {
      const state = roomService.getState();
      state.combatActive = true;
      state.combatRound = 3;
      const before = new Set(state.characters.map((c) => c.id));
      messageRouter.route({ t: "create-npc", name: "Latecomer", hp: 5, maxHp: 5 }, dmUid);
      const created = roomService.getState().characters.find((c) => !before.has(c.id))!;
      expect(created).toMatchObject({ movementUsed: 0, movementDiagonals: 0 });
      expect("movementRound" in created).toBe(false);
    });
  });

  describe("set-character-speed message", () => {
    let characterId: string;

    beforeEach(() => {
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Runner", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("the DM sets a character's speed", () => {
      messageRouter.route({ t: "set-character-speed", characterId, speed: 25 }, dmUid);
      expect(roomService.getState().characters.find((c) => c.id === characterId)?.speed).toBe(25);
    });

    it("setting the same speed twice, or clearing an unset one, is a no-op: no broadcast, no save", () => {
      const handler = messageRouter as unknown as {
        characterHandler?: { handleSetCharacterSpeed: (...args: unknown[]) => unknown };
      };
      void handler;
      const state = roomService.getState();
      const spy = vi.spyOn(roomService, "saveState");
      messageRouter.route({ t: "set-character-speed", characterId, speed: null }, dmUid);
      expect(spy).not.toHaveBeenCalled();
      messageRouter.route({ t: "set-character-speed", characterId, speed: 25 }, dmUid);
      expect(spy).toHaveBeenCalledTimes(1);
      messageRouter.route({ t: "set-character-speed", characterId, speed: 25 }, dmUid);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(state.characters.find((c) => c.id === characterId)?.speed).toBe(25);
    });

    it("null returns the character to the shared default — a set speed is not forever", () => {
      messageRouter.route({ t: "set-character-speed", characterId, speed: 25 }, dmUid);
      expect(roomService.getState().characters.find((c) => c.id === characterId)?.speed).toBe(25);
      messageRouter.route({ t: "set-character-speed", characterId, speed: null }, dmUid);
      const character = roomService.getState().characters.find((c) => c.id === characterId)!;
      expect("speed" in character).toBe(false);
    });

    it("the character's own player cannot — DM-only, the vision-radius rule", () => {
      messageRouter.route({ t: "set-character-speed", characterId, speed: 90 }, playerUid);
      expect(
        roomService.getState().characters.find((c) => c.id === characterId)?.speed,
      ).toBeUndefined();
    });
  });

  describe("reset-movement-budget message", () => {
    let characterId: string;
    const find = () => roomService.getState().characters.find((c) => c.id === characterId)!;

    beforeEach(() => {
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Runner", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      character.movementUsed = 15;
      character.movementDiagonals = 1;
      // A STALE stamp (round 2 in round 3): a reset that pre-stamped the
      // current round would make the character's next turn start a no-op.
      character.movementRound = 2;
      state.combatActive = true;
      state.combatRound = 3;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("the DM zeroes the spend and the diagonal count, and leaves the round stamp alone", () => {
      const spy = vi.spyOn(roomService, "saveState");
      messageRouter.route({ t: "reset-movement-budget", characterId }, dmUid);
      expect(find()).toMatchObject({ movementUsed: 0, movementDiagonals: 0, movementRound: 2 });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("a player cannot — not even the character's own (a budget a player could raise is not a budget)", () => {
      const spy = vi.spyOn(roomService, "saveState");
      messageRouter.route({ t: "reset-movement-budget", characterId }, playerUid);
      expect(find()).toMatchObject({ movementUsed: 15, movementDiagonals: 1 });
      expect(spy).not.toHaveBeenCalled();
    });

    it("nothing spent, no such character, or a player: the handler's own result is no broadcast AND no save", () => {
      const state = roomService.getState();
      resetMovementBudget(find());
      // The router hides half the result (only saves are observable there);
      // the function is the contract.
      expect(handleResetMovementBudget(state, characterId, dmUid, true)).toEqual({
        broadcast: false,
        save: false,
      });
      expect(handleResetMovementBudget(state, "nobody", dmUid, true)).toEqual({
        broadcast: false,
        save: false,
      });
      find().movementUsed = 15;
      expect(handleResetMovementBudget(state, characterId, playerUid, false)).toEqual({
        broadcast: false,
        save: false,
      });
      expect(find().movementUsed).toBe(15);
    });

    it("a diagonal count alone is a spend too (the server's idea of spent counts both)", () => {
      find().movementUsed = 0;
      find().movementDiagonals = 2;
      const spy = vi.spyOn(roomService, "saveState");
      messageRouter.route({ t: "reset-movement-budget", characterId }, dmUid);
      expect(find()).toMatchObject({ movementUsed: 0, movementDiagonals: 0 });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("composes with the turn: after a reset the character's next turn start still resets it", () => {
      // The stale stamp (round 2) stays stale through the reset; the turn
      // start, reached WITHOUT a wrap (the round stays 3), writes round 3 and
      // zeroes a fresh spend. A reset that pre-stamped round 3 would make that
      // turn start a no-op and leave the 5 ft standing — this is the fixture
      // where the stamp trap is visible.
      const state = roomService.getState();
      const other = characterService.createCharacter(state, "Leader", 100, "", "pc");
      other.ownedByPlayerUID = "someone-else";
      other.initiative = 20;
      state.characters.forEach((c) => {
        if (c.id !== characterId && c.id !== other.id) c.initiative = undefined;
      });
      find().initiative = 10;
      state.currentTurnCharacterId = other.id;
      messageRouter.route({ t: "reset-movement-budget", characterId }, dmUid);
      find().movementUsed = 5;
      messageRouter.route({ t: "next-turn" }, dmUid);
      expect(roomService.getState().combatRound).toBe(3);
      expect(roomService.getState().currentTurnCharacterId).toBe(characterId);
      expect(find()).toMatchObject({ movementUsed: 0, movementRound: 3 });
    });

    it("F3: the DM's OWN rolled character is a combatant — next-turn lands on it and its turn start refills it", () => {
      const state = roomService.getState();
      const ally = characterService.createCharacter(state, "Sidekick", 100, "", "pc");
      ally.ownedByPlayerUID = dmUid;
      ally.initiative = 5; // below Runner's 10: Runner's turn, then the ally's
      ally.movementUsed = 15;
      state.characters.forEach((c) => {
        if (c.id !== characterId && c.id !== ally.id) c.initiative = undefined;
      });
      find().initiative = 10;
      state.currentTurnCharacterId = characterId;
      messageRouter.route({ t: "next-turn" }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(ally.id);
      expect(after.combatRound).toBe(3); // no wrap
      expect(after.characters.find((c) => c.id === ally.id)).toMatchObject({
        movementUsed: 0,
        movementRound: 3,
      });
    });

    it("unrolled, the DM's own character is out of the order by the initiative filter (whoever owns it): the turn skips it and its spend stands", () => {
      const state = roomService.getState();
      const bench = characterService.createCharacter(state, "Understudy", 100, "", "pc");
      bench.ownedByPlayerUID = dmUid;
      bench.movementUsed = 15;
      state.characters.forEach((c) => {
        if (c.id !== characterId) c.initiative = undefined;
      });
      find().initiative = 10;
      state.currentTurnCharacterId = characterId;
      messageRouter.route({ t: "next-turn" }, dmUid);
      const after = roomService.getState();
      expect(after.currentTurnCharacterId).toBe(characterId); // wrapped onto itself
      expect(after.combatRound).toBe(4);
      expect(after.characters.find((c) => c.id === bench.id)?.movementUsed).toBe(15);
    });

    it("does not require combat — every road out of combat already zeroes every budget, so this only covers a hand-edited state file's stray spend", () => {
      messageRouter.route({ t: "end-combat" }, dmUid);
      expect(find().movementUsed).toBe(0); // the ordinary road did it already
      // A file's stray spend, out of combat: the reset still clears it.
      find().movementUsed = 20;
      messageRouter.route({ t: "reset-movement-budget", characterId }, dmUid);
      expect(find().movementUsed).toBe(0);
    });
  });

  describe("set-character-status-effects message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Test Char", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should set status effects when owner updates them", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["poisoned", "stunned"],
      };

      messageRouter.route(setEffectsMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.statusEffects).toEqual(["poisoned", "stunned"]);
    });

    it("should set status effects when DM updates them", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["blessed"],
      };

      messageRouter.route(setEffectsMessage, dmUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.statusEffects).toEqual(["blessed"]);
    });

    it("should not set status effects when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["hacked"],
      };

      messageRouter.route(setEffectsMessage, otherPlayerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      // Status effects should be undefined (not set) or empty
      expect(character?.statusEffects === undefined || character?.statusEffects?.length === 0).toBe(
        true,
      );
    });
  });

  describe("set-character-portrait message", () => {
    let characterId: string;

    beforeEach(() => {
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Portrait Hero", 80, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should allow owners to update portrait", () => {
      const message: ClientMessage = {
        t: "set-character-portrait",
        characterId,
        portrait: "https://example.com/hero.png",
      };

      messageRouter.route(message, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.portrait).toBe("https://example.com/hero.png");
    });

    it("should allow DMs to update portrait", () => {
      const message: ClientMessage = {
        t: "set-character-portrait",
        characterId,
        portrait: "https://example.com/dm-override.png",
      };

      messageRouter.route(message, dmUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.portrait).toBe("https://example.com/dm-override.png");
    });

    it("should block non-owners from updating portrait", () => {
      const message: ClientMessage = {
        t: "set-character-portrait",
        characterId,
        portrait: "https://example.com/invalid.png",
      };

      messageRouter.route(message, "intruder");

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.portrait).toBe("");
    });
  });
});
