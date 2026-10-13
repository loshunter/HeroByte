// ============================================================================
// SEAT ADMISSION — who may take a NEW seat at a table
// ============================================================================
// A table holds TABLE_SEAT_LIMIT seats, and a seat outlives its player. Held
// strictly (the first cap, c7f45eaa) that locked tables shut: scripted joins
// filled the public table for free, and a DM on a new browser was turned away
// from their own full table with no way in to remove anyone. The owner's
// answers (2026-10-13):
//
// - A full table gives a newcomer the longest-absent seat: never a DM's, never
//   one on the authenticated roster or with an open socket, and only once its
//   player has been away STALE_SEAT_MS (PUBLIC_STALE_SEAT_MS on the public
//   table). On a private table a session token still provable also protects
//   it; on the public table, a scratch space that wipes itself, an hour is the
//   rule. (The old token is left alone: it proves the uid at other tables too,
//   and a returning player is simply a newcomer here.)
// - Only the SEAT goes. Its characters stay on the table unowned (the DM's
//   Owner menu hands them back, or anyone may claim them), its tokens and
//   parked pieces pass to the table's DM, and every DM is whispered which seat
//   went, in chat, where an absent DM finds it later.
// - On the public table one network holds at most PUBLIC_SEATS_PER_NETWORK
//   seats, and once the table is nearly full (PUBLIC_RATE_FROM seats) a network
//   takes new seats at a limited rate. Called only after the password and the
//   session checks pass, so every token spent is a real join.

import type { Player } from "@herobyte/shared";
import type { Container } from "../../container.js";
import type { RoomState } from "../../domains/room/model.js";
import { ChatService } from "../../domains/chat/service.js";
import { handParkedPieces, heirOf } from "../../domains/room/dmDemotion.js";
import { TokenBucketLimiter } from "../../middleware/authWorkLimit.js";
import { HELD_SOCKET_TTL_MS } from "../handlers/removePlayer.js";
import { TABLE_SEAT_LIMIT } from "./joinProvisioning.js";

/** A private table's seat with no heartbeat this long can go to a newcomer at a full table. */
export const STALE_SEAT_MS = 7 * 24 * 60 * 60 * 1000;
/** The same on the public table, where anyone with the published password can join. */
export const PUBLIC_STALE_SEAT_MS = 60 * 60 * 1000;
/** Seats one network may hold at once on the public table. */
export const PUBLIC_SEATS_PER_NETWORK = 6;
/** From this many seats on the public table, a network takes new ones at a limited rate. */
export const PUBLIC_RATE_FROM = 20;
const PUBLIC_RATE_BURST = 3;
const PUBLIC_RATE_REFILL_PER_SECOND = 1 / 600;

/** The dev server, e2e and the docs harness: dozens of uids, one machine. ("::1" keys as 0:0:0:0.) */
const LOOPBACK = new Set(["127.0.0.1", "0:0:0:0"]);

export interface SeatSessions {
  has(uid: string, now: number): boolean;
}

/** A network's key for seat counting: IPv6 at /48 (a home is routed a /56 or wider). */
function networkKey(ip: string): string {
  return ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip;
}

export class SeatAdmission {
  private readonly publicRate = new TokenBucketLimiter({
    capacity: PUBLIC_RATE_BURST,
    refillPerSecond: PUBLIC_RATE_REFILL_PER_SECOND,
  });
  /** uid → network, for the public table's seats taken since this process started. */
  private readonly networkOf = new Map<string, string>();
  private readonly chat = new ChatService();

  constructor(
    private readonly container: Container,
    private readonly publicRoomId: string,
    private readonly sessions: SeatSessions,
  ) {}

