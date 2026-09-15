/**
 * The table's own Library tokens, through the real MessageRouter: a DM adds
 * and removes; a player's frame is refused before the shelf changes; the
 * shelf reaches a DM's snapshot and never a player's.
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
import { toSnapshot } from "../../../domains/room/model.js";
import type { ClientMessage } from "@herobyte/shared";
import type { WebSocketServer, WebSocket } from "ws";

// Scratch state file per test file, so parallel workers never tear the real one.
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "CustomTokenMessageHandler-state.json");

const playerUid = "player-123";
const dmUid = "dm-456";

const player = (uid: string, isDM: boolean) => ({
  uid,
  name: isDM ? "DM" : "Player",
  portrait: "",
  micLevel: 0,
  lastHeartbeat: Date.now(),
  hp: 10,
  maxHp: 10,
  isDM,
  statusEffects: [],
});

describe("CustomTokenMessageHandler through the router", () => {
  let messageRouter: MessageRouter;
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService({ stateFile: TEST_STATE_FILE });
    roomService.setState({ players: [player(playerUid, false), player(dmUid, true)] });
    messageRouter = new MessageRouter(
      roomService,
      new PlayerService(),
      new TokenService(),
      new MapService(),
      new DiceService(),
      new CharacterService(),
      new PropService(),
      new SelectionService(),
      new AuthService(),
      {} as WebSocketServer,
      new Map<string, WebSocket>(),
      vi.fn(() => new Set<WebSocket>()),
    );
  });

  const add: ClientMessage = {
    t: "add-custom-token",
    name: "Old Marta",
    imageUrl: "https://i.imgur.com/marta.png",
    description: "Runs the Gilded Tankard.",
    tags: ["NPC", "villager", "npc"],
    size: "small",
  };

  it("a DM adds one: normalised tags, the sender as author, the size kept", () => {
    messageRouter.route(add, dmUid);
    const [token] = roomService.getState().customTokens;
    expect(token).toBeDefined();
    expect(token!.name).toBe("Old Marta");
    expect(token!.tags).toEqual(["npc", "villager"]);
    expect(token!.size).toBe("small");
    expect(token!.addedBy).toBe(dmUid);
    expect(token!.description).toBe("Runs the Gilded Tankard.");
  });

  it("a player's add is refused, and so is a player's remove of the DM's token", () => {
    messageRouter.route(add, playerUid);
    expect(roomService.getState().customTokens).toHaveLength(0);
    messageRouter.route(add, dmUid);
    const id = roomService.getState().customTokens[0]!.id;
    messageRouter.route({ t: "remove-custom-token", id }, playerUid);
    expect(roomService.getState().customTokens).toHaveLength(1);
  });

  it("a DM removes one by id; an unknown id changes nothing", () => {
    messageRouter.route(add, dmUid);
    messageRouter.route({ ...add, name: "Merchant wagon", tags: ["prop"] }, dmUid);
    const [first, second] = roomService.getState().customTokens;
    messageRouter.route({ t: "remove-custom-token", id: first!.id }, dmUid);
    expect(roomService.getState().customTokens.map((t) => t.id)).toEqual([second!.id]);
    messageRouter.route({ t: "remove-custom-token", id: "nope" }, dmUid);
    expect(roomService.getState().customTokens).toHaveLength(1);
  });

  it("the shelf reaches a DM's snapshot and never a player's", () => {
    messageRouter.route(add, dmUid);
    const state = roomService.getState();
    expect(toSnapshot(state, true, dmUid).customTokens).toHaveLength(1);
    const forPlayer = toSnapshot(state, false, playerUid);
    expect("customTokens" in forPlayer).toBe(false);
    expect(JSON.stringify(forPlayer)).not.toContain("Old Marta");
  });
});
