// ============================================================================
// SECRECY + FORGERY CONTRACT TESTS — dice (S5)
// ============================================================================
// Two rules, one harness.
//
//   1. A roll's numbers and its author are the SERVER's. A client that sends a
//      total, a uid or a name alongside its formula must lose all three (arc
//      defect D2).
//   2. A `self` or `dm` roll must never be serialized to a socket that should
//      not have it. Not hidden in that client's UI — absent from the bytes it
//      receives. A renderer-side filter passes an object check and fails the
//      raw-bytes assertions below.
//
// Copies the chatSecrecy/hpSecrecy harness: real MessageRouter, real
// RoomService, fake sockets, every frame inspected. Asserting on a function's
// return value would prove nothing about what crossed the wire.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, DiceRoll, RoomSnapshot } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { TokenService } from "../../domains/token/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { AuthService } from "../../domains/auth/service.js";
import { DisconnectionCleanupManager } from "../lifecycle/DisconnectionCleanupManager.js";

const ALICE = "player-alice";
const BOB = "player-bob";
const DM = "dm-player";

// Values that cannot collide with anything else in a frame, so a raw-bytes
// not.toContain is meaningful. The modifier rides in the formula AND the
// total, so one string proves the whole record stayed out.
const SECRET_MOD = 9973;
const SECRET_FORMULA = `d4 + ${SECRET_MOD}`;
/** What a forging client claims. Nothing legitimate produces this number. */
const FORGED_TOTAL = 424242;

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

/** Every dice roll this socket has been sent, across all snapshot frames. */
function rollsSeenBy(socket: FakeSocket): DiceRoll[] {
  const seen: DiceRoll[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(String(payload)) as RoomSnapshot & { t?: string };
    // Snapshots are the only frames with no `t` discriminator.
    if (message.t === undefined && message.diceRolls) seen.push(...message.diceRolls);
  }
  return seen;
}

