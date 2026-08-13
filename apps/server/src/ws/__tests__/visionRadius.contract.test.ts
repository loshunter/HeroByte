// ============================================================================
// VISION RADIUS CONTRACTS (S7)
// ============================================================================
// Three contracts, the last two on RAW SOCKET BYTES because a parsed-object
// check would pass on a renderer-side fix:
//
//   1. Only a DM may set a token's sight radius. A radius can only ever NARROW
//      what the walls already allow, so a player able to clear their own would
//      simply undo the darkness the DM authored — which makes this an
//      authority question, not a privacy one, and the gate lives server-side.
//   2. A radius actually SHRINKS the payload: a token that is in line of sight
//      but out of range must be absent from the player's bytes, not merely
//      hidden by the fog overlay. That is the whole difference between fog as
//      a rendering effect and fog as a secret.
//   3. Setting a radius takes effect IMMEDIATELY. The router memoizes vision
//      per recipient on `visionSignature`, so a signature that omits the
//      radius serves the previous polygon and the change looks like it never
//      sent. This drives the real cache, not the signature function.
//
// Copies the measurement contract harness: real router, real room service,
// fake sockets.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, CompiledScene } from "@herobyte/shared";
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

const ALICE = "alice-uid";
const BOB = "bob-uid";
const DM = "dm-uid";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

/** Token ids in the LAST full snapshot this socket received. */
function tokenIdsLastSeenBy(socket: FakeSocket): string[] | null {
  for (let i = socket.send.mock.calls.length - 1; i >= 0; i -= 1) {
    const message = JSON.parse(String(socket.send.mock.calls[i]![0])) as {
      t?: string;
      tokens?: { id: string }[];
    };
    if (message.t === undefined && message.tokens) {
      return message.tokens.map((token) => token.id);
    }
  }
  return null;
}

/** Every byte this socket has been sent, for absence assertions. */
function rawBytesSentTo(socket: FakeSocket): string {
  return socket.send.mock.calls.map(([payload]) => String(payload)).join("\n");
}

// A 400x400 open scene. Nothing occludes, so anything hidden is hidden by the
// RADIUS and nothing else.
function openScene(): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    width: 400,
    height: 400,
    walls: [],
    doors: [],
    lights: [],
  };
}

function player(uid: string, name: string, isDM: boolean) {
  return {
    uid,
    name,
    portrait: undefined,
    isDM,
    hp: 10,
    maxHp: 10,
    micLevel: 0,
    lastHeartbeat: Date.now(),
    statusEffects: [],
  };
}

