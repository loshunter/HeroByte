// ============================================================================
// MEASUREMENT CONTRACTS (S6)
// ============================================================================
// Two contracts, both on raw socket bytes because a parsed-object check would
// pass on a renderer-side fix:
//
//   1. The DIAGONAL RULE is per-room, DM-gated, and reaches every recipient
//      identically — a table that disagrees about the rule is a table that
//      disagrees about whether Grak is in range.
//   2. A relayed MEASUREMENT is stamped with the sender's identity FROM THE
//      CONNECTION and never enters room state — so a tampered client cannot
//      draw a line under another player's name, and a mouse drag cannot grow
//      the persisted snapshot.
//
// Copies the hpSecrecy harness: real router, real room service, fake sockets.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, MeasureEvent } from "@herobyte/shared";
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

function rawBytesSentTo(socket: FakeSocket): string {
  return socket.send.mock.calls.map(([payload]) => String(payload)).join("\n");
}

/** Every `t: "measure"` frame this socket received, in order. */
function measuresSeenBy(socket: FakeSocket): MeasureEvent[] {
  const events: MeasureEvent[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(String(payload)) as { t?: string; measure?: MeasureEvent };
    if (message.t === "measure" && message.measure) events.push(message.measure);
  }
  return events;
}

/** The diagonal rule in every full snapshot this socket received. */
function rulesSeenBy(socket: FakeSocket): unknown[] {
  const rules: unknown[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(String(payload)) as { t?: string; diagonalRule?: unknown };
    if (message.t !== undefined) continue; // snapshots carry no discriminator
    rules.push(message.diagonalRule);
  }
  return rules;
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

describe("measurement contracts (S6)", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let bobWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    // Snapshots are debounced in BroadcastService; without a timer flush the
    // "everyone saw it" assertions would pass for the wrong reason.
    vi.useFakeTimers();
    roomService = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "measurement-contract-state.json"),
    });
    roomService.setState({
      players: [player(ALICE, "Alice", false), player(BOB, "Bob", false), player(DM, "Dee", true)],
      characters: [],
      tokens: [],
      pointers: [],
      sceneObjects: [],
      chatLog: [],
      fogEnabled: false,
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

  describe("the diagonal rule", () => {
    it("defaults to 5e, not the Euclidean maths D11 complains about", () => {
      expect(roomService.getState().diagonalRule).toBe("5e");
    });

    it("a DM change reaches every recipient in the snapshot", () => {
      route({ t: "set-diagonal-rule", rule: "pathfinder" }, DM);

      expect(roomService.getState().diagonalRule).toBe("pathfinder");
      expect(rulesSeenBy(aliceWs).at(-1)).toBe("pathfinder");
      expect(rulesSeenBy(bobWs).at(-1)).toBe("pathfinder");
      expect(rulesSeenBy(dmWs).at(-1)).toBe("pathfinder");
    });

    it("a player cannot change the rule", () => {
      route({ t: "set-diagonal-rule", rule: "euclidean" }, ALICE);

      expect(roomService.getState().diagonalRule).toBe("5e");
      route({ t: "chat", text: "ping" }, ALICE);
      expect(rulesSeenBy(aliceWs).at(-1)).toBe("5e");
    });
  });

  describe("relayed measurements", () => {
    const LINE = { start: { x: 25, y: 25 }, end: { x: 125, y: 125 } };

    it("reaches the whole table, including the sender's own echo", () => {
      route({ t: "measure", measure: LINE }, ALICE);

      for (const socket of [aliceWs, bobWs, dmWs]) {
        const event = measuresSeenBy(socket).at(-1);
        expect(event?.uid).toBe(ALICE);
        expect(event?.start).toEqual(LINE.start);
        expect(event?.end).toEqual(LINE.end);
      }
    });

    it("stamps the author from the CONNECTION, not from the message", () => {
      // A tampered client smuggles someone else's identity BOTH at the top
      // level and INSIDE the measure payload. The inner one is the one that
      // matters: the dispatcher hands the handler `message.measure` and
      // nothing else, so a handler that spread it — or read `measure.uid` —
      // would relay a line under Bob's name. (A sabotage that forged only the
      // top-level field left this test green, which is why it forges both.)
      const forged = {
        t: "measure",
        measure: { ...LINE, uid: BOB, name: "Bob" },
        uid: BOB,
        name: "Bob",
      } as unknown as ClientMessage;
      route(forged, ALICE);

      const event = measuresSeenBy(bobWs).at(-1);
      expect(event?.uid).toBe(ALICE);
      expect(event?.name).toBe("Alice");
      // And nothing else rode along: the event carries exactly four fields.
      expect(Object.keys(event ?? {}).sort()).toEqual(["end", "name", "start", "uid"]);
      // Raw bytes, so a renderer-side fix could not pass this.
      expect(rawBytesSentTo(bobWs)).not.toContain('"name":"Bob"');
    });

    it("relays a null measurement as an endpoint-less event, which clears the line", () => {
      route({ t: "measure", measure: LINE }, ALICE);
      route({ t: "measure", measure: null }, ALICE);

      const event = measuresSeenBy(bobWs).at(-1);
      expect(event?.uid).toBe(ALICE);
      expect(event?.start).toBeUndefined();
      expect(event?.end).toBeUndefined();
    });

    it("never writes to room state, so a mouse drag cannot grow the table", () => {
      const before = JSON.stringify(roomService.getState());
      route({ t: "measure", measure: LINE }, ALICE);
      const after = roomService.getState();

      expect(JSON.stringify(after)).toBe(before);
      // Nothing named "measure" exists on state at all.
      expect(Object.keys(after)).not.toContain("measurements");
    });

    it("does not force a full snapshot — the relay is its own channel", () => {
      const before = roomService.getState().stateVersion;
      route({ t: "measure", measure: LINE }, ALICE);

      expect(roomService.getState().stateVersion).toBe(before);
      // Bob got the measure frame and no snapshot alongside it.
      const frames = bobWs.send.mock.calls.map(([payload]) =>
        JSON.parse(String(payload)),
      ) as Array<{ t?: string }>;
      // Length first: `every` on an empty array is true, so without this the
      // assertion below would pass on a relay that sent nothing at all.
      expect(frames).toHaveLength(1);
      expect(frames.every((frame) => frame.t === "measure")).toBe(true);
    });

    it("relays no frame at all when nobody measured", () => {
      route({ t: "chat", text: "ping" }, ALICE);

      expect(measuresSeenBy(bobWs)).toHaveLength(0);
      expect(rawBytesSentTo(bobWs)).not.toContain('"t":"measure"');
    });

    // Coordinate shape is the VALIDATOR's contract, tested in
    // middleware/__tests__/validation.test.ts. It cannot be tested here:
    // `router.route()` is called after MessagePipelineManager has already
    // validated, so a malformed frame reaching this harness reaches the
    // handler too. (The same gap hid an untested validator in S5.)
  });
});
