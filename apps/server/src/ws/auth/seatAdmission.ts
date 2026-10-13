// ============================================================================
// SEAT ADMISSION — who may take a NEW seat at a table
// ============================================================================
// A table holds TABLE_SEAT_LIMIT seats, and a seat outlives its player. Held
// strictly (the first cap, c7f45eaa) that locked tables shut: scripted joins
// filled the public table for free (a right password is refunded), and a DM
// on a new browser was turned away from their own full table with no way in
// to remove anyone. The owner's answer (2026-10-13): a full table RECLAIMS the
// longest-absent seat, and the public table limits new seats per network.
//
// A seat is reclaimable only when nobody could be sitting in it: not the DM's,
// not on the authenticated roster, no open socket (a player on the password
// form counts as here), no session token still provable (a reconnect inside
// the grace window would come back to it), and no heartbeat for
// STALE_SEAT_MS (PUBLIC_STALE_SEAT_MS on the public table, a scratch space
// that wipes itself when idle). It goes through the DM's own Remove, so its
// characters leave turn-safely and the pieces it owned pass to the table's DM.

import type { Player } from "@herobyte/shared";
import type { Container } from "../../container.js";
import type { RoomState } from "../../domains/room/model.js";
import { TokenBucketLimiter } from "../../middleware/authWorkLimit.js";
import { HELD_SOCKET_TTL_MS, removePlayer } from "../handlers/removePlayer.js";
import { TABLE_SEAT_LIMIT } from "./joinProvisioning.js";

/** A private table's seat with no heartbeat this long can be taken by a newcomer at a full table. */
export const STALE_SEAT_MS = 7 * 24 * 60 * 60 * 1000;
/** The same on the public table, where anyone with the published password can join. */
export const PUBLIC_STALE_SEAT_MS = 60 * 60 * 1000;
/** New seats one network may take on the public table: 6 at once, then one per 10 minutes. */
export const PUBLIC_NEW_SEATS_BURST = 6;
const PUBLIC_NEW_SEAT_REFILL_PER_SECOND = 1 / 600;

/** Loopback is the dev server, e2e and the docs harness: dozens of uids, one machine. */
const LOOPBACK = new Set(["127.0.0.1", "::1"]);

export class SeatAdmission {
  private readonly publicNewSeats = new TokenBucketLimiter({
    capacity: PUBLIC_NEW_SEATS_BURST,
    refillPerSecond: PUBLIC_NEW_SEAT_REFILL_PER_SECOND,
  });

  constructor(
    private readonly container: Container,
    private readonly publicRoomId: string,
    private readonly hasSession: (uid: string, now: number) => boolean,
  ) {}

  /**
   * Why `uid` may not take a seat here, or null. A seat's own uid always may (a
   * reconnect). At a full table this CLEARS the longest-absent reclaimable seat
   * to make room, so call it only for a password-verified join.
   */
  refusal(state: RoomState, roomId: string, uid: string, ip: string, now: number): string | null {
    if (state.players.some((player) => player.uid === uid)) return null;
    const isPublic = roomId === this.publicRoomId;
    if (isPublic && !LOOPBACK.has(ip) && !this.publicNewSeats.take(ip, now)) {
      console.warn(`[Auth] ${uid} turned away: too many new seats from ${ip} on the public table`);
      return "Too many new players from your network have joined this public table in the last hour. Wait ten minutes and try again, or start a private table of your own.";
    }
    if (state.players.length < TABLE_SEAT_LIMIT) return null;
    const stale = this.staleSeat(state, isPublic ? PUBLIC_STALE_SEAT_MS : STALE_SEAT_MS, now);
    const heir = state.players.find((player) => player.isDM)?.uid ?? "";
    if (stale && !removePlayer(this.removeDeps(), state, stale.uid, heir, now).refused) {
      console.log(`[Auth] ${uid} took the seat of ${stale.uid}, away since ${stale.lastHeartbeat}`);
      return null;
    }
    console.warn(`[Auth] ${uid} turned away: the table holds ${state.players.length} seats`);
    return `This table is full: it holds ${TABLE_SEAT_LIMIT} seats, and every one has been in use ${isPublic ? "within the last hour" : "within the last 7 days"}. Ask the DM to remove an absent player (DM Menu → Table → Players at this table), then try again. If you are the DM, sign in from a browser that already has a seat here.`;
  }

  /** The longest-absent seat nobody could be sitting in, or undefined. */
  private staleSeat(state: RoomState, staleMs: number, now: number): Player | undefined {
    const candidates = state.players.filter(
      (player) =>
        !player.isDM &&
        !state.users.includes(player.uid) &&
        !this.hasLiveSocket(player.uid, now) &&
        !this.hasSession(player.uid, now) &&
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

  private removeDeps() {
    const { playerService, characterService, tokenService, selectionService } = this.container;
    return {
      playerService,
      characterService,
      tokenService,
      selectionService,
      hasLiveSocket: (uid: string) => this.hasLiveSocket(uid, Date.now()),
    };
  }
}