/** The raw bytes a socket received — the strongest form of the assertion. */
function rawBytesSentTo(socket: FakeSocket): string {
  return socket.send.mock.calls.map(([payload]) => String(payload)).join("\n");
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

describe("dice secrecy and forgery contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let bobWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    // Full snapshots are debounced in BroadcastService, so every route() is
    // followed by a timer flush — otherwise the sockets receive nothing and an
    // "it never leaked" assertion would pass for the wrong reason.
    vi.useFakeTimers();
    // Scratch state file, NOT the package-root default: broadcast() calls
    // saveState(), and the real file is the dev server's live table.
    roomService = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "dice-secrecy-test-state.json"),
    });
    roomService.setState({
      players: [player(ALICE, false), player(BOB, false), player(DM, true)],
      tokens: [],
      pointers: [],
      sceneObjects: [],
      chatLog: [],
      diceRolls: [],
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
    vi.advanceTimersByTime(50); // let the debounced snapshot go out
  }

  // --------------------------------------------------------------------------
  // The numbers and the author are the server's
  // --------------------------------------------------------------------------

  it("rolls a public formula for the whole table", () => {
    route({ t: "dice-roll", formula: "d20 + 3" }, ALICE);

    for (const socket of [aliceWs, bobWs, dmWs]) {
      const roll = rollsSeenBy(socket).at(-1);
      expect(roll?.formula).toBe("d20 + 3");
      expect(roll?.playerUid).toBe(ALICE);
      expect(roll?.playerName).toBe(ALICE);
      // The server rolled it, so the total is a real d20 plus three.
      expect(roll?.total).toBeGreaterThanOrEqual(4);
      expect(roll?.total).toBeLessThanOrEqual(23);
    }
  });

  it("ignores a total, a breakdown, a uid and a name sent with the formula", () => {
    // Exactly what devtools would send. Every one of these fields used to be
    // stored verbatim and re-broadcast.
    route(
      {
        t: "dice-roll",
        formula: "d20",
        total: FORGED_TOTAL,
        playerUid: DM,
        playerName: "The Dungeon Master",
        breakdown: [{ tokenId: "t0", die: "d20", rolls: [20], subtotal: FORGED_TOTAL }],
        id: "forged-id",
        timestamp: 0,
      } as unknown as ClientMessage,
      ALICE,
    );

    const roll = rollsSeenBy(dmWs).at(-1);
    expect(roll?.playerUid).toBe(ALICE);
    expect(roll?.playerName).toBe(ALICE);
    expect(roll?.total).toBeGreaterThanOrEqual(1);
    expect(roll?.total).toBeLessThanOrEqual(20);
    expect(roll?.id).not.toBe("forged-id");
    expect(roll?.timestamp).toBeGreaterThan(0);

    // ...and the claimed number never appears in what ANY socket received.
    for (const socket of [aliceWs, bobWs, dmWs]) {
      expect(rawBytesSentTo(socket)).not.toContain(String(FORGED_TOTAL));
    }
  });

  it("refuses a formula that does not parse, rather than storing it", () => {
    route({ t: "dice-roll", formula: "2d7 + haha" }, ALICE);

    expect(roomService.getState().diceRolls).toHaveLength(0);
    // A refused roll must not even cost a broadcast. Asserting the bytes do
    // not contain "haha" would be worthless here — nothing is sent at all, so
    // it would pass against an empty string no matter what the server did.
    expect(bobWs.send).not.toHaveBeenCalled();
  });

  it("ships a plain public roll with no mode and no visibility key at all", () => {
    // The compatibility contract with every pre-S5 persisted roll: absent
    // reads as normal/public. Setting them unconditionally would be invisible
    // in the UI and would change what a session file round-trips.
    route({ t: "dice-roll", formula: "d20" }, ALICE);

    const roll = roomService.getState().diceRolls.at(-1)!;
    expect("mode" in roll).toBe(false);
    expect("visibility" in roll).toBe(false);
    expect(rawBytesSentTo(aliceWs)).not.toContain('"visibility"');
  });

  it("records advantage the server actually applied, not the mode a client claims", () => {
    route({ t: "dice-roll", formula: "d20", mode: "advantage" }, ALICE);
    const advantage = roomService.getState().diceRolls.at(-1);
    expect(advantage?.mode).toBe("advantage");
    expect(advantage?.breakdown[0]?.dropped).toHaveLength(1);

    // No die to double: the badge would be a lie, so it is not set.
    route({ t: "dice-roll", formula: "+2", mode: "advantage" }, ALICE);
    const modifierOnly = roomService.getState().diceRolls.at(-1);
    expect(modifierOnly?.mode).toBeUndefined();
    expect(modifierOnly?.total).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Visibility
  // --------------------------------------------------------------------------

  it("keeps a `self` roll out of every other socket, DM included", () => {
    // A public roll FIRST, so the negatives below are meaningful: every socket
    // is provably receiving roll history, and an empty payload would fail here
    // rather than passing the not.toContain assertions for the wrong reason.
    route({ t: "dice-roll", formula: "d8 + 1" }, BOB);
    for (const socket of [aliceWs, bobWs, dmWs]) {
      expect(rollsSeenBy(socket).map((r) => r.formula)).toContain("d8 + 1");
    }

    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, ALICE);

    expect(rollsSeenBy(aliceWs).map((r) => r.formula)).toContain(SECRET_FORMULA);
    expect(rollsSeenBy(bobWs).map((r) => r.formula)).not.toContain(SECRET_FORMULA);
    // A DM is a player at the table, not an auditor of everyone's private
    // dice — the same call visibleChatFor makes for whispers.
    expect(rollsSeenBy(dmWs).map((r) => r.formula)).not.toContain(SECRET_FORMULA);

    // The claim that actually matters: the string is nowhere in their bytes.
    expect(rawBytesSentTo(bobWs)).not.toContain(String(SECRET_MOD));
    expect(rawBytesSentTo(dmWs)).not.toContain(String(SECRET_MOD));
  });

  it("delivers a `dm` roll to its author and the DM, and nobody else", () => {
    route({ t: "dice-roll", formula: "d8 + 1" }, BOB); // positive control
    expect(rollsSeenBy(bobWs).map((r) => r.formula)).toContain("d8 + 1");

    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "dm" }, ALICE);

    expect(rollsSeenBy(aliceWs).map((r) => r.formula)).toContain(SECRET_FORMULA);
    expect(rollsSeenBy(dmWs).map((r) => r.formula)).toContain(SECRET_FORMULA);
    expect(rollsSeenBy(bobWs).map((r) => r.formula)).not.toContain(SECRET_FORMULA);
    expect(rawBytesSentTo(bobWs)).not.toContain(String(SECRET_MOD));
  });

  it("a player cannot reveal someone else's private roll by re-rolling it", () => {
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, ALICE);
    const hidden = roomService.getState().diceRolls.at(-1);

    // BOB tries to launder it into the open under ALICE's name.
    route(
      {
        t: "dice-roll",
        formula: SECRET_FORMULA,
        visibility: "public",
        playerUid: ALICE,
        id: hidden?.id,
      } as unknown as ClientMessage,
      BOB,
    );

    const laundered = roomService.getState().diceRolls.at(-1);
    expect(laundered?.playerUid).toBe(BOB);
    expect(laundered?.id).not.toBe(hidden?.id);
    // ALICE's own roll is untouched and still hers alone.
    expect(roomService.getState().diceRolls[0]?.visibility).toBe("self");
    expect(roomService.getState().diceRolls[0]?.playerUid).toBe(ALICE);
  });

  it("treats an unrecognized visibility as private, not public", () => {
    // What a corrupt or forward-dated state file looks like.
    roomService.getState().diceRolls.push({
      id: "poisoned",
      playerUid: ALICE,
      playerName: ALICE,
      formula: SECRET_FORMULA,
      total: SECRET_MOD + 1,
      breakdown: [{ tokenId: "t0", subtotal: SECRET_MOD + 1 }],
      visibility: "everyone" as unknown as DiceRoll["visibility"],
      timestamp: Date.now(),
    });
    route({ t: "dice-roll", formula: "d6" }, BOB); // force a broadcast

    expect(rawBytesSentTo(bobWs)).not.toContain(String(SECRET_MOD));
    expect(rawBytesSentTo(dmWs)).not.toContain(String(SECRET_MOD));
    expect(rollsSeenBy(aliceWs).map((r) => r.id)).toContain("poisoned");
  });

  it("does not let one player disconnecting erase everyone else's private rolls", () => {
    // The regression chatSecrecy documents: cleanup broadcast once omitted
    // uidToWs, every recipient resolved to undefined, the filter failed closed,
    // and the frame shipped a log with EVERY private entry stripped — to its
    // own author included. The client replaces its log wholesale from each
    // snapshot, so an unrelated tab closing silently wiped the screen.
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, ALICE);

    const uidToWs = new Map<string, WebSocket>([
      [ALICE, aliceWs as unknown as WebSocket],
      [BOB, bobWs as unknown as WebSocket],
      [DM, dmWs as unknown as WebSocket],
    ]);
    const cleanup = new DisconnectionCleanupManager(
      {
        getRoomIdForUid: () => "default",
        getRoomServiceForRoom: () => roomService,
        getAuthenticatedClientsForRoom: () =>
          new Set<WebSocket>([
            aliceWs as unknown as WebSocket,
            bobWs as unknown as WebSocket,
            dmWs as unknown as WebSocket,
          ]),
        selectionService: new SelectionService(),
      },
      uidToWs,
      new Set<string>([ALICE, BOB, DM, "bystander"]),
      new Map<string, { roomId: string; authedAt: number }>(),
    );

    aliceWs.send.mockClear();
    bobWs.send.mockClear();
    dmWs.send.mockClear();

    // An UNRELATED player's tab closes.
    cleanup.cleanupPlayer("bystander", {});

    // Everyone got a frame from the cleanup broadcast — otherwise the two
    // not.toContain assertions below would pass against empty strings.
    for (const socket of [aliceWs, bobWs, dmWs]) {
      expect(socket.send).toHaveBeenCalled();
    }
    expect(rollsSeenBy(aliceWs).map((r) => r.formula)).toContain(SECRET_FORMULA);
    // ...and it still does not reach anyone else.
    expect(rawBytesSentTo(bobWs)).not.toContain(String(SECRET_MOD));
    expect(rawBytesSentTo(dmWs)).not.toContain(String(SECRET_MOD));
  });

  it("does not let a player wipe rolls they were never allowed to see", () => {
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, ALICE);
    route({ t: "dice-roll", formula: "d20" }, DM);
    expect(roomService.getState().diceRolls).toHaveLength(2);

    route({ t: "clear-roll-history" }, BOB);

    expect(roomService.getState().diceRolls).toHaveLength(2);
    expect(rollsSeenBy(aliceWs).map((r) => r.formula)).toContain(SECRET_FORMULA);
  });

  it("lets the DM clear the shared log", () => {
    route({ t: "dice-roll", formula: "d20" }, ALICE);
    expect(roomService.getState().diceRolls).toHaveLength(1);

    route({ t: "clear-roll-history" }, DM);

    expect(roomService.getState().diceRolls).toHaveLength(0);
  });

  it("survives a poisoned non-array diceRolls instead of taking the process down", () => {
    // Defence in depth behind the load-session validator: a state file written
    // before that guard existed can still hold one, and this runs inside the
    // debounced broadcast timer where a throw kills the process.
    (roomService.getState() as unknown as { diceRolls: unknown }).diceRolls = { not: "an array" };

    expect(() => roomService.createSnapshotForPlayer(ALICE)).not.toThrow();
    expect(roomService.createSnapshotForPlayer(ALICE).diceRolls).toEqual([]);
  });

  it("keeps private rolls out of the unfiltered snapshot that seeds a fork", () => {
    // createSnapshot() passes no recipient uid. The filter fails closed on
    // that, which is what stops a table fork carrying the old table's secrets.
    route({ t: "dice-roll", formula: "d20" }, ALICE);
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, ALICE);
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "dm" }, BOB);

    const forkSeed = roomService.createSnapshot();
    expect(forkSeed.diceRolls.map((r) => r.formula)).toContain("d20");
    expect(JSON.stringify(forkSeed)).not.toContain(String(SECRET_MOD));
  });

  it("keeps private rolls out of an exported session file", () => {
    route({ t: "dice-roll", formula: "d20" }, DM);
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "self" }, DM);
    route({ t: "dice-roll", formula: SECRET_FORMULA, visibility: "dm" }, ALICE);

    dmWs.send.mockClear();
    route({ t: "session-export" }, DM);

    const file = dmWs.send.mock.calls
      .map(([payload]) => JSON.parse(String(payload)) as { t?: string; file?: unknown })
      .find((message) => message.t === "session-file");
    expect(file).toBeDefined();
    // The export is built with the DM's own recipient uid, so their `self`
    // roll and every `dm` roll passed the filter — a file handed to other
    // people must not carry either.
    expect(JSON.stringify(file)).toContain("d20");
    expect(JSON.stringify(file)).not.toContain(String(SECRET_MOD));
  });
});