describe("vision radius contracts (S7)", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let bobWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    // Snapshots are debounced in BroadcastService; without a timer flush the
    // payload assertions would read a snapshot that predates the change.
    vi.useFakeTimers();
    roomService = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "vision-radius-contract-state.json"),
    });
    roomService.setState({
      players: [player(ALICE, "Alice", false), player(BOB, "Bob", false), player(DM, "Dee", true)],
      characters: [],
      // Grid 50 px/square, 5 ft/square. Alice's token at cell (1,1) = world
      // (75,75); the DM's marker at cell (5,1) = world (275,75), 200 px away
      // = 20 ft, in plain sight across an empty room.
      tokens: [
        { id: "alice-token", owner: ALICE, x: 1, y: 1, color: "red" },
        { id: "far-monster", owner: DM, x: 5, y: 1, color: "green" },
      ],
      pointers: [],
      sceneObjects: [],
      chatLog: [],
      fogEnabled: true,
      compiledScene: openScene(),
    });

    aliceWs = fakeSocket();
    bobWs = fakeSocket();
    dmWs = fakeSocket();
    const uidToWs = new Map<string, WebSocket>([
      [ALICE, aliceWs as unknown as WebSocket],
      [BOB, bobWs as unknown as WebSocket],
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

  function radiusOf(tokenId: string): number | undefined {
    return roomService.getState().tokens.find((token) => token.id === tokenId)?.visionRadius;
  }

  describe("who may set it", () => {
    it("a DM sets a radius on any token, including a player's", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 30 }, DM);

      expect(radiusOf("alice-token")).toBe(30);
    });

    it("a player cannot set a radius, not even on their own token", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 30 }, ALICE);

      expect(radiusOf("alice-token")).toBeUndefined();
    });

    // The one that matters: the DM has made the dungeon dark, and the player
    // tries to take the limit back off.
    it("a player cannot CLEAR a radius the DM set", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 15 }, DM);
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: null }, ALICE);

      expect(radiusOf("alice-token")).toBe(15);
    });

    it("a DM clears it back to unlimited, leaving no sentinel behind", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 15 }, DM);
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: null }, DM);

      const token = roomService.getState().tokens.find((t) => t.id === "alice-token")!;
      expect(token.visionRadius).toBeUndefined();
      expect("visionRadius" in token).toBe(false);
    });

    it("an unknown token id changes nothing", () => {
      route({ t: "set-token-vision-radius", tokenId: "nope", radius: 30 }, DM);

      expect(radiusOf("alice-token")).toBeUndefined();
      expect(radiusOf("far-monster")).toBeUndefined();
    });
  });

  describe("what the player's socket actually receives", () => {
    it("carries the far monster while sight is unlimited", () => {
      route({ t: "chat", text: "ping" }, ALICE);

      expect(tokenIdsLastSeenBy(aliceWs)).toContain("far-monster");
    });

    // In line of sight across an empty room, and still absent — because the
    // filter, not the renderer, decides.
    it("drops a token that is in sight but out of range", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 10 }, DM);

      const ids = tokenIdsLastSeenBy(aliceWs);
      expect(ids).toContain("alice-token"); // own token always survives
      expect(ids).not.toContain("far-monster");
    });

    it("never puts the out-of-range token's id in the player's bytes at all", () => {
      aliceWs.send.mockClear();
      dmWs.send.mockClear();
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 10 }, DM);
      route({ t: "chat", text: "ping" }, ALICE);

      expect(rawBytesSentTo(aliceWs)).not.toContain("far-monster");
      // NON-VACUITY, on ALICE's own log: an absence assertion is worthless if
      // she simply received nothing. Her own token proves frames arrived in
      // this window and were filtered, rather than never sent. (Checking the
      // DM's log instead would pass on frames from before the clear.)
      expect(rawBytesSentTo(aliceWs)).toContain("alice-token");
      // And the DM, who is not filtered, still gets the monster in this window.
      expect(rawBytesSentTo(dmWs)).toContain("far-monster");
    });

    it("brings it back when the radius is widened again", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 10 }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).not.toContain("far-monster");

      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 60 }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).toContain("far-monster");
    });

    it("blinds the player at radius zero without losing their own token", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 0 }, DM);

      const ids = tokenIdsLastSeenBy(aliceWs);
      expect(ids).toEqual(["alice-token"]);
    });
  });

  describe("the table default, through the real router", () => {
    // Nothing about any token changes here — only a room setting. Note this
    // exercises the SNAPSHOT path, which rebuilds vision per broadcast and is
    // therefore blind to a stale visionSignature; the cache guard is the
    // pointer-relay test below.
    it("clips a player who has no radius of their own, no token having moved", () => {
      route({ t: "chat", text: "ping" }, ALICE);
      expect(tokenIdsLastSeenBy(aliceWs)).toContain("far-monster");

      route({ t: "set-default-vision-radius", radius: 10 }, DM);

      const ids = tokenIdsLastSeenBy(aliceWs);
      expect(ids).toContain("alice-token");
      expect(ids).not.toContain("far-monster");
    });

    it("gives the sight back when the default is cleared", () => {
      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).not.toContain("far-monster");

      route({ t: "set-default-vision-radius", radius: null }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).toContain("far-monster");
    });

    it("lets a token's own radius override the table default", () => {
      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).not.toContain("far-monster");

      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 60 }, DM);
      expect(tokenIdsLastSeenBy(aliceWs)).toContain("far-monster");
    });

    it("refuses a player setting it, and the payloads do not move", () => {
      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      route({ t: "set-default-vision-radius", radius: 1000 }, ALICE);

      expect(roomService.getState().defaultVisionRadius).toBe(10);
      expect(tokenIdsLastSeenBy(aliceWs)).not.toContain("far-monster");
    });

    // The gap S7 documented and this slice closes. The respawn itself belongs
    // to AuthenticationHandler; what matters here is the shape it produces —
    // a fresh token with NO radius, nothing left to inherit from — and that
    // the table default clips it anyway.
    it("clips a token that respawned with nothing to inherit from", () => {
      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      route({ t: "delete-token", id: "alice-token" }, ALICE);

      roomService.setState({
        tokens: [
          ...roomService.getState().tokens,
          { id: "alice-respawn", owner: ALICE, x: 1, y: 1, color: "red" },
        ],
      });
      route({ t: "chat", text: "ping" }, ALICE);

      const ids = tokenIdsLastSeenBy(aliceWs);
      expect(ids).toContain("alice-respawn");
      expect(ids).not.toContain("far-monster");
    });
  });

  // The staleness landmine, driven through the REAL router cache rather than
  // through visionSignature directly. A player's `pointer-preview` is routed
  // per recipient through getVisionContextFor, which is the cached path.
  // (A DM's ping is narration and reaches everyone unfiltered, so it cannot
  // show this — Bob has to be the one pointing.)
  describe("the cached vision path sees the change immediately", () => {
    function pointerFramesSeenBy(socket: FakeSocket): number {
      return socket.send.mock.calls.filter(([payload]) => {
        const message = JSON.parse(String(payload)) as { t?: string };
        return message.t === "pointer-preview";
      }).length;
    }

    it("stops relaying a ping that a newly-limited player can no longer see", () => {
      // Warm the cache: with unlimited sight Bob's ping is inside Alice's.
      route({ t: "point", x: 275, y: 75 }, BOB);
      expect(pointerFramesSeenBy(aliceWs)).toBeGreaterThan(0);

      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 10 }, DM);
      aliceWs.send.mockClear();
      bobWs.send.mockClear();
      // The same ping, now 200 px away with a 100 px radius.
      route({ t: "point", x: 275, y: 75 }, BOB);

      expect(pointerFramesSeenBy(aliceWs)).toBe(0);
      // Bob still gets his own echo, so the router really did run.
      expect(pointerFramesSeenBy(bobWs)).toBeGreaterThan(0);
    });

    // The same landmine for the ROOM setting, and the only end-to-end guard
    // that a visionSignature missing the default actually has: the snapshot
    // path recomputes vision every broadcast and cannot show this.
    it("stops relaying a ping once the TABLE default puts it out of range", () => {
      route({ t: "point", x: 275, y: 75 }, BOB);
      expect(pointerFramesSeenBy(aliceWs)).toBeGreaterThan(0);

      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      aliceWs.send.mockClear();
      bobWs.send.mockClear();
      route({ t: "point", x: 275, y: 75 }, BOB);

      expect(pointerFramesSeenBy(aliceWs)).toBe(0);
      expect(pointerFramesSeenBy(bobWs)).toBeGreaterThan(0);
    });

    it("starts relaying again the moment the table default is cleared", () => {
      route({ t: "set-default-vision-radius", radius: 10 }, DM);
      aliceWs.send.mockClear();
      route({ t: "point", x: 275, y: 75 }, BOB);
      expect(pointerFramesSeenBy(aliceWs)).toBe(0);

      route({ t: "set-default-vision-radius", radius: null }, DM);
      aliceWs.send.mockClear();
      route({ t: "point", x: 275, y: 75 }, BOB);

      expect(pointerFramesSeenBy(aliceWs)).toBeGreaterThan(0);
    });

    it("starts relaying again the moment the radius is widened", () => {
      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 10 }, DM);
      aliceWs.send.mockClear();
      route({ t: "point", x: 275, y: 75 }, BOB);
      expect(pointerFramesSeenBy(aliceWs)).toBe(0);

      route({ t: "set-token-vision-radius", tokenId: "alice-token", radius: 60 }, DM);
      aliceWs.send.mockClear();
      route({ t: "point", x: 275, y: 75 }, BOB);

      expect(pointerFramesSeenBy(aliceWs)).toBeGreaterThan(0);
    });
  });
});
