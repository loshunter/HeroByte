/**
 * Characterization tests for PropMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-prop (lines 415-432)
 * - update-prop (lines 434-450)
 * - delete-prop (lines 452-465)
 *
 * Target: apps/server/src/ws/handlers/PropMessageHandler.ts
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
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "PropMessageHandler-state.json");

describe("PropMessageHandler - Characterization Tests", () => {
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
      props: [],
      gridSize: 50,
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

  describe("create-prop message", () => {
    it("should create prop when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-prop",
        label: "Treasure Chest",
        imageUrl: "chest.png",
        owner: dmUid,
        size: "medium",
        viewport: { x: 100, y: 100, scale: 1 },
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.props).toHaveLength(1);
      expect(state.props[0].label).toBe("Treasure Chest");
      expect(state.props[0].imageUrl).toBe("chest.png");
      expect(state.props[0].owner).toBe(dmUid);
      expect(state.props[0].size).toBe("medium");
    });

    it("should not create prop when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-prop",
        label: "Hacked Prop",
        imageUrl: "hack.png",
        owner: playerUid,
        size: "small",
        viewport: { x: 0, y: 0, scale: 1 },
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.props).toHaveLength(0);
    });
  });

  describe("update-prop message", () => {
    let propId: string;

    beforeEach(() => {
      // Create a prop
      const state = roomService.getState();
      const prop = propService.createProp(
        state,
        "Old Prop",
        "old.png",
        dmUid,
        "small",
        { x: 0, y: 0, scale: 1 },
        state.gridSize,
      );
      propId = prop.id;
      roomService.createSnapshot();
    });

    it("should update prop when DM updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-prop",
        id: propId,
        label: "New Prop",
        imageUrl: "new.png",
        owner: playerUid,
        size: "large",
      };

      messageRouter.route(updateMessage, dmUid);

      const state = roomService.getState();
      const prop = state.props.find((p) => p.id === propId);
      expect(prop?.label).toBe("New Prop");
      expect(prop?.imageUrl).toBe("new.png");
      expect(prop?.owner).toBe(playerUid);
      expect(prop?.size).toBe("large");
    });

    it("should not update prop when non-DM tries", () => {
      const updateMessage: ClientMessage = {
        t: "update-prop",
        id: propId,
        label: "Hacked Prop",
        imageUrl: "hack.png",
        owner: dmUid,
        size: "small",
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const prop = state.props.find((p) => p.id === propId);
      expect(prop?.label).toBe("Old Prop"); // Should not change
      expect(prop?.imageUrl).toBe("old.png");
    });
  });

  describe("delete-prop message", () => {
    let propId: string;

    beforeEach(() => {
      // Create a prop
      const state = roomService.getState();
      const prop = propService.createProp(
        state,
        "Deletable Prop",
        "delete.png",
        dmUid,
        "medium",
        { x: 50, y: 50, scale: 1 },
        state.gridSize,
      );
      propId = prop.id;
      roomService.createSnapshot();
    });

    it("should delete prop when DM deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      expect(state.props.find((p) => p.id === propId)).toBeUndefined();
    });

    it("should remove prop from selection when deleted", () => {
      // Select the prop first
      const propKey = `prop:${propId}`;
      selectionService.selectObject(roomService.getState(), dmUid, propKey);

      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      const selectedEntry = state.selectionState.get(dmUid);
      expect(selectedEntry).toBeUndefined();
    });

    it("should not delete prop when non-DM tries", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.props.find((p) => p.id === propId)).toBeDefined();
    });
  });

  describe("playerPropsEnabled toggle (player props slice)", () => {
    function setToggle(enabled: boolean) {
      messageRouter.route({ t: "set-player-props-enabled", enabled }, dmUid);
    }

    function playerCreate(label: string, owner: string | null = null) {
      messageRouter.route(
        {
          t: "create-prop",
          label,
          imageUrl: "chest.png",
          owner,
          size: "medium",
          viewport: { x: 0, y: 0, scale: 1 },
        },
        playerUid,
      );
    }

    it("routes the DM's toggle into room state and refuses a player's", () => {
      setToggle(true);
      expect(roomService.getState().playerPropsEnabled).toBe(true);

      // The scene handler throws on a player attempt; whether the router
      // rethrows or reports it to the sender, the STATE is the contract here.
      try {
        messageRouter.route({ t: "set-player-props-enabled", enabled: false }, playerUid);
      } catch {
        // refusal surfaced as an error — fine
      }
      expect(roomService.getState().playerPropsEnabled).toBe(true);
    });

    it("lets a player create a prop only while the toggle is on, owned by them whatever the wire claims", () => {
      playerCreate("Too Early");
      expect(roomService.getState().props).toHaveLength(0);

      setToggle(true);
      // The wire claims owner: null ("DM only") — the dispatcher must
      // overwrite it, or a player could mint props they then cannot manage
      // and the DM never chose.
      playerCreate("Chest", null);
      const created = roomService.getState().props;
      expect(created).toHaveLength(1);
      expect(created[0].owner).toBe(playerUid);

      setToggle(false);
      playerCreate("Too Late");
      // Flipping the toggle off bites immediately, whatever the client shows.
      expect(roomService.getState().props).toHaveLength(1);
    });

    it("keeps a DM create's owner field authoritative while the toggle is on", () => {
      setToggle(true);
      messageRouter.route(
        {
          t: "create-prop",
          label: "Shared Barrel",
          imageUrl: "barrel.png",
          owner: "*",
          size: "medium",
          viewport: { x: 0, y: 0, scale: 1 },
        },
        dmUid,
      );
      expect(roomService.getState().props[0].owner).toBe("*");
    });

    it("lets a player update and delete only their OWN props — not the DM's, not shared ones", () => {
      setToggle(true);
      playerCreate("Mine");
      const state = roomService.getState();
      const dmProp = propService.createProp(
        state,
        "DM Only",
        "dm.png",
        null,
        "medium",
        { x: 0, y: 0, scale: 1 },
        state.gridSize,
      );
      const sharedProp = propService.createProp(
        state,
        "Shared",
        "shared.png",
        "*",
        "medium",
        { x: 0, y: 0, scale: 1 },
        state.gridSize,
      );
      const mine = state.props.find((p) => p.owner === playerUid);
      expect(mine).toBeDefined();

      // Own prop: update lands, but the owner claim in the message is ignored
      // — a player edit can't re-home a prop to "*" or to the DM.
      messageRouter.route(
        {
          t: "update-prop",
          id: mine!.id,
          label: "Mine Renamed",
          imageUrl: "mine.png",
          owner: "*",
          size: "large",
        },
        playerUid,
      );
      const updated = roomService.getState().props.find((p) => p.id === mine!.id);
      expect(updated?.label).toBe("Mine Renamed");
      expect(updated?.owner).toBe(playerUid);

      // DM-only and shared props: strict owner match — "*" grants MOVING
      // (TransformHandler's rule), never re-labelling or deleting.
      for (const foreign of [dmProp, sharedProp]) {
        messageRouter.route(
          {
            t: "update-prop",
            id: foreign.id,
            label: "Vandalized",
            imageUrl: "x.png",
            owner: playerUid,
            size: "tiny",
          },
          playerUid,
        );
        messageRouter.route({ t: "delete-prop", id: foreign.id }, playerUid);
        const after = roomService.getState().props.find((p) => p.id === foreign.id);
        expect(after?.label).toBe(foreign.label);
        expect(after?.owner).toBe(foreign.owner);
      }

      // Own prop: delete lands.
      messageRouter.route({ t: "delete-prop", id: mine!.id }, playerUid);
      expect(roomService.getState().props.find((p) => p.id === mine!.id)).toBeUndefined();
    });

    it("still lets the DM manage a player's prop", () => {
      setToggle(true);
      playerCreate("Player Chest");
      const mine = roomService.getState().props.find((p) => p.owner === playerUid);

      messageRouter.route(
        {
          t: "update-prop",
          id: mine!.id,
          label: "Curated Chest",
          imageUrl: "chest.png",
          owner: "*",
          size: "medium",
        },
        dmUid,
      );
      const updated = roomService.getState().props.find((p) => p.id === mine!.id);
      // The DM's owner field IS authoritative — including re-homing.
      expect(updated?.label).toBe("Curated Chest");
      expect(updated?.owner).toBe("*");

      messageRouter.route({ t: "delete-prop", id: mine!.id }, dmUid);
      expect(roomService.getState().props).toHaveLength(0);
    });
  });

  describe("create-prop count (scatter)", () => {
    it("creates N numbered props from ONE message — first at centre, the rest jittered", () => {
      // 0.75 → offset of exactly +1 cell on both axes, so the scatter is
      // deterministic without weakening the assertion to "somewhere else".
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);
      try {
        messageRouter.route(
          {
            t: "create-prop",
            label: "Crate",
            imageUrl: "crate.png",
            owner: null,
            size: "small",
            viewport: { x: 0, y: 0, scale: 1 },
            count: 3,
          },
          dmUid,
        );
        const props = roomService.getState().props;
        expect(props.map((p) => p.label)).toEqual(["Crate 1", "Crate 2", "Crate 3"]);
        expect(props[1].x).toBeCloseTo(props[0].x + 1);
        expect(props[1].y).toBeCloseTo(props[0].y + 1);
        expect(props[2].x).toBeCloseTo(props[0].x + 1);
      } finally {
        randomSpy.mockRestore();
      }
    });

    it("keeps a single create un-numbered", () => {
      messageRouter.route(
        {
          t: "create-prop",
          label: "Lone Chest",
          imageUrl: "chest.png",
          owner: null,
          size: "medium",
          viewport: { x: 0, y: 0, scale: 1 },
        },
        dmUid,
      );
      expect(roomService.getState().props[0].label).toBe("Lone Chest");
    });

    it("clamps a scatter against the 500-prop snapshot headroom instead of overflowing the session file", () => {
      const state = roomService.getState();
      for (let i = 0; i < 498; i++) {
        state.props.push({
          id: `stub-${i}`,
          label: `Stub ${i}`,
          imageUrl: "stub.png",
          owner: null,
          size: "tiny",
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        });
      }

      messageRouter.route(
        {
          t: "create-prop",
          label: "Crate",
          imageUrl: "crate.png",
          owner: null,
          size: "small",
          viewport: { x: 0, y: 0, scale: 1 },
          count: 5,
        },
        dmUid,
      );
      // 498 stubs + 2 of the 5 — the room stops AT the limit a session file
      // is validated against on load, so the DM's backup stays loadable.
      expect(roomService.getState().props).toHaveLength(500);

      messageRouter.route(
        {
          t: "create-prop",
          label: "One More",
          imageUrl: "crate.png",
          owner: null,
          size: "small",
          viewport: { x: 0, y: 0, scale: 1 },
        },
        dmUid,
      );
      expect(roomService.getState().props).toHaveLength(500);
    });
  });
});
