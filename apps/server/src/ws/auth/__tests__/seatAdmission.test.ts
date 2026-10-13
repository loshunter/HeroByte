// A full table gives a newcomer the longest-absent seat: only the seat goes, its
// characters stay unowned and the DM is told. The public table caps the seats one
// network holds and, once busy, how fast it takes new ones (the owner's calls,
// 2026-10-13, after the strict cap let a script lock the Main Hall).

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { Container } from "../../../container.js";
import { PlayerService } from "../../../domains/player/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { RoomService } from "../../../domains/room/service.js";
import { DM_ROLE_OWNER } from "../../../domains/room/dmDemotion.js";
import { provisionJoin, TABLE_SEAT_LIMIT } from "../joinProvisioning.js";
import {
  PUBLIC_RATE_FROM,
  PUBLIC_SEATS_PER_NETWORK,
  PUBLIC_STALE_SEAT_MS,
  STALE_SEAT_MS,
  SeatAdmission,
} from "../seatAdmission.js";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

function setup(roomId: "public" | "private", seats = TABLE_SEAT_LIMIT) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
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
  const admission = new SeatAdmission(services as unknown as Container, "public", {
    has: (uid: string) => sessions.has(uid),
  });
  // Every seat last seen a minute ago, each with its character and token.
  for (let n = 0; n < seats; n += 1) {
    provisionJoin(services as unknown as Container, room, state, `seat-${n}`);
    state.players.at(-1)!.lastHeartbeat = NOW - 60_000;
  }
  const seat = (uid: string) => state.players.find((player) => player.uid === uid)!;
  const seated = (uid: string) => state.players.some((player) => player.uid === uid);
  const admit = (uid: string, ip = "198.51.100.1") =>
    admission.refusal(state, roomId, uid, ip, NOW);
  return { ...services, state, sessions, seat, seated, admit };
}

describe("seat admission at a full table", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns a newcomer away when no seat has been away long enough, and says what frees one", () => {
    const { state, admit } = setup("private");
    const refusal = admit("newcomer");
    expect(refusal).toMatch(/^This table is full: it holds 30 seats/);
    expect(refusal).toMatch(/away 7 days/);
    expect(refusal).toMatch(/DM Menu → Table → Players at this table/);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT);
  });

  it("always lets a seat's own uid back in", () => {
    const { admit } = setup("private");
    expect(admit("seat-4")).toBeNull();
  });

  it("gives the longest-absent seat; its characters stay unowned, its token passes to the DM, and the DM is whispered", () => {
    const { state, seat, seated, admit } = setup("private");
    seat("seat-0").isDM = true;
    state.users.push("seat-0");
    seat("seat-3").lastHeartbeat = NOW - STALE_SEAT_MS - HOUR;
    seat("seat-9").lastHeartbeat = NOW - STALE_SEAT_MS - 2 * HOUR; // the longer gone
    const pc = state.characters.find((c) => c.ownedByPlayerUID === "seat-9")!;

    expect(admit("newcomer")).toBeNull();
    expect(seated("seat-9")).toBe(false);
    expect(seated("seat-3")).toBe(true);
    expect(state.characters.find((c) => c.id === pc.id)?.ownedByPlayerUID).toBeNull();
    expect(state.tokens.find((t) => t.id === pc.tokenId)?.owner).toBe("seat-0");
    const whisper = state.chatLog.at(-1)!;
    expect(whisper).toMatchObject({ authorUid: "seat-0", to: "seat-0", authorName: "HeroByte" });
    expect(whisper.text).toContain(pc.name);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT - 1);
  });

  it("passes the pieces to the DM role when no DM is at the table", () => {
    const { state, seat, admit } = setup("private");
    seat("seat-5").lastHeartbeat = NOW - STALE_SEAT_MS - HOUR;
    const pc = state.characters.find((c) => c.ownedByPlayerUID === "seat-5")!;
    expect(admit("newcomer")).toBeNull();
    expect(state.tokens.find((t) => t.id === pc.tokenId)?.owner).toBe(DM_ROLE_OWNER);
  });

  it("does not give a private seat away before 7 days, nor while a session could still bring its player back", () => {
    const { sessions, seat, admit } = setup("private");
    seat("seat-3").lastHeartbeat = NOW - STALE_SEAT_MS + HOUR;
    expect(admit("newcomer")).toMatch(/table is full/);
    seat("seat-3").lastHeartbeat = NOW - STALE_SEAT_MS - HOUR;
    sessions.add("seat-3");
    expect(admit("newcomer")).toMatch(/table is full/);
  });

  it("gives a public-table seat away after an hour, a lingering session or not", () => {
    const { sessions, seat, seated, admit } = setup("public");
    seat("seat-3").lastHeartbeat = NOW - PUBLIC_STALE_SEAT_MS - 1;
    sessions.add("seat-3");
    expect(admit("newcomer", "203.0.113.50")).toBeNull();
    expect(seated("seat-3")).toBe(false);
  });

  it("never gives away a DM's seat, a connected one, or one with a live socket", () => {
    const { state, liveSockets, seat, admit } = setup("private");
    const ancient = NOW - 30 * 24 * HOUR;
    for (const uid of ["seat-20", "seat-2", "seat-3"]) seat(uid).lastHeartbeat = ancient;
    seat("seat-0").isDM = true; // the DM at the table, who would inherit the seat's pieces
    seat("seat-20").isDM = true; // a co-DM long away: still never given away
    state.users.push("seat-2");
    liveSockets.set("seat-3", new Map([[{ readyState: 1 } as WebSocket, NOW - 1000]]));

    expect(admit("newcomer")).toMatch(/table is full/);
    expect(state.players).toHaveLength(TABLE_SEAT_LIMIT);
  });
});

