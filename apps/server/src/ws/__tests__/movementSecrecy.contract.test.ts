// ============================================================================
// MOVEMENT BUDGET SECRECY CONTRACTS
// ============================================================================
// A monster's speed and spend are the DM's information: they must never
// SERIALIZE to a player socket, on the snapshot road or the delta road. The
// hpSecrecy harness, verbatim: real router, real room service, fake sockets,
// every frame walked structurally for the sentinel values.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, SnapshotCharacter } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import type { AuthService } from "../../domains/auth/service.js";
import { sentinelHits } from "./leakSentinels.js";

const ALICE = "alice-uid";
const DM = "dm-uid";
// Structural sentinels (leakSentinels.ts): five digits, like the house
// suites — a three-digit decimal shows up inside a chat entry's UUID about
// once in 140 runs, which is the CI #828 flake by another road.
const GOBLIN_SPEED = 44731;
const GOBLIN_USED = 99317;
const ALICE_SPEED = 33119;

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}
function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}
function player(uid: string, isDM: boolean) {
  return {
    uid,
    name: uid,
    portrait: undefined,
    isDM,
    hp: 10,
    maxHp: 10,
    micLevel: 0,
    lastHeartbeat: Date.now(),
    statusEffects: [],
  };
}
/** Characters from every full snapshot this socket received. */
function charactersSeenBy(socket: FakeSocket): SnapshotCharacter[] {
  const out: SnapshotCharacter[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(String(payload)) as { t?: string; characters?: SnapshotCharacter[] };
    if (message.t !== undefined) continue; // snapshots have no discriminator
    out.push(...(message.characters ?? []));
  }
  return out;
}

