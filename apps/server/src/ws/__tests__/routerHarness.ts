// ============================================================================
// ROUTER HARNESS — the §4.6 fixture for contract tests
// ============================================================================
// A contract test drives the REAL MessageRouter with real fake sockets: a
// directly-constructed handler stays green when route() never reaches it (the
// unhandled-message-acks-success failure), so every message type is proven
// reachable through route(). Three test files carried the same sixty lines;
// this is the one place the 13-argument router is built for tests.
//
// Timing trap: the broadcast is debounced 16 ms. `flush()` drains it, and a
// test must DRAIN before `mockClear`, or the pending timer fires into the
// cleared mock and reads as the next action having broadcast.

import path from "node:path";
import { vi } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "@herobyte/shared";
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
import { MapStudioService } from "../../domains/mapStudio/service.js";

export interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

export function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

export type Frame = ServerMessage & { t?: string };

export function framesOf(socket: FakeSocket): Frame[] {
  return socket.send.mock.calls.map(([payload]) => JSON.parse(payload as string) as Frame);
}

export function snapshotsOf(socket: FakeSocket): RoomSnapshot[] {
  return framesOf(socket).filter((frame) => frame.t === undefined) as unknown as RoomSnapshot[];
}

export function latestSnapshot(socket: FakeSocket): RoomSnapshot | undefined {
  const all = snapshotsOf(socket);
  return all[all.length - 1];
}

export function messagesOf(socket: FakeSocket, type: string): Frame[] {
  return framesOf(socket).filter((frame) => frame.t === type);
}

export function player(uid: string, isDM: boolean) {
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

export interface RouterHarness {
  router: MessageRouter;
  roomService: RoomService;
  mapStudioService: MapStudioService;
  sockets: Record<string, FakeSocket>;
  route(message: ClientMessage, senderUid: string): void;
}

/** A router over a fresh room holding `roster`, one fake socket per member. */
export function createRouterHarness(
  stateFileName: string,
  roster: { uid: string; isDM: boolean }[],
): RouterHarness {
  const roomService = new RoomService({
    stateFile: path.join(process.cwd(), ".tmp", stateFileName),
  });
  roomService.setState({
    players: roster.map((member) => player(member.uid, member.isDM)),
    tokens: [],
    pointers: [],
    sceneObjects: [],
    gridSize: 50,
    fogEnabled: false,
  });
  const sockets: Record<string, FakeSocket> = {};
  const uidToWs = new Map<string, WebSocket>();
  for (const member of roster) {
    const socket = fakeSocket();
    sockets[member.uid] = socket;
    uidToWs.set(member.uid, socket as unknown as WebSocket);
  }
  const clients = new Set<WebSocket>(uidToWs.values());
  const mapStudioService = new MapStudioService();
  const router = new MessageRouter(
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
    mapStudioService,
  );
  return {
    router,
    roomService,
    mapStudioService,
    sockets,
    route: (message, senderUid) => router.route(message, senderUid),
  };
}
