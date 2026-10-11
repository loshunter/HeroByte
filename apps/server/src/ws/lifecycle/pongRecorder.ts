// ============================================================================
// PONG RECORDER — dead-socket step 1: record the pong replies, act on none
// ============================================================================
// The server pings every socket every 25 s (the keepalive) and never looked
// for the pong. A socket that dies silently (a phone out of signal, a closed
// laptop lid) stays connected, and in the voice call, for about 5.5 minutes,
// until the heartbeat timeout. Step 2 (the owner's decision, 2026-10-10) drops
// a socket after STEP_2_MISS_LIMIT missed pongs in a row. Step 1 measures
// first, in production:
//
//   - Do pongs come back through Render's proxy at all? (pongs ≈ pings)
//   - Does the PROXY answer them? Then a socket the heartbeat timeout closed
//     still has a recent pong at its close, and step 2 would change nothing.
//   - How often does a LIVE socket miss STEP_2_MISS_LIMIT in a row and answer
//     afterwards? Each one is a player step 2 would have dropped for nothing.
//
// One log line per socket, when it closes, prefixed `[pong]`. Nothing here
// closes, terminates or delays anything.

import type { WebSocket } from "ws";

/** Step 2's rule, measured here: this many pings in a row without a pong. */
export const STEP_2_MISS_LIMIT = 2;

export interface PongRecord {
  openedAt: number;
  pings: number;
  pongs: number;
  /** A ping went out and its pong has not come back yet. */
  awaitingPong: boolean;
  missesInARow: number;
  longestMissRun: number;
  /** Pongs that came after STEP_2_MISS_LIMIT misses in a row: step 2 would have dropped a live socket. */
  revivals: number;
  lastPongAt: number | null;
}

export class PongRecorder {
  private records = new Map<WebSocket, PongRecord>();

  constructor(
    private now: () => number = Date.now,
    private log: (line: string) => void = (line) => console.log(line),
  ) {}

  /** Start a socket's record and listen for its pongs. */
  watch(ws: WebSocket): void {
    if (this.records.has(ws)) return;
    const record: PongRecord = {
      openedAt: this.now(),
      pings: 0,
      pongs: 0,
      awaitingPong: false,
      missesInARow: 0,
      longestMissRun: 0,
      revivals: 0,
      lastPongAt: null,
    };
    this.records.set(ws, record);
    ws.on("pong", () => {
      record.pongs += 1;
      if (record.missesInARow >= STEP_2_MISS_LIMIT) record.revivals += 1;
      record.missesInARow = 0;
      record.awaitingPong = false;
      record.lastPongAt = this.now();
    });
  }

  /** A keepalive ping is about to go out: the last one, still unanswered, was missed. */
  pinged(ws: WebSocket): void {
    const record = this.records.get(ws);
    if (!record) return;
    if (record.awaitingPong) {
      record.missesInARow += 1;
      record.longestMissRun = Math.max(record.longestMissRun, record.missesInARow);
    }
    record.awaitingPong = true;
    record.pings += 1;
  }

  /** The socket closed: log its record once and forget it. */
  closed(ws: WebSocket, detail: { uid?: string; code?: number } = {}): PongRecord | undefined {
    const record = this.records.get(ws);
    if (!record) return undefined;
    this.records.delete(ws);
    // Closed before its first ping (a blip, a held newcomer): nothing measured.
    if (record.pings === 0) return record;
    const now = this.now();
    const lastPong =
      record.lastPongAt === null ? "never" : `${Math.round((now - record.lastPongAt) / 1000)}s`;
    const wouldDrop = record.longestMissRun >= STEP_2_MISS_LIMIT;
    this.log(
      `[pong] ${detail.uid ?? "?"} closed (code ${detail.code ?? "?"}) after ` +
        `${Math.round((now - record.openedAt) / 1000)}s: ${record.pings} ping(s), ` +
        `${record.pongs} pong(s), last pong ${lastPong} before close, ` +
        `longest run of missed pongs ${record.longestMissRun}` +
        (wouldDrop ? ` — step 2 would have dropped it (${record.revivals} revival(s) after)` : ""),
    );
    return record;
  }
}