  /**
   * Why `uid` may not take a seat here, or null. A seat's own uid always may (a
   * reconnect). When it admits a newcomer to a full table it RELEASES the
   * longest-absent seat first, so call it only once the join is otherwise certain.
   */
  refusal(state: RoomState, roomId: string, uid: string, ip: string, now: number): string | null {
    if (state.players.some((player) => player.uid === uid)) return null;
    const isPublic = roomId === this.publicRoomId;
    const net = networkKey(ip);
    const limited = isPublic && !LOOPBACK.has(ip);
    if (limited && this.seatsHeldBy(state, net) >= PUBLIC_SEATS_PER_NETWORK) {
      console.warn(`[Auth] ${uid} turned away: ${net} holds ${PUBLIC_SEATS_PER_NETWORK} seats`);
      return `Your network already holds ${PUBLIC_SEATS_PER_NETWORK} seats at this public table, the most one network may. A seat frees an hour after its player leaves; or start a private table of your own.`;
    }
    const full = state.players.length >= TABLE_SEAT_LIMIT;
    const stale = full ? this.staleSeat(state, isPublic, now) : undefined;
    if (full && !stale) {
      console.warn(`[Auth] ${uid} turned away: the table holds ${state.players.length} seats`);
      return `This table is full: it holds ${TABLE_SEAT_LIMIT} seats, and none can go to a newcomer yet. A seat goes to a newcomer once its player has been away ${isPublic ? "an hour" : "7 days"}; a DM's seat never does. Ask the DM to remove an absent player (DM Menu → Table → Players at this table), then try again. If you are the DM, sign in from a browser that already has a seat here.`;
    }
    if (limited && state.players.length >= PUBLIC_RATE_FROM && !this.publicRate.take(net, now)) {
      console.warn(`[Auth] ${uid} turned away: new seats from ${net} rate-limited`);
      return "Several players from your network joined this busy public table in the last few minutes. Wait ten minutes and try again, or start a private table of your own.";
    }
    if (stale) this.release(state, stale, uid);
    if (isPublic) this.networkOf.set(uid, net);
    return null;
  }

  private seatsHeldBy(state: RoomState, net: string): number {
    return state.players.filter((player) => this.networkOf.get(player.uid) === net).length;
  }

  /** The longest-absent seat nobody could be sitting in, or undefined. */
  private staleSeat(state: RoomState, isPublic: boolean, now: number): Player | undefined {
    const staleMs = isPublic ? PUBLIC_STALE_SEAT_MS : STALE_SEAT_MS;
    const candidates = state.players.filter(
      (player) =>
        !player.isDM &&
        !state.users.includes(player.uid) &&
        !this.hasLiveSocket(player.uid, now) &&
        (isPublic || !this.sessions.has(player.uid, now)) &&
        now - (player.lastHeartbeat ?? 0) >= staleMs,
    );
    return candidates.sort((a, b) => (a.lastHeartbeat ?? 0) - (b.lastHeartbeat ?? 0))[0];
  }

  /** Any open socket for the uid younger than the held-socket window (removePlayer's own test). */
  private hasLiveSocket(uid: string, now: number): boolean {
    return [...(this.container.liveSockets.get(uid) ?? [])].some(
      ([socket, since]) => socket.readyState === 1 && now - since < HELD_SOCKET_TTL_MS,
    );
  }

  /** The seat row goes; its characters stay, unowned; its pieces pass to the DM, who is told. */
  private release(state: RoomState, seat: Player, newcomer: string): void {
    const heir = heirOf(state);
    const kept = state.characters.filter((c) => c.ownedByPlayerUID === seat.uid);
    for (const character of kept) character.ownedByPlayerUID = null;
    for (const token of state.tokens) if (token.owner === seat.uid) token.owner = heir;
    handParkedPieces(state, new Set([seat.uid]), heir);
    this.container.selectionService.deselect(state, seat.uid);
    this.container.playerService.removePlayer(state, seat.uid);
    this.networkOf.delete(seat.uid);
    const names = kept.map((c) => c.name).join(", ");
    const text = `A newcomer was given ${seat.name}'s seat (away since ${new Date(seat.lastHeartbeat ?? 0).toISOString().slice(0, 10)}). ${kept.length > 0 ? `Their characters stay on the table with no owner: ${names}. Hand them back with the Owner menu.` : "They had no characters."}`;
    for (const dm of state.players.filter((player) => player.isDM)) {
      this.chat.addMessage(state, dm.uid, "HeroByte", text, dm.uid);
    }
    console.log(
      `[Auth] ${newcomer} was given the seat of ${seat.uid} (${kept.length} character(s) kept)`,
    );
  }
}
