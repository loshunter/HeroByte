// A full table reclaims its longest-absent seat for a newcomer, and the public table
// limits new seats per network (the owner's call, 2026-10-13, after the strict cap
// let a script lock the Main Hall and turned a DM away from their own table).

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { Container } from "../../../container.js";
import { PlayerService } from "../../../domains/player/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { RoomService } from "../../../domains/room/service.js";
import { provisionJoin, TABLE_SEAT_LIMIT } from "../joinProvisioning.js";
import {
  PUBLIC_NEW_SEATS_BURST,
  PUBLIC_STALE_SEAT_MS,
  STALE_SEAT_MS,
  SeatAdmission,
} from "../seatAdmission.js";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

function setup(roomId: "public" | "private") {
  const services = {
    playerService: new PlayerService(),
    characterService: new CharacterService(),
    tokenService: new TokenService(),
    selectionService: new SelectionService(),
    liveSockets: new Map<string, Map<WebSocket, number>>(),
  };
  const room = new RoomService({
    stateFile: path.join(process.cwd(), ".tmp", "seatAdmission-state.json"),
  });
  const state = room.getState();
  const sessions = new Set<string>();
  const seats = new SeatAdmission(services as unknown as Container, "public", (uid) =>
    sessions.has(uid),
  );
  // Every seat last seen a minute ago, each with its character and token.
  for (let n = 0; n < TABLE_SEAT_LIMIT; n += 1) {
    provisionJoin(services as unknown as Container, room, state, `seat-${n}`);
    state.players.at(-1)!.lastHeartbeat = NOW - 60_000;
  }
  const seat = (uid: string) => state.players.find((player) => player.uid === uid)!;
  const admit = (uid: string, ip = "198.51.100.1") => seats.refusal(state, roomId, uid, ip, NOW);
  return { ...services, state, sessions, seat, admit };
}

describe("seat admission at a full table", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns a newcomer away when every seat was used recently, and says what frees one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state, admit } = setup("private");
    expect(admit("newcomer")).toMatch(/^This table is full: it holds 30 seats/);
    expect(admit("newcomer")).toMatch(/DM Menu → Table → Players at this table/);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT);
  });

  it("always lets a seat's own uid back in", () => {
    const { admit } = setup("private");
    expect(admit("seat-4")).toBeNull();
  });

  it("gives a newcomer the longest-absent seat, its characters and token going with it", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { state, seat, admit } = setup("private");
    seat("seat-3").lastHeartbeat = NOW - STALE_SEAT_MS - HOUR;
    seat("seat-9").lastHeartbeat = NOW - STALE_SEAT_MS - 2 * HOUR; // the longer gone

    expect(admit("newcomer")).toBeNull();
    expect(state.players.some((player) => player.uid === "seat-9")).toBe(false);
    expect(state.players.some((player) => player.uid === "seat-3")).toBe(true);
    expect(state.characters.some((c) => c.ownedByPlayerUID === "seat-9")).toBe(false);
    expect(state.tokens.some((token) => token.owner === "seat-9")).toBe(false);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT - 1);
  });

  it("does not reclaim a private seat until it has been away 7 days", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { seat, admit } = setup("private");
    seat("seat-3").lastHeartbeat = NOW - STALE_SEAT_MS + HOUR;
    expect(admit("newcomer")).toMatch(/table is full/);
  });

  it("reclaims a public-table seat after an hour away", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { state, seat, admit } = setup("public");
    seat("seat-3").lastHeartbeat = NOW - PUBLIC_STALE_SEAT_MS - 1;
    expect(admit("newcomer")).toBeNull();
    expect(state.players.some((player) => player.uid === "seat-3")).toBe(false);
  });

  it("never reclaims the DM's seat, a connected one, one with a live socket, or one a session can still prove", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state, sessions, liveSockets, seat, admit } = setup("private");
    const ancient = NOW - 30 * 24 * HOUR;
    for (const uid of ["seat-20", "seat-2", "seat-3", "seat-4"]) seat(uid).lastHeartbeat = ancient;
    seat("seat-0").isDM = true; // the DM at the table, who would inherit the seat's pieces
    seat("seat-20").isDM = true; // a co-DM long away: still never reclaimed
    state.users.push("seat-2");
    liveSockets.set("seat-3", new Map([[{ readyState: 1 } as WebSocket, NOW - 1000]]));
    sessions.add("seat-4");

    expect(admit("newcomer")).toMatch(/table is full/);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT);
  });

  it("limits new seats per network on the public table, but not from loopback or on a private table", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { state, admit } = setup("public");
    state.players.splice(10); // room for everyone below
    for (let n = 0; n < PUBLIC_NEW_SEATS_BURST; n += 1) {
      expect(admit(`fresh-${n}`, "203.0.113.5")).toBeNull();
      state.players.push({ ...state.players[0]!, uid: `fresh-${n}` });
    }
    expect(admit("one-more", "203.0.113.5")).toMatch(/Too many new players from your network/);
    expect(admit("one-more", "203.0.113.6")).toBeNull();
    for (let n = 0; n < PUBLIC_NEW_SEATS_BURST + 2; n += 1) {
      expect(admit(`local-${n}`, "127.0.0.1")).toBeNull();
    }

    const priv = setup("private");
    priv.state.players.splice(10);
    for (let n = 0; n < PUBLIC_NEW_SEATS_BURST + 2; n += 1) {
      expect(priv.admit(`fresh-${n}`, "203.0.113.5")).toBeNull();
    }
  });
});