describe("the public table's per-network limits", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Admit, then seat, the way the join would (seen a minute ago). */
  const join = (ctx: ReturnType<typeof setup>, uid: string, ip: string) => {
    const refusal = ctx.admit(uid, ip);
    if (refusal === null) {
      ctx.state.players.push({ uid, name: uid, isDM: false, lastHeartbeat: NOW - 60_000 } as never);
    }
    return refusal;
  };

  it("lets one network hold 6 seats, counting a /48 as one network, but not loopback or a private table", () => {
    const ctx = setup("public", 0);
    for (let n = 0; n < PUBLIC_SEATS_PER_NETWORK; n += 1) {
      // Different /64s inside one /48: one home.
      expect(join(ctx, `home-${n}`, `2001:db8:1:${n}`)).toBeNull();
    }
    expect(join(ctx, "home-6", "2001:db8:1:ff")).toMatch(/already holds 6 seats/);
    expect(join(ctx, "elsewhere", "203.0.113.6")).toBeNull();
    expect(ctx.admit("home-2", "2001:db8:1:2")).toBeNull(); // a seat's own uid returns
    for (let n = 0; n < PUBLIC_SEATS_PER_NETWORK + 2; n += 1) {
      expect(join(ctx, `local-${n}`, "127.0.0.1")).toBeNull();
    }

    const priv = setup("private", 0);
    for (let n = 0; n < PUBLIC_SEATS_PER_NETWORK + 2; n += 1) {
      expect(join(priv, `fresh-${n}`, "203.0.113.5")).toBeNull();
    }
  });

  it("frees a network's count when its seat is given away", () => {
    const ctx = setup("public", 0);
    for (let n = 0; n < PUBLIC_SEATS_PER_NETWORK; n += 1) {
      expect(join(ctx, `home-${n}`, "203.0.113.9")).toBeNull(); // quiet table: no rate limit
    }
    while (ctx.state.players.length < TABLE_SEAT_LIMIT) {
      join(ctx, `fill-${ctx.state.players.length}`, "127.0.0.1");
    }
    expect(join(ctx, "home-6", "203.0.113.9")).toMatch(/already holds 6 seats/);
    ctx.seat("home-0").lastHeartbeat = NOW - PUBLIC_STALE_SEAT_MS - 2;
    expect(join(ctx, "stranger", "127.0.0.1")).toBeNull(); // given home-0's seat
    expect(ctx.seated("home-0")).toBe(false);
    ctx.seat("fill-6").lastHeartbeat = NOW - PUBLIC_STALE_SEAT_MS - 1;
    expect(join(ctx, "home-7", "203.0.113.9")).toBeNull(); // five held now: one more fits
  });

  it("limits how fast a network takes new seats only once the table is busy", () => {
    const quiet = setup("public", 0);
    for (let n = 0; n < 5; n += 1) expect(join(quiet, `q-${n}`, `203.0.113.${n}`)).toBeNull();
    // Five networks, one seat each: no rate limit below PUBLIC_RATE_FROM.

    const busy = setup("public", PUBLIC_RATE_FROM);
    const results = Array.from({ length: 5 }, (_, n) => join(busy, `b-${n}`, "203.0.113.77"));
    expect(results.slice(0, 3)).toEqual([null, null, null]);
    expect(results[3]).toMatch(/joined this busy public table/);
  });
});
