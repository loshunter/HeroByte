/**
 * A player's toggle of a locked door is refused, and the one who tried is told
 * (`door-refused`). The client says it before sending when it can see the lock; this
 * is the stale view's word (the DM locked it a moment ago), which used to be a nack
 * that reached only the console. Driven through the real router.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { CompiledDoor } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { AuthService } from "../../domains/auth/service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "doorRefusal-state.json");
const DM = "dm-1";
const PLAYER = "player-1";

type Frame = { t: string; doorId?: string };

const door = (id: string, state: CompiledDoor["state"]): CompiledDoor => ({
  id,
  x1: 0,
  y1: 0,
  x2: 50,
  y2: 0,
  state,
  blocksMovement: true,
  blocksVision: true,
});

describe("a locked door refuses a player's toggle, and says so to them alone", () => {
  let router: MessageRouter;
  let room: RoomService;
  const sockets = new Map<string, WebSocket>();

  const framesTo = (uid: string): Frame[] =>
    (sockets.get(uid)!.send as unknown as { mock: { calls: [string][] } }).mock.calls.map(
      ([raw]) => JSON.parse(raw) as Frame,
    );
  const refusalsTo = (uid: string) => framesTo(uid).filter((f) => f.t === "door-refused");
  const doorState = (id: string) =>
    room.getState().compiledScene?.doors.find((d) => d.id === id)?.state;

  beforeEach(() => {
    room = new RoomService({ stateFile: STATE_FILE });
    sockets.clear();
    for (const uid of [DM, PLAYER]) {
      sockets.set(uid, { readyState: 1, send: vi.fn() } as unknown as WebSocket);
    }
    room.setState({
      players: [
        { uid: DM, name: "DM", isDM: true, hp: 10, maxHp: 10, statusEffects: [] },
        { uid: PLAYER, name: "P", isDM: false, hp: 10, maxHp: 10, statusEffects: [] },
      ],
    });
    room.getState().users = [DM, PLAYER];
    room.getState().compiledScene = {
      schemaVersion: 1,
      sourceDocumentId: "map",
      sourceRevision: 1,
      compiledAt: 1,
      width: 2048,
      height: 2048,
      walls: [],
      doors: [door("door-locked", "locked"), door("door-closed", "closed")],
      lights: [],
    };
    router = new MessageRouter(
      room,
      new PlayerService(),
      new TokenService(),
      new MapService(),
      new DiceService(),
      new CharacterService(),
      new PropService(),
      new SelectionService(),
      new AuthService(),
      {} as WebSocketServer,
      sockets,
      vi.fn(() => new Set<WebSocket>()),
      undefined,
      undefined,
      new Map(),
    );
  });

  it("the player is told; the door holds; the DM hears nothing", () => {
    router.route({ t: "toggle-door", doorId: "door-locked" }, PLAYER);
    expect(refusalsTo(PLAYER)).toEqual([{ t: "door-refused", doorId: "door-locked" }]);
    expect(refusalsTo(DM)).toEqual([]);
    expect(doorState("door-locked")).toBe("locked");
  });

  it("the DM still forces it open, and no one is told anything", () => {
    router.route({ t: "toggle-door", doorId: "door-locked" }, DM);
    expect(doorState("door-locked")).toBe("open");
    expect([...refusalsTo(DM), ...refusalsTo(PLAYER)]).toEqual([]);
  });

  it("a free door still swings for a player, with no refusal", () => {
    router.route({ t: "toggle-door", doorId: "door-closed" }, PLAYER);
    expect(doorState("door-closed")).toBe("open");
    expect(refusalsTo(PLAYER)).toEqual([]);
  });
});
