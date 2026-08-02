// ============================================================================
// SECRECY CONTRACT TESTS — chat whispers
// ============================================================================
// The rule: a whisper addressed to A must never be serialized to B's socket.
// Not hidden in B's UI — absent from the bytes B receives.
//
// Like visionChannels.contract.test.ts, this drives the REAL MessageRouter
// with a REAL RoomService and fake sockets, then inspects every frame each
// recipient was actually sent. Asserting on a function's return value would
// prove nothing about what crossed the wire.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ChatMessage, ClientMessage, RoomSnapshot } from "@herobyte/shared";
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

const ALICE = "player-alice";
const BOB = "player-bob";
const DM = "dm-player";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

/** Every chat message this socket has been sent, across all snapshot frames. */
function chatSeenBy(socket: FakeSocket): ChatMessage[] {
  const seen: ChatMessage[] = [];
  for (const [payload] of socket.send.mock.calls) {
    const message = JSON.parse(payload as string) as RoomSnapshot & { t?: string };
    // Snapshots are the only frames with no `t` discriminator.
    if (message.t === undefined && message.chatLog) {
      seen.push(...message.chatLog);
    }
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

describe("chat secrecy contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let aliceWs: FakeSocket;
  let bobWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    // Full snapshots are debounced in BroadcastService, so every route() is
    // followed by a timer flush — otherwise the sockets receive nothing and
    // an "it never leaked" assertion would pass for the wrong reason.
    vi.useFakeTimers();
    roomService = new RoomService();
    roomService.setState({
      players: [player(ALICE, false), player(BOB, false), player(DM, true)],
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
    vi.advanceTimersByTime(50); // let the debounced snapshot go out
  }

  it("delivers a public message to the whole table", () => {
    route({ t: "chat", text: "the door creaks open" }, ALICE);

    for (const socket of [aliceWs, bobWs, dmWs]) {
      expect(chatSeenBy(socket).map((m) => m.text)).toContain("the door creaks open");
    }
  });

  it("a whisper to Alice never reaches Bob — not even in the raw bytes", () => {
    route({ t: "chat", text: "the vault code is 4471", to: ALICE }, DM);

    // The intended recipient and the author both see it.
    expect(chatSeenBy(aliceWs).map((m) => m.text)).toContain("the vault code is 4471");
    expect(chatSeenBy(dmWs).map((m) => m.text)).toContain("the vault code is 4471");

    // Bob sees no such message...
    expect(chatSeenBy(bobWs).map((m) => m.text)).not.toContain("the vault code is 4471");
    // ...and the string never appears anywhere in what his socket received,
    // which is the claim that actually matters. A renderer-side filter would
    // pass the assertion above and fail this one.
    expect(rawBytesSentTo(bobWs)).not.toContain("4471");
  });

  it("a whisper between two players is invisible to the DM", () => {
    // Chat secrecy is not role-based: being DM does not grant a read of
    // other people's private conversation. If that ever becomes a product
    // decision it should be a deliberate one, and this test should change
    // with it rather than silently already being false.
    route({ t: "chat", text: "lets split the loot before he notices", to: BOB }, ALICE);

    expect(chatSeenBy(aliceWs).map((m) => m.text)).toContain(
      "lets split the loot before he notices",
    );
    expect(chatSeenBy(bobWs).map((m) => m.text)).toContain("lets split the loot before he notices");
    expect(rawBytesSentTo(dmWs)).not.toContain("split the loot");
  });

  it("binds the author to the connection, so a client cannot post as someone else", () => {
    // The wire type has no author field at all, so forgery has to be
    // attempted by smuggling extra keys — which is exactly what a hand-built
    // client would do.
    route(
      {
        t: "chat",
        text: "I am definitely the DM",
        authorUid: DM,
        authorName: "dm-player",
        playerUid: DM,
      } as unknown as ClientMessage,
      BOB,
    );

    const delivered = chatSeenBy(dmWs).find((m) => m.text === "I am definitely the DM");
    expect(delivered).toBeDefined();
    expect(delivered?.authorUid).toBe(BOB);
    expect(delivered?.authorName).toBe("player-bob");
  });

  it("a whisper aimed at a uid nobody holds reaches only its author", () => {
    route({ t: "chat", text: "into the void", to: "ghost-uid" }, ALICE);

    expect(chatSeenBy(aliceWs).map((m) => m.text)).toContain("into the void");
    expect(rawBytesSentTo(bobWs)).not.toContain("into the void");
    expect(rawBytesSentTo(dmWs)).not.toContain("into the void");
  });

  it("keeps whispers out of the unfiltered snapshot that seeds forks and exports", () => {
    // createSnapshot() passes no recipient uid. The filter fails closed on
    // that, which is what stops a table fork or a session export from
    // carrying every private aside into a new table.
    route({ t: "chat", text: "public line" }, ALICE);
    route({ t: "chat", text: "private line", to: BOB }, ALICE);

    const forkSeed = roomService.createSnapshot();
    const texts = (forkSeed.chatLog ?? []).map((m) => m.text);
    expect(texts).toContain("public line");
    expect(texts).not.toContain("private line");
  });
});
