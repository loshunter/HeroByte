// ============================================================================
// LIVE-BOUND DOOR-PRESERVATION REGRESSION CONTRACTS
// ============================================================================
// Regressions found by the S1 adversarial review of the live-recompile path:
//  1. Undoing a door back to "secret" must re-disguise it (no info leak).
//  2. A duplicate/replayed command must not slam a player-opened door shut.
//  3. Deleting the live-bound document must clear the binding (no resurrection).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type {
  ClientMessage,
  MapDoorElement,
  MapDoorState,
  MapWallElement,
  RoomSnapshot,
} from "@herobyte/shared";
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

const DM = "dm-player";
const PLAYER = "watcher";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}
const fakeSocket = (): FakeSocket => ({ readyState: 1, send: vi.fn() });
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 25));

function snapshotsOf(socket: FakeSocket): RoomSnapshot[] {
  return socket.send.mock.calls
    .map(([p]) => JSON.parse(p as string) as { t?: string })
    .filter((m) => m.t === undefined) as unknown as RoomSnapshot[];
}
const latestSnapshot = (socket: FakeSocket): RoomSnapshot | undefined => snapshotsOf(socket).at(-1);

function player(uid: string, isDM: boolean) {
  return {
    uid,
    name: uid,
    portrait: undefined,
    isDM,
    hp: 10,
    maxHp: 10,
    micLevel: 0,
    lastHeartbeat: 1,
    statusEffects: [],
  };
}

function doorElement(id: string, state: MapDoorState): MapDoorElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 40, state, blocksMovement: true, blocksVision: true },
  };
}

function wallElement(id: string): MapWallElement {
  return {
    id,
    layerId: "walls",
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };
}

describe("live-bound door-preservation regressions", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let dmWs: FakeSocket;
  let playerWs: FakeSocket;

  beforeEach(() => {
    roomService = new RoomService();
    roomService.setState({
      players: [player(DM, true), player(PLAYER, false)],
      tokens: [],
      pointers: [],
      sceneObjects: [],
      gridSize: 50,
      fogEnabled: false,
    });
    dmWs = fakeSocket();
    playerWs = fakeSocket();
    const uidToWs = new Map<string, WebSocket>([
      [DM, dmWs as unknown as WebSocket],
      [PLAYER, playerWs as unknown as WebSocket],
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

  afterEach(flush);

  const route = (message: ClientMessage, senderUid: string): void =>
    router.route(message, senderUid);
  const addElement = (
    documentId: string,
    baseRevision: number,
    element: MapDoorElement | MapWallElement,
    commandId: string,
  ): void =>
    route(
      {
        t: "map-studio-command",
        command: { type: "add-element", commandId, documentId, baseRevision, element },
      },
      DM,
    );

  it("re-disguises a door as secret when the DM undoes back to secret (no leak)", async () => {
    route({ t: "map-studio-create", document: { id: "live", name: "live" } }, DM);
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    addElement("live", 0, doorElement("door-a", "secret"), "add"); // rev 1: secret
    // DM makes it a normal closed door (rev 2), so a player is allowed to open it.
    route(
      {
        t: "map-studio-command",
        command: {
          type: "update-door",
          commandId: "u1",
          documentId: "live",
          baseRevision: 1,
          elementId: "door-a",
          state: "closed",
          width: 40,
        },
      },
      DM,
    );
    route({ t: "toggle-door", doorId: "door-a" }, PLAYER); // runtime -> open
    playerWs.send.mockClear();

    // DM undoes the update-door, restoring authored state "secret".
    route(
      {
        t: "map-studio-command",
        command: { type: "undo", commandId: "z1", documentId: "live", baseRevision: 2 },
      },
      DM,
    );
    await flush();

    // The door must be secret again on the server, and disguised for the player.
    expect(roomService.getState().compiledScene?.doors[0]?.state).toBe("secret");
    const playerScene = latestSnapshot(playerWs)?.compiledScene;
    expect(playerScene?.doors).toEqual([]);
    expect(playerScene?.walls.map((w) => w.id)).toContain("door-a#0");
  });

  it("keeps a player-opened door open when the same command is replayed (dedup)", async () => {
    route({ t: "map-studio-create", document: { id: "live", name: "live" } }, DM);
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    addElement("live", 0, doorElement("door-a", "closed"), "add"); // rev 1
    route({ t: "toggle-door", doorId: "door-a" }, PLAYER); // runtime -> open
    expect(roomService.getState().compiledScene?.doors[0]?.state).toBe("open");

    // The identical add-element command (same commandId) is replayed on a retry.
    addElement("live", 0, doorElement("door-a", "closed"), "add");
    await flush();

    // The dedup no-op must not re-author the door shut.
    expect(roomService.getState().compiledScene?.doors[0]?.state).toBe("open");
  });

  it("does not leak a live secret door after a stray publish of a copy that shares its door id", async () => {
    // Adversarial: d1 is live with a secret door dX; d2 is a copy authoring the
    // SAME element id dX as "open". Publishing d2 leaves state.compiledScene as
    // d2's scene; a later edit to live d1 must NOT graft d2's "open" onto d1's
    // secret door.
    route({ t: "map-studio-create", document: { id: "d1", name: "d1" } }, DM);
    route({ t: "map-studio-set-live", documentId: "d1" }, DM);
    addElement("d1", 0, doorElement("dX", "secret"), "a1"); // d1 rev 1: dX secret

    route({ t: "map-studio-create", document: { id: "d2", name: "d2" } }, DM);
    addElement("d2", 0, doorElement("dX", "open"), "a2"); // d2 rev 1: same id, open
    route(
      {
        t: "map-studio-publish",
        documentId: "d2",
        background: "x",
        backgroundMode: "elements-only",
      },
      DM,
    );

    playerWs.send.mockClear();
    // Unrelated edit to the still-live d1 (does not re-author dX).
    addElement("d1", 1, wallElement("w1"), "a3"); // d1 rev 2
    await flush();

    // d1's secret door stays secret on the server and disguised for the player.
    const dx = roomService.getState().compiledScene?.doors.find((d) => d.id === "dX");
    expect(dx?.state).toBe("secret");
    const playerScene = latestSnapshot(playerWs)?.compiledScene;
    expect(playerScene?.doors).toEqual([]);
    expect(playerScene?.walls.map((w) => w.id)).toContain("dX#0");
  });

  it("clears the binding when the live-bound document is deleted, so no re-bind resurrects it", async () => {
    route({ t: "map-studio-create", document: { id: "m", name: "m" } }, DM);
    route({ t: "map-studio-set-live", documentId: "m" }, DM);
    expect(roomService.getState().liveMapDocumentId).toBe("m");

    route({ t: "map-studio-delete", documentId: "m" }, DM);
    await flush(); // drain the delete's own (correct) broadcast before measuring
    expect(roomService.getState().liveMapDocumentId).toBeUndefined();

    // A fresh document reusing id "m" is NOT auto-live; editing it must not broadcast.
    route({ t: "map-studio-create", document: { id: "m", name: "m" } }, DM);
    playerWs.send.mockClear();
    addElement("m", 0, doorElement("door-a", "closed"), "add2");
    await flush();

    expect(snapshotsOf(playerWs)).toHaveLength(0);
  });
});
