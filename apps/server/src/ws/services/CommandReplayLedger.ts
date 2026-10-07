// ============================================================================
// COMMAND REPLAY LEDGER — a retried command is answered, not applied again
// ============================================================================
// The client retries an ack-tracked command whose ack is late (500/1000/2000
// ms backoff, MessageQueueManager) with the SAME commandId. A late ack is not
// a lost command: under load the first copy has usually landed already, and
// applying the retry too posts the chat line twice, takes the keyboard step
// twice, throws the dice twice. So the router remembers the ack or nack it
// gave each sender's recent commandIds, and a repeat gets that answer again
// without reaching any handler.
//
// Keyed per sender: commandIds are client-minted, so one player's id must
// never be able to swallow another's command. Bounded per sender by count and
// age — the window only has to outlast the retry ladder (3.5 s) and a retry
// that was queued while the socket was down and flushed on reconnect — and in
// senders, ids and reasons, because everything here is client-chosen and held
// for minutes: an unbounded id would let one player fill the server's memory.

import type { ServerMessage } from "@herobyte/shared";

type Outcome = Extract<ServerMessage, { t: "ack" } | { t: "nack" }>;

interface Entry {
  outcome: Outcome;
  at: number;
}

export const REPLAY_LEDGER_LIMIT = 256;
export const REPLAY_LEDGER_TTL_MS = 5 * 60 * 1000;
export const REPLAY_LEDGER_MAX_SENDERS = 128;
export const COMMAND_ID_MAX_LENGTH = 120;
const REASON_MAX_LENGTH = 200;

/** A commandId the ledger may hold: a string of 1-120 characters (a UUID is 36). */
export function isLedgerCommandId(commandId: unknown): commandId is string {
  return (
    typeof commandId === "string" &&
    commandId.length > 0 &&
    commandId.length <= COMMAND_ID_MAX_LENGTH
  );
}

export class CommandReplayLedger {
  private readonly bySender = new Map<string, Map<string, Entry>>();
  private lastSweep = 0;

  constructor(
    private readonly limit = REPLAY_LEDGER_LIMIT,
    private readonly ttlMs = REPLAY_LEDGER_TTL_MS,
    private readonly now: () => number = Date.now,
    private readonly maxSenders = REPLAY_LEDGER_MAX_SENDERS,
  ) {}

  /** The answer `senderUid` was already given for `commandId`, if still remembered. */
  recall(senderUid: string, commandId: string): Outcome | undefined {
    const entry = this.bySender.get(senderUid)?.get(commandId);
    if (!entry || this.now() - entry.at > this.ttlMs) return undefined;
    return entry.outcome;
  }

  remember(senderUid: string, outcome: Outcome): void {
    if (!isLedgerCommandId(outcome.commandId)) return;
    const now = this.now();
    let entries = this.bySender.get(senderUid);
    if (!entries) {
      this.evictStalestSenderIfFull();
      entries = new Map();
      this.bySender.set(senderUid, entries);
    }
    const kept =
      outcome.t === "nack" && outcome.reason && outcome.reason.length > REASON_MAX_LENGTH
        ? { ...outcome, reason: outcome.reason.slice(0, REASON_MAX_LENGTH) }
        : outcome;
    // Delete first: re-setting a key keeps its old place, and the loop below
    // relies on insertion order being age order (oldest at the front).
    entries.delete(outcome.commandId);
    entries.set(outcome.commandId, { outcome: kept, at: now });
    for (const [commandId, entry] of entries) {
      if (entries.size <= this.limit && now - entry.at <= this.ttlMs) break;
      entries.delete(commandId);
    }
    this.sweepIdleSenders(now);
  }

  /** At the sender cap, drop the sender whose newest entry is the oldest. */
  private evictStalestSenderIfFull(): void {
    if (this.bySender.size < this.maxSenders) return;
    let stalest: string | undefined;
    let stalestAt = Infinity;
    for (const [uid, entries] of this.bySender) {
      const newestAt = Array.from(entries.values()).pop()?.at ?? -Infinity;
      if (newestAt < stalestAt) {
        stalestAt = newestAt;
        stalest = uid;
      }
    }
    if (stalest !== undefined) this.bySender.delete(stalest);
  }

  /** Drop senders whose newest entry has aged out — at most once per window. */
  private sweepIdleSenders(now: number): void {
    if (now - this.lastSweep < this.ttlMs) return;
    this.lastSweep = now;
    for (const [uid, entries] of this.bySender) {
      const newest = Array.from(entries.values()).pop();
      if (!newest || now - newest.at > this.ttlMs) this.bySender.delete(uid);
    }
  }
}
