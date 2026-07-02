// ============================================================================
// SECRECY CONTRACT TESTS — vision-filtered outbound channels
// ============================================================================
// With fog enabled, a player's socket must never receive positions they
// cannot see: not in token deltas, not in drag previews, not in pointer
// pings. These tests drive the real MessageRouter with a real RoomService
// (real vision math) and fake sockets, then inspect every frame each
// recipient was sent.
//
// Scene: 400x400 map, vertical wall at pixel x=200. Tokens are grid cells
// (gridSize 50): the watcher's token sits at cell (1,3) — left side — so the
// right side of the map is hidden from them.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";
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

const MOVER = "player-mover";
const WATCHER = "player-watcher";
const DM = "dm-player";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

function framesOf(socket: FakeSocket, type: string): ServerMessage[] {
  return socket.send.mock.calls
    .map(([payload]) => JSON.parse(payload as string) as ServerMessage & { t?: string })
    .filter((message) => message.t === type || (type === "snapshot" && message.t === undefined));
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

describe("vision-filtered channel contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let moverWs: FakeSocket;
  let watcherWs: FakeSocket;
  let dmWs: FakeSocket;

  beforeEach(() => {
    roomService = new RoomService();
    roomService.setState({
      players: [player(MOVER, false), player(WATCHER, false), player(DM, true)],
      tokens: [
        // Mover's token starts on the hidden (right) side: cell (6,3) = px (325,175).
        { id: "t-mover", owner: MOVER, x: 6, y: 3, color: "red" },
        // Watcher's token watches from the left: cell (1,3) = px (75,175).
        { id: "t-watch", owner: WATCHER, x: 1, y: 3, color: "blue" },
      ],
      pointers: [],
      sceneObjects: [],
      gridSize: 50,
      fogEnabled: true,
      compiledScene: {
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
      },
    });

    moverWs = fakeSocket();
    watcherWs = fakeSocket();
    dmWs = fakeSocket();
    const uidToWs = new Map<string, WebSocket>([
      [MOVER, moverWs as unknown as WebSocket],
      [WATCHER, watcherWs as unknown as WebSocket],
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

  function route(message: ClientMessage, senderUid: string): void {
    router.route(message, senderUid);
  }

  describe("token-updated deltas", () => {
    it("sends the watcher only a contentless state-sync for hidden-to-hidden moves", () => {
      route({ t: "move", id: "t-mover", x: 6, y: 4 }, MOVER);

      expect(framesOf(dmWs, "token-updated")).toHaveLength(1);
      // The watcher's version stream stays gapless but carries no positions.
      expect(framesOf(watcherWs, "token-updated")).toHaveLength(0);
      expect(framesOf(watcherWs, "snapshot")).toHaveLength(0);
      expect(framesOf(watcherWs, "state-sync")).toHaveLength(1);
    });

    it("sends the mover a filtered snapshot so their own move reveals what it uncovers", () => {
      route({ t: "move", id: "t-mover", x: 6, y: 4 }, MOVER);

      // The mover's vision origin moved: a bare delta could not deliver
      // newly-visible entities, so they get a fresh filtered snapshot.
      expect(framesOf(moverWs, "token-updated")).toHaveLength(0);
      expect(framesOf(moverWs, "snapshot")).toHaveLength(1);
    });

    it("sends the mover a plain delta for a refused move (position unchanged)", () => {
      // Crossing the wall as a player is blocked; the corrective delta
      // carries the unchanged position back to the mover.
      route({ t: "move", id: "t-mover", x: 2, y: 3 }, MOVER);

      expect(framesOf(moverWs, "token-updated")).toHaveLength(1);
      expect(framesOf(moverWs, "snapshot")).toHaveLength(0);
    });

    it("never sends players a hidden NPC's delta, even with fog disabled", () => {
      roomService.setState({
        fogEnabled: false,
        characters: [
          {
            id: "npc-1",
            name: "Ambusher",
            type: "npc" as const,
            maxHp: 10,
            hp: 10,
            visibleToPlayers: false,
            tokenId: "t-npc",
            tokenImage: null,
          },
        ],
        tokens: [
          { id: "t-npc", owner: DM, x: 6, y: 3, color: "green" },
          { id: "t-watch", owner: WATCHER, x: 1, y: 3, color: "blue" },
        ],
      });

      route({ t: "move", id: "t-npc", x: 2, y: 3 }, DM);

      expect(framesOf(dmWs, "token-updated")).toHaveLength(1);
      expect(framesOf(watcherWs, "token-updated")).toHaveLength(0);
      expect(framesOf(watcherWs, "snapshot")).toHaveLength(0);
      expect(framesOf(watcherWs, "state-sync")).toHaveLength(1);
    });

    it("sends the watcher a filtered snapshot when a token enters their vision", () => {
      // The DM moves the mover's token through the wall to the visible side.
      route({ t: "move", id: "t-mover", x: 2, y: 3 }, DM);

      expect(framesOf(watcherWs, "token-updated")).toHaveLength(0);
      const snapshots = framesOf(watcherWs, "snapshot");
      expect(snapshots).toHaveLength(1);
      const tokenIds = (snapshots[0] as { tokens: { id: string }[] }).tokens.map((t) => t.id);
      expect(tokenIds).toContain("t-mover");
    });

    it("sends the watcher a filtered snapshot without the token when it leaves their vision", () => {
      // Start visible, then retreat behind the wall.
      route({ t: "move", id: "t-mover", x: 2, y: 3 }, DM);
      watcherWs.send.mockClear();

      route({ t: "move", id: "t-mover", x: 6, y: 3 }, DM);

      expect(framesOf(watcherWs, "token-updated")).toHaveLength(0);
      const snapshots = framesOf(watcherWs, "snapshot");
      expect(snapshots).toHaveLength(1);
      const tokenIds = (snapshots[0] as { tokens: { id: string }[] }).tokens.map((t) => t.id);
      expect(tokenIds).not.toContain("t-mover");
    });

    it("delivers visible-to-visible moves as plain deltas", () => {
      route({ t: "move", id: "t-mover", x: 2, y: 3 }, DM);
      watcherWs.send.mockClear();

      route({ t: "move", id: "t-mover", x: 2, y: 4 }, DM);

      expect(framesOf(watcherWs, "token-updated")).toHaveLength(1);
      expect(framesOf(watcherWs, "snapshot")).toHaveLength(0);
    });

    it("broadcasts unfiltered when fog is disabled", () => {
      roomService.setState({ fogEnabled: false });

      route({ t: "move", id: "t-mover", x: 6, y: 4 }, MOVER);

      expect(framesOf(watcherWs, "token-updated")).toHaveLength(1);
    });
  });

  describe("pointer previews", () => {
    it("hides pings inside rooms the watcher cannot see", () => {
      route({ t: "point", x: 325, y: 175 }, MOVER);

      expect(framesOf(moverWs, "pointer-preview")).toHaveLength(1);
      expect(framesOf(dmWs, "pointer-preview")).toHaveLength(1);
      expect(framesOf(watcherWs, "pointer-preview")).toHaveLength(0);
    });

    it("delivers pings the watcher can see", () => {
      route({ t: "point", x: 100, y: 175 }, MOVER);

      expect(framesOf(watcherWs, "pointer-preview")).toHaveLength(1);
    });

    it("always delivers DM pings — narration beats fog", () => {
      route({ t: "point", x: 325, y: 175 }, DM);

      expect(framesOf(watcherWs, "pointer-preview")).toHaveLength(1);
      expect(framesOf(moverWs, "pointer-preview")).toHaveLength(1);
    });
  });

  describe("drag previews", () => {
    it("strips hidden drag targets from the watcher's preview", () => {
      route({ t: "drag-preview", objects: [{ id: "token:t-mover", x: 6, y: 5 }] }, MOVER);

      expect(framesOf(moverWs, "drag-preview")).toHaveLength(1);
      expect(framesOf(dmWs, "drag-preview")).toHaveLength(1);
      expect(framesOf(watcherWs, "drag-preview")).toHaveLength(0);
    });

    it("delivers drag targets inside the watcher's vision", () => {
      route({ t: "drag-preview", objects: [{ id: "token:t-mover", x: 2, y: 3 }] }, MOVER);

      const frames = framesOf(watcherWs, "drag-preview") as {
        preview: { objects: unknown[] };
      }[];
      expect(frames).toHaveLength(1);
      expect(frames[0]!.preview.objects).toHaveLength(1);
    });

    it("always shows owners their own token being dragged by the DM", () => {
      // The DM drags the watcher's token deep into fog the watcher cannot see.
      route({ t: "drag-preview", objects: [{ id: "token:t-watch", x: 6, y: 5 }] }, DM);

      expect(framesOf(watcherWs, "drag-preview")).toHaveLength(1);
    });

    it("never previews hidden NPC tokens to players, even with fog disabled", () => {
      roomService.setState({
        fogEnabled: false,
        characters: [
          {
            id: "npc-1",
            name: "Ambusher",
            type: "npc" as const,
            maxHp: 10,
            hp: 10,
            visibleToPlayers: false,
            tokenId: "t-npc",
            tokenImage: null,
          },
        ],
        tokens: [
          { id: "t-npc", owner: DM, x: 6, y: 3, color: "green" },
          { id: "t-watch", owner: WATCHER, x: 1, y: 3, color: "blue" },
        ],
      });

      route({ t: "drag-preview", objects: [{ id: "token:t-npc", x: 2, y: 3 }] }, DM);

      expect(framesOf(dmWs, "drag-preview")).toHaveLength(1);
      expect(framesOf(watcherWs, "drag-preview")).toHaveLength(0);
    });
  });
});
