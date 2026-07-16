import { describe, expect, it } from "vitest";
import { createEmptyRoomState, toSnapshot } from "../room/model.js";
import { SceneGraphBuilder } from "../room/scene/SceneGraphBuilder.js";
import { CharacterService } from "../character/service.js";
import { TokenService } from "../token/service.js";

describe("Room Model - toSnapshot", () => {
  const characterService = new CharacterService();
  const tokenService = new TokenService();
  const sceneGraphBuilder = new SceneGraphBuilder();

  describe("compiled scene filtering", () => {
    function stateWithCompiledScene() {
      const state = createEmptyRoomState();
      state.compiledScene = {
        schemaVersion: 1,
        sourceDocumentId: "map",
        sourceRevision: 3,
        compiledAt: 100,
        width: 2048,
        height: 2048,
        walls: [
          {
            id: "wall-1#0",
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 0,
            blocksMovement: true,
            blocksVision: true,
          },
        ],
        doors: [
          {
            id: "door-open",
            x1: 100,
            y1: 0,
            x2: 150,
            y2: 0,
            state: "closed",
            blocksMovement: true,
            blocksVision: true,
          },
          {
            id: "door-secret",
            x1: 200,
            y1: 0,
            x2: 250,
            y2: 0,
            state: "secret",
            blocksMovement: true,
            blocksVision: true,
          },
        ],
        lights: [
          {
            id: "brazier-1",
            x: 220,
            y: 40,
            radius: 150,
            color: "#ffb347",
            intensity: 0.8,
            castsShadows: true,
          },
        ],
      };
      return state;
    }

    it("omits the compiled scene when none has been published", () => {
      expect(toSnapshot(createEmptyRoomState(), false).compiledScene).toBeUndefined();
    });

    it("passes published terrain through to DM and player snapshots alike", () => {
      // Terrain is visible map art (no hidden info), so unlike compiledScene
      // it needs no per-role stripping — but it must actually ride along.
      const state = createEmptyRoomState();
      state.mapTerrain = {
        terrain: {
          schemaVersion: 1,
          palette: ["terrain:water"],
          chunks: { "0,0": [1, 1, 255, 0] },
        },
        grid: { size: 50, offsetX: 0, offsetY: 0 },
        opacity: 1,
      };

      expect(toSnapshot(state, true).mapTerrain).toEqual(state.mapTerrain);
      expect(toSnapshot(state, false).mapTerrain).toEqual(state.mapTerrain);
      expect(toSnapshot(createEmptyRoomState(), false).mapTerrain).toBeUndefined();
    });

    it("sends the full compiled scene to the DM, secret doors included", () => {
      const snapshot = toSnapshot(stateWithCompiledScene(), true);

      expect(snapshot.compiledScene?.doors.map((door) => door.id)).toEqual([
        "door-open",
        "door-secret",
      ]);
    });

    it("disguises secret doors as walls in player snapshots without touching server state", () => {
      const state = stateWithCompiledScene();

      const snapshot = toSnapshot(state, false);

      expect(snapshot.compiledScene?.doors.map((door) => door.id)).toEqual(["door-open"]);
      // The secret door still occludes vision and movement — as a wall.
      expect(snapshot.compiledScene?.walls).toHaveLength(2);
      expect(snapshot.compiledScene?.walls[1]).toEqual({
        id: "door-secret#0",
        x1: 200,
        y1: 0,
        x2: 250,
        y2: 0,
        blocksMovement: true,
        blocksVision: true,
      });
      expect(state.compiledScene?.doors).toHaveLength(2);
    });

    it("keeps compiled lights DM-only without touching server state", () => {
      // Nothing renders lights at the table yet, so a player gains nothing from
      // their coordinates except a map of the rooms fog is hiding — and every
      // generated dungeon lights its rooms. When lighting ships, lights must
      // come back VISION-FILTERED, not restored wholesale.
      const state = stateWithCompiledScene();

      expect(toSnapshot(state, true).compiledScene?.lights).toHaveLength(1);
      expect(toSnapshot(state, false).compiledScene?.lights).toEqual([]);
      expect(state.compiledScene?.lights).toHaveLength(1);
    });

    it("gives disguised secret doors the same id shape as real wall segments", () => {
      // Regression: the disguise once kept the bare door id while every
      // compiled wall segment carries a `#index` suffix — so filtering the
      // player payload for suffix-less wall ids revealed every secret door.
      const snapshot = toSnapshot(stateWithCompiledScene(), false);

      for (const wall of snapshot.compiledScene?.walls ?? []) {
        expect(wall.id).toMatch(/#\d+$/);
      }
    });
  });

  // Hoisted: both the vision-filtering block and the current-turn block need a
  // recipient who can see one token and not another.
  function stateWithFogAndWall() {
    const state = createEmptyRoomState();
    state.fogEnabled = true;
    state.compiledScene = {
      schemaVersion: 1,
      sourceDocumentId: "map",
      sourceRevision: 1,
      compiledAt: 1,
      width: 400,
      height: 400,
      walls: [
        {
          id: "divider",
          x1: 200,
          y1: 0,
          x2: 200,
          y2: 400,
          blocksMovement: true,
          blocksVision: true,
        },
      ],
      doors: [],
      lights: [],
    };
    // Token positions are grid cells (gridSize 50): cell (1,3) = pixel
    // (75,175) left of the wall; cell (6,3) = (325,175) behind it; cell
    // (20,20) = (1025,1025), outside the 400px map rect entirely.
    state.tokens = [
      { id: "mine", owner: "player-1", x: 1, y: 3, color: "red" },
      { id: "hidden-enemy", owner: "player-2", x: 6, y: 3, color: "blue" },
      { id: "off-map", owner: "player-2", x: 20, y: 20, color: "green" },
    ];
    state.sceneObjects = state.tokens.map((token) => ({
      id: `token:${token.id}`,
      type: "token" as const,
      owner: token.owner,
      locked: false,
      zIndex: 0,
      transform: { x: token.x, y: token.y, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { color: token.color },
    }));
    state.pointers = [
      { uid: "player-2", x: 300, y: 200, timestamp: 1, id: "ptr-hidden", name: "P2" },
      { uid: "player-2", x: 150, y: 200, timestamp: 1, id: "ptr-seen", name: "P2" },
    ];
    return state;
  }

  describe("vision filtering (fog of war)", () => {
    it("strips tokens, scene objects, and pointers the recipient cannot see", () => {
      const snapshot = toSnapshot(stateWithFogAndWall(), false, "player-1");

      expect(snapshot.tokens.map((token) => token.id)).toEqual(["mine", "off-map"]);
      expect(snapshot.sceneObjects?.map((object) => object.id)).toEqual([
        "token:mine",
        "token:off-map",
      ]);
      expect(snapshot.pointers.map((pointer) => pointer.id)).toEqual(["ptr-seen"]);
    });

    it("always includes the recipient's own tokens, even outside their vision", () => {
      const state = stateWithFogAndWall();
      // A second token of player-1's, stranded behind the wall (cell (6,6)).
      state.tokens.push({ id: "mine-far", owner: "player-1", x: 6, y: 6, color: "red" });

      const snapshot = toSnapshot(state, false, "player-1");

      expect(snapshot.tokens.map((token) => token.id)).toContain("mine-far");
    });

    it("does not filter when fog is disabled or for the DM", () => {
      const state = stateWithFogAndWall();

      const dmSnapshot = toSnapshot(state, true, "dm-uid");
      expect(dmSnapshot.tokens).toHaveLength(3);

      state.fogEnabled = false;
      const playerSnapshot = toSnapshot(state, false, "player-1");
      expect(playerSnapshot.tokens).toHaveLength(3);
      expect(playerSnapshot.pointers).toHaveLength(2);
    });

    it("does not filter when no recipient uid is provided (legacy callers)", () => {
      const snapshot = toSnapshot(stateWithFogAndWall(), false);
      expect(snapshot.tokens).toHaveLength(3);
    });

    it("keeps the recipient's own pings and all DM pings, wherever they land", () => {
      const state = stateWithFogAndWall();
      state.players = [
        {
          uid: "dm-uid",
          name: "DM",
          isDM: true,
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          lastHeartbeat: 1,
          statusEffects: [],
        },
      ];
      state.pointers = [
        { uid: "player-1", x: 300, y: 200, timestamp: 1, id: "own-hidden", name: "Me" },
        { uid: "dm-uid", x: 300, y: 200, timestamp: 1, id: "dm-hidden", name: "DM" },
        { uid: "player-2", x: 300, y: 200, timestamp: 1, id: "other-hidden", name: "P2" },
      ];

      const snapshot = toSnapshot(state, false, "player-1");

      expect(snapshot.pointers.map((pointer) => pointer.id)).toEqual(["own-hidden", "dm-hidden"]);
    });

    it("strips props inside fogged rooms but keeps owned and visible ones", () => {
      const state = stateWithFogAndWall();
      const prop = (id: string, x: number, y: number, owner: string | null) => ({
        id,
        label: id,
        imageUrl: "url",
        owner,
        size: "medium" as const,
        x,
        y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
      state.props = [
        prop("hidden-chest", 6, 3, null),
        prop("own-marker", 6, 3, "player-1"),
        prop("visible-barrel", 1, 1, null),
      ];

      const snapshot = toSnapshot(state, false, "player-1");

      expect(snapshot.props?.map((p) => p.id)).toEqual(["own-marker", "visible-barrel"]);
    });

    it("strips NPC character records whose tokens stand in fog, keeping party members and tokenless NPCs", () => {
      const state = stateWithFogAndWall();
      state.tokens.push(
        { id: "npc-fogged-token", owner: "__npc__", x: 6, y: 3, color: "black" },
        { id: "npc-seen-token", owner: "__npc__", x: 1, y: 1, color: "black" },
      );
      const character = (id: string, type: "pc" | "npc", tokenId: string | null) => ({
        id,
        type,
        name: id,
        hp: 8,
        maxHp: 8,
        tokenId,
      });
      state.characters = [
        // A party member whose token is behind the wall: rosters never fog.
        character("pc-far", "pc", "hidden-enemy"),
        character("npc-fogged", "npc", "npc-fogged-token"),
        character("npc-seen", "npc", "npc-seen-token"),
        // Off-map NPCs have no position to test against; visibleToPlayers
        // remains the DM's tool for hiding those.
        character("npc-tokenless", "npc", null),
      ];

      const snapshot = toSnapshot(state, false, "player-1");

      expect(snapshot.characters.map((c) => c.id)).toEqual(["pc-far", "npc-seen", "npc-tokenless"]);
      // The DM roster is untouched.
      expect(toSnapshot(state, true, "dm-uid").characters).toHaveLength(4);
    });

    it("strips selection entries that reference unseen objects", () => {
      const state = stateWithFogAndWall();
      state.selectionState.set("dm-uid", { mode: "single", objectId: "token:hidden-enemy" });
      state.selectionState.set("player-2", {
        mode: "multiple",
        objectIds: ["token:hidden-enemy", "token:mine"],
      });

      const snapshot = toSnapshot(state, false, "player-1");

      expect(snapshot.selectionState?.["dm-uid"]).toBeUndefined();
      expect(snapshot.selectionState?.["player-2"]).toEqual({
        mode: "multiple",
        objectIds: ["token:mine"],
      });
    });
  });

  describe("current-turn filtering", () => {
    // The invariant: currentTurnCharacterId must name a character in the
    // RECIPIENT'S OWN roster, or be absent. An id they cannot resolve is proof
    // a combatant they don't know about is acting right now, plus a stable
    // handle to track it across rounds — and useTurnChime sounds for it.

    it("clears a hidden NPC's turn for players, keeps it for the DM", () => {
      const state = createEmptyRoomState();
      const hiddenNPC = characterService.createCharacter(
        state,
        "Invisible Stalker",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");
      state.combatActive = true;
      state.currentTurnCharacterId = hiddenNPC.id;

      expect(toSnapshot(state, false).currentTurnCharacterId).toBeUndefined();
      expect(toSnapshot(state, true).currentTurnCharacterId).toBe(hiddenNPC.id);
    });

    it("never ships a turn id absent from the recipient's own characters", () => {
      // Stated as the general property rather than the one case, because this
      // is the rule the leak broke: toSnapshot stripped the record and the
      // token, then named it anyway three lines later.
      const state = createEmptyRoomState();
      const visible = characterService.createCharacter(state, "Guard", 20, undefined, "npc");
      const hidden = characterService.createCharacter(state, "Assassin", 15, undefined, "npc");
      characterService.setNPCVisibility(state, hidden.id, false);
      characterService.placeNPCToken(state, tokenService, visible.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hidden.id, "dm-uid");
      state.combatActive = true;

      for (const turn of [visible.id, hidden.id]) {
        state.currentTurnCharacterId = turn;
        const snapshot = toSnapshot(state, false);
        const named = snapshot.currentTurnCharacterId;
        const resolvable = named === undefined || snapshot.characters.some((c) => c.id === named);
        expect({ turn, resolvable }).toEqual({ turn, resolvable: true });
      }
    });

    it("keeps a visible NPC's turn — the filter must not over-strip", () => {
      const state = createEmptyRoomState();
      const guard = characterService.createCharacter(state, "Guard", 20, undefined, "npc");
      characterService.placeNPCToken(state, tokenService, guard.id, "dm-uid");
      state.combatActive = true;
      state.currentTurnCharacterId = guard.id;

      expect(toSnapshot(state, false).currentTurnCharacterId).toBe(guard.id);
    });

    it("clears the turn of an NPC whose token the recipient cannot see", () => {
      // The subtler half: a player who saw the goblin earlier already knows its
      // id, so naming it while it acts behind a wall reports its liveness and
      // turn position through the fog. Its record is already stripped for them.
      const state = stateWithFogAndWall();
      const lurker = characterService.createCharacter(state, "Goblin", 12, undefined, "npc");
      lurker.tokenId = "hidden-enemy";
      state.combatActive = true;
      state.currentTurnCharacterId = lurker.id;

      expect(toSnapshot(state, false, "player-1").currentTurnCharacterId).toBeUndefined();
      expect(toSnapshot(state, true).currentTurnCharacterId).toBe(lurker.id);
    });

    it("never strips a party member's own turn", () => {
      // The over-filtering guard that matters most: PCs ride along regardless
      // of fog, so a player's turn (and their chime) must always survive.
      const state = stateWithFogAndWall();
      const pc = characterService.createCharacter(state, "Hero", 18);
      state.combatActive = true;
      state.currentTurnCharacterId = pc.id;

      expect(toSnapshot(state, false, "player-1").currentTurnCharacterId).toBe(pc.id);
      expect(toSnapshot(state, false, "player-2").currentTurnCharacterId).toBe(pc.id);
    });
  });

  describe("NPC visibility filtering", () => {
    it("filters hidden NPCs and their tokens for non-DM players", () => {
      const state = createEmptyRoomState();

      // Create visible NPC
      const visibleNPC = characterService.createCharacter(
        state,
        "Visible Guard",
        20,
        undefined,
        "npc",
      );

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Assassin",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Place tokens for both NPCs
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for player (isDM = false)
      const playerSnapshot = toSnapshot(state, false);

      // Player should only see visible NPC
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.id).toBe(visibleNPC.id);
      expect(playerSnapshot.characters[0]?.name).toBe("Visible Guard");

      // Player should only see visible NPC's token
      expect(playerSnapshot.tokens).toHaveLength(1);
      expect(playerSnapshot.tokens[0]?.id).toBe(visibleNPC.tokenId);
    });

    it("shows all NPCs and tokens to DM regardless of visibility", () => {
      const state = createEmptyRoomState();

      // Create visible NPC
      const visibleNPC = characterService.createCharacter(
        state,
        "Visible Guard",
        20,
        undefined,
        "npc",
      );

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Assassin",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Place tokens for both NPCs
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for DM (isDM = true)
      const dmSnapshot = toSnapshot(state, true);

      // DM should see both NPCs
      expect(dmSnapshot.characters).toHaveLength(2);
      const characterNames = dmSnapshot.characters.map((c) => c.name).sort();
      expect(characterNames).toEqual(["Hidden Assassin", "Visible Guard"]);

      // DM should see both tokens
      expect(dmSnapshot.tokens).toHaveLength(2);
    });

    it("treats NPCs with undefined visibility as visible", () => {
      const state = createEmptyRoomState();

      // Create NPC without explicit visibility (defaults to undefined)
      const npc = characterService.createCharacter(state, "Default Guard", 18, undefined, "npc");
      expect(npc.visibleToPlayers).toBeUndefined();

      characterService.placeNPCToken(state, tokenService, npc.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC with undefined visibility
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.name).toBe("Default Guard");
      expect(playerSnapshot.tokens).toHaveLength(1);
    });

    it("treats NPCs with explicit true visibility as visible", () => {
      const state = createEmptyRoomState();

      // Create NPC with explicit visibility = true
      const npc = characterService.createCharacter(state, "Revealed Enemy", 25, undefined, "npc");
      characterService.setNPCVisibility(state, npc.id, true);

      characterService.placeNPCToken(state, tokenService, npc.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC with explicit true visibility
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.name).toBe("Revealed Enemy");
      expect(playerSnapshot.characters[0]?.visibleToPlayers).toBe(true);
      expect(playerSnapshot.tokens).toHaveLength(1);
    });

    it("filters only NPCs with visibility explicitly set to false", () => {
      const state = createEmptyRoomState();

      // Create multiple NPCs with different visibility states
      characterService.createCharacter(state, "NPC1", 10, undefined, "npc"); // undefined
      const npc2 = characterService.createCharacter(state, "NPC2", 10, undefined, "npc");
      characterService.setNPCVisibility(state, npc2.id, true); // true
      const npc3 = characterService.createCharacter(state, "NPC3", 10, undefined, "npc");
      characterService.setNPCVisibility(state, npc3.id, false); // false

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC1 (undefined) and NPC2 (true), but not NPC3 (false)
      expect(playerSnapshot.characters).toHaveLength(2);
      const visibleNames = playerSnapshot.characters.map((c) => c.name).sort();
      expect(visibleNames).toEqual(["NPC1", "NPC2"]);
    });

    it("does not affect player characters", () => {
      const state = createEmptyRoomState();

      // Create player character
      const playerChar = characterService.createCharacter(state, "Hero", 30, undefined, "pc");
      characterService.claimCharacter(state, playerChar.id, "player-1");

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Enemy",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see their own character
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.id).toBe(playerChar.id);
      expect(playerSnapshot.characters[0]?.name).toBe("Hero");
    });

    it("handles mixed scenario with player tokens and hidden NPC tokens", () => {
      const state = createEmptyRoomState();

      // Create player character with token
      const playerChar = characterService.createCharacter(state, "Warrior", 35, undefined, "pc");
      characterService.claimCharacter(state, playerChar.id, "player-1");
      const playerToken = tokenService.createToken(state, "player-1", 5, 5);
      characterService.linkToken(state, playerChar.id, playerToken.id);

      // Create visible NPC with token
      const visibleNPC = characterService.createCharacter(state, "Merchant", 10, undefined, "npc");
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");

      // Create hidden NPC with token
      const hiddenNPC = characterService.createCharacter(state, "Thief", 12, undefined, "npc");
      characterService.setNPCVisibility(state, hiddenNPC.id, false);
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see player character and visible NPC
      expect(playerSnapshot.characters).toHaveLength(2);
      const characterNames = playerSnapshot.characters.map((c) => c.name).sort();
      expect(characterNames).toEqual(["Merchant", "Warrior"]);

      // Player should see player token and visible NPC token (not hidden NPC token)
      expect(playerSnapshot.tokens).toHaveLength(2);
      const tokenIds = playerSnapshot.tokens.map((t) => t.id).sort();
      expect(tokenIds).toContain(playerToken.id);
      expect(tokenIds).toContain(visibleNPC.tokenId);
      expect(tokenIds).not.toContain(hiddenNPC.tokenId);
    });

    it("filters hidden NPC token scene objects for non-DM players", () => {
      const state = createEmptyRoomState();

      // Create NPCs and tokens
      const visibleNPC = characterService.createCharacter(
        state,
        "Visible NPC",
        10,
        undefined,
        "npc",
      );
      const hiddenNPC = characterService.createCharacter(state, "Hidden NPC", 10, undefined, "npc");
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Rebuild scene graph to populate token objects
      state.sceneObjects = sceneGraphBuilder.rebuild(state);

      expect(visibleNPC.tokenId).toBeTruthy();
      expect(hiddenNPC.tokenId).toBeTruthy();

      const visibleTokenSceneId = `token:${visibleNPC.tokenId!}`;
      const hiddenTokenSceneId = `token:${hiddenNPC.tokenId!}`;

      const playerSnapshot = toSnapshot(state, false);
      const dmSnapshot = toSnapshot(state, true);

      // RoomSnapshot.sceneObjects is optional in @herobyte/shared, but toSnapshot always populates it
      expect(playerSnapshot.sceneObjects).toBeDefined();
      expect(dmSnapshot.sceneObjects).toBeDefined();

      expect(playerSnapshot.sceneObjects!.some((obj) => obj.id === visibleTokenSceneId)).toBe(true);
      expect(playerSnapshot.sceneObjects!.some((obj) => obj.id === hiddenTokenSceneId)).toBe(false);

      expect(dmSnapshot.sceneObjects!.some((obj) => obj.id === visibleTokenSceneId)).toBe(true);
      expect(dmSnapshot.sceneObjects!.some((obj) => obj.id === hiddenTokenSceneId)).toBe(true);
    });
  });
});