describe("movement budget secrecy contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    roomService = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "movement-secrecy-test-state.json"),
    });
    roomService.setState({
      players: [player(ALICE, false), player(DM, true)],
      characters: [
        {
          id: "npc-goblin",
          type: "npc",
          name: "Goblin 3",
          hp: 7,
          maxHp: 7,
          tokenId: "tok-goblin",
          ownedByPlayerUID: null,
          visibleToPlayers: true,
          initiative: 9,
          speed: GOBLIN_SPEED,
          movementUsed: GOBLIN_USED,
          movementDiagonals: 1,
          movementRound: 7,
        },
        {
          id: "pc-alice",
          type: "pc",
          name: "Alice",
          hp: 10,
          maxHp: 10,
          tokenId: "tok-alice",
          ownedByPlayerUID: ALICE,
          initiative: 15,
          speed: ALICE_SPEED,
          movementUsed: 5,
        },
      ],
      tokens: [
        { id: "tok-goblin", owner: DM, x: 3, y: 3, color: "#0f0" },
        { id: "tok-alice", owner: ALICE, x: 1, y: 1, color: "#00f" },
      ],
      pointers: [],
      sceneObjects: [],
      chatLog: [],
      fogEnabled: false,
      combatActive: true,
    });
    roomService.createSnapshot(); // scene graph, so the transform road exists
    aliceWs = fakeSocket();
    dmWs = fakeSocket();
    const uidToWs = new Map<string, WebSocket>([
      [ALICE, aliceWs as unknown as WebSocket],
      [DM, dmWs as unknown as WebSocket],
    ]);
    const clients = new Set<WebSocket>(uidToWs.values());
    router = new MessageRouter(
      roomService,
      new PlayerService(),
      new TokenService(),
      new MapService(),
      new DiceService(),
      new CharacterService(),
      new PropService(),
      new SelectionService(),
      {} as unknown as AuthService,
      {} as unknown as WebSocketServer,
      uidToWs,
      () => clients,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function route(message: ClientMessage, senderUid: string): void {
    router.route(message, senderUid);
    vi.advanceTimersByTime(50);
  }

  it("a monster's speed and spend never serialize to a player; the party's do", () => {
    route({ t: "chat", text: "ping" }, ALICE); // any broadcast-triggering message
    const goblin = charactersSeenBy(aliceWs).find((c) => c.id === "npc-goblin");
    expect(goblin).toBeDefined();
    expect(goblin?.speed).toBeUndefined();
    expect(goblin?.movementUsed).toBeUndefined();
    expect(goblin?.movementDiagonals).toBeUndefined();
    expect(goblin?.movementRound).toBeUndefined();
    expect(charactersSeenBy(aliceWs).find((c) => c.id === "pc-alice")?.speed).toBe(ALICE_SPEED);
    // The raw-bytes bar.
    expect(sentinelHits(aliceWs, GOBLIN_SPEED)).toEqual([]);
    expect(sentinelHits(aliceWs, GOBLIN_USED)).toEqual([]);
    expect(sentinelHits(dmWs, GOBLIN_SPEED)).not.toEqual([]);
  });

  it("the DM stepping the monster (the keyboard's step-object road) charges it and leaks nothing", () => {
    route({ t: "step-object", id: "token:tok-goblin", dx: 1, dy: 0 }, DM);
    expect(roomService.getState().characters[0]!.movementUsed).toBe(GOBLIN_USED + 5);
    // Alice DID receive the frame (positive control), and it carries nothing.
    expect(charactersSeenBy(aliceWs).some((c) => c.id === "npc-goblin")).toBe(true);
    expect(sentinelHits(aliceWs, GOBLIN_SPEED)).toEqual([]);
    expect(sentinelHits(aliceWs, GOBLIN_USED + 5)).toEqual([]);
    expect(sentinelHits(dmWs, GOBLIN_USED + 5)).not.toEqual([]);
  });

  it("a drag release (transform-object) charges and leaks nothing", () => {
    route({ t: "transform-object", id: "token:tok-goblin", position: { x: 4, y: 3 } }, DM);
    expect(roomService.getState().characters[0]!.movementUsed).toBe(GOBLIN_USED + 5);
    expect(charactersSeenBy(aliceWs).length).toBeGreaterThan(0);
    expect(sentinelHits(aliceWs, GOBLIN_SPEED)).toEqual([]);
    expect(sentinelHits(aliceWs, GOBLIN_USED + 5)).toEqual([]);
  });

  it("the legacy move road: a charged step leaks nothing either", () => {
    route({ t: "move", id: "tok-goblin", x: 5, y: 3 }, DM);
    expect(roomService.getState().characters[0]!.movementUsed).toBe(GOBLIN_USED + 10);
    expect(charactersSeenBy(aliceWs).length).toBeGreaterThan(0);
    expect(sentinelHits(aliceWs, GOBLIN_SPEED)).toEqual([]);
    expect(sentinelHits(aliceWs, GOBLIN_USED + 10)).toEqual([]);
  });

  it("with fog on and the monster HIDDEN, every road (delta re-send included) still leaks nothing", () => {
    // fogFilteringActive needs a compiled scene AND fog; a hidden NPC takes
    // the delta road's per-recipient branch, which builds a fresh snapshot.
    roomService.setState({
      fogEnabled: true,
      compiledScene: {
        schemaVersion: 1,
        sourceDocumentId: "map",
        sourceRevision: 1,
        compiledAt: 1,
        width: 2048,
        height: 2048,
        walls: [],
        doors: [],
        lights: [],
      },
    });
    roomService.getState().characters[0]!.visibleToPlayers = false;
    route({ t: "move", id: "tok-goblin", x: 5, y: 3 }, DM);
    route({ t: "step-object", id: "token:tok-goblin", dx: 1, dy: 0 }, DM);
    route({ t: "transform-object", id: "token:tok-goblin", position: { x: 7, y: 3 } }, DM);
    expect(roomService.getState().characters[0]!.movementUsed).toBe(GOBLIN_USED + 20);
    expect(aliceWs.send.mock.calls.length).toBeGreaterThan(0);
    expect(charactersSeenBy(aliceWs).some((c) => c.id === "npc-goblin")).toBe(false);
    for (const secret of [
      GOBLIN_SPEED,
      GOBLIN_USED,
      GOBLIN_USED + 5,
      GOBLIN_USED + 15,
      GOBLIN_USED + 20,
    ]) {
      expect(sentinelHits(aliceWs, secret)).toEqual([]);
    }
    expect(sentinelHits(dmWs, GOBLIN_USED + 20)).not.toEqual([]);
  });

  it("a player cannot set any speed, their own included — nothing changes, nothing is sent", () => {
    route({ t: "set-character-speed", characterId: "pc-alice", speed: 900 }, ALICE);
    route({ t: "set-character-speed", characterId: "npc-goblin", speed: 900 }, ALICE);
    expect(roomService.getState().characters.map((c) => c.speed)).toEqual([
      GOBLIN_SPEED,
      ALICE_SPEED,
    ]);
    expect(sentinelHits(dmWs, 900)).toEqual([]);
  });
});
