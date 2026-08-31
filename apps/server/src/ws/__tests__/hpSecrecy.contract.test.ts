// ============================================================================
// MONSTER HP SECRECY CONTRACTS (S4)
// ============================================================================
// The DM's monster-HP display setting is enforced in the recipient filter:
// in "bloodied"/"hidden" mode an NPC's numbers must never SERIALIZE to a
// player socket — a renderer-side filter would pass a parsed-object check and
// fail the raw-bytes assertions here. Copies the chatSecrecy harness: real
// router, real room service, fake sockets, every frame inspected.

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

// Distinctive sentinels, checked STRUCTURALLY (leakSentinels.ts): the old
// raw-substring bar collided with `lastHeartbeat: Date.now()` — epoch
// 1788145099738 contains "9973", which is how CI #828 went red on
// byte-identical code that #827 had passed.
const SECRET_HP = 4471;
const SECRET_MAX_HP = 9973;
const SECRET_TEMP_HP = 3319;

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

/** NPC records from every full snapshot this socket received. */
function npcsSeenBy(socket: FakeSocket): SnapshotCharacter[] {
  const npcs: SnapshotCharacter[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(String(payload)) as {
      t?: string;
      characters?: SnapshotCharacter[];
    };
    if (message.t !== undefined) continue; // snapshots have no discriminator
    for (const character of message.characters ?? []) {
      if (character.type === "npc") npcs.push(character);
    }
  }
  return npcs;
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

function goblin() {
  return {
    id: "npc-goblin",
    type: "npc" as const,
    name: "Goblin 3",
    hp: SECRET_HP,
    maxHp: SECRET_MAX_HP,
    tempHp: SECRET_TEMP_HP,
    tokenId: null,
    ownedByPlayerUID: null,
    visibleToPlayers: true,
  };
}

describe("monster HP secrecy contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    // Snapshots are debounced in BroadcastService — every route() is followed
    // by a timer flush, or "it never leaked" passes for the wrong reason.
    vi.useFakeTimers();
    // Scratch state file, NOT the package-root default: broadcast() calls
    // saveState(), and the real file is the dev server's live table.
    roomService = new RoomService({
      stateFile: path.join(process.cwd(), ".tmp", "hp-secrecy-test-state.json"),
    });
    roomService.setState({
      players: [player(ALICE, false), player(DM, true)],
      characters: [goblin()],
      tokens: [],
      pointers: [],
      sceneObjects: [],
      chatLog: [],
      fogEnabled: false,
    });

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

  it("exact mode (the default) sends real numbers to everyone", () => {
    route({ t: "chat", text: "ping" }, ALICE); // any broadcast-triggering message

    const [npc] = npcsSeenBy(aliceWs);
    expect(npc?.hp).toBe(SECRET_HP);
    expect(npc?.maxHp).toBe(SECRET_MAX_HP);
    expect(npc?.hpBadge).toBeUndefined();
  });

  it("hidden mode: an NPC's numbers never serialize to a player socket", () => {
    route({ t: "set-monster-hp-display", mode: "hidden" }, DM);

    const [npc] = npcsSeenBy(aliceWs);
    expect(npc).toBeDefined();
    expect(npc?.hp).toBeUndefined();
    expect(npc?.maxHp).toBeUndefined();
    expect(npc?.tempHp).toBeUndefined();
    expect(npc?.hpBadge).toBeUndefined();
    // The raw-bytes bar: a renderer-side filter would pass the object checks
    // above and fail these.
    expect(sentinelHits(aliceWs, SECRET_HP)).toEqual([]);
    expect(sentinelHits(aliceWs, SECRET_MAX_HP)).toEqual([]);
    expect(sentinelHits(aliceWs, SECRET_TEMP_HP)).toEqual([]);
  });

  it("a heartbeat that spells the sentinel is not a leak — CI #828, replayed", () => {
    // The exact wild value: 2026-08-31T02:58:19.738Z, whose epoch contains
    // "9973". Under the old substring bar this test is red; the redaction
    // itself was working the whole time.
    for (const entry of roomService.getState().players) {
      entry.lastHeartbeat = 1788145099738;
    }
    route({ t: "set-monster-hp-display", mode: "hidden" }, DM);

    expect(npcsSeenBy(aliceWs).at(-1)?.maxHp).toBeUndefined();
    expect(sentinelHits(aliceWs, SECRET_MAX_HP)).toEqual([]);
  });

  it("the walk itself can fail: planted leaks are found, timestamps are not", () => {
    const planted = fakeSocket();
    planted.send(JSON.stringify({ renamed: { sneakyField: SECRET_MAX_HP } }));
    planted.send(JSON.stringify({ chatLog: [{ text: `the goblin has ${SECRET_MAX_HP} hp` }] }));
    planted.send(JSON.stringify({ lastHeartbeat: 1788145099738 }));

    const hits = sentinelHits(planted, SECRET_MAX_HP);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toContain("sneakyField");
    expect(hits[1]).toContain("chatLog");
  });

  it("bloodied mode: players get the coarse badge, never the numbers", () => {
    route({ t: "set-monster-hp-display", mode: "bloodied" }, DM);

    const [npc] = npcsSeenBy(aliceWs);
    // 4471 * 2 <= 9973 → bloodied by the 5e half-max rule.
    expect(npc?.hpBadge).toBe("bloodied");
    expect(npc?.hp).toBeUndefined();
    expect(npc?.tempHp).toBeUndefined();
    expect(sentinelHits(aliceWs, SECRET_HP)).toEqual([]);
    expect(sentinelHits(aliceWs, SECRET_MAX_HP)).toEqual([]);
    expect(sentinelHits(aliceWs, SECRET_TEMP_HP)).toEqual([]);
  });

  it("the DM always sees exact numbers, whatever the mode", () => {
    route({ t: "set-monster-hp-display", mode: "hidden" }, DM);

    const npcs = npcsSeenBy(dmWs);
    expect(npcs.at(-1)?.hp).toBe(SECRET_HP);
    expect(npcs.at(-1)?.maxHp).toBe(SECRET_MAX_HP);
  });

  it("PCs are never redacted — party health is the party's own information", () => {
    roomService.getState().characters.push({
      id: "pc-aria",
      type: "pc",
      name: "Aria",
      hp: 7717,
      maxHp: 7919,
      tokenId: null,
      ownedByPlayerUID: ALICE,
    });
    route({ t: "set-monster-hp-display", mode: "hidden" }, DM);

    // Structural, not substring: a timestamp that happened to spell these
    // digits would satisfy a raw toContain even with the PC over-redacted.
    expect(sentinelHits(aliceWs, 7717)).not.toEqual([]);
    expect(sentinelHits(aliceWs, 7919)).not.toEqual([]);
  });

  it("a player cannot change the mode", () => {
    route({ t: "set-monster-hp-display", mode: "hidden" }, ALICE);

    expect(roomService.getState().monsterHpDisplay).toBe("exact");
    // And the next broadcast still carries the numbers.
    route({ t: "chat", text: "ping" }, ALICE);
    const [npc] = npcsSeenBy(aliceWs);
    expect(npc?.hp).toBe(SECRET_HP);
  });

  it("a player cannot WRITE their way to a hidden monster's numbers", () => {
    // Write-side composition of the secrecy: update-character-hp is permission
    // gated (owner or DM), so choosing a monster's hp — and thereby knowing
    // it — is not available to players.
    route({ t: "set-monster-hp-display", mode: "hidden" }, DM);
    route({ t: "update-character-hp", characterId: "npc-goblin", hp: 1, maxHp: 1 }, ALICE);

    const state = roomService.getState();
    const npc = state.characters.find((c) => c.id === "npc-goblin");
    expect(npc?.hp).toBe(SECRET_HP); // unchanged
    expect(npc?.maxHp).toBe(SECRET_MAX_HP);
  });

  it("the session-export seed keeps exact numbers — a save file must restore them", () => {
    roomService.getState().monsterHpDisplay = "hidden";
    // Export builds with isDM=true (RoomMessageHandler): redaction is
    // per-recipient, not per-room, so the file itself stays whole.
    const seed = roomService.createSnapshotForPlayer(DM);
    const npc = seed.characters.find((c) => c.type === "npc");
    expect(npc?.hp).toBe(SECRET_HP);
  });
});
