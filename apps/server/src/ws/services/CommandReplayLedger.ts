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
// that was queued while the socket was down and flushed on reconnect.

import type { ServerMessage } from "@herobyte/shared";

type Outcome = Extract<ServerMessage, { t: "ack" } | { t: "nack" }>;

interface Entry {
  outcome: Outcome;
  at: number;
}

export const REPLAY_LEDGER_LIMIT = 256;
export const REPLAY_LEDGER_TTL_MS = 5 * 60 * 1000;

export class CommandReplayLedger {
  private readonly bySender = new Map<string, Map<string, Entry>>();
  private lastSweep = 0;

  constructor(
    private readonly limit = REPLAY_LEDGER_LIMIT,
    private readonly ttlMs = REPLAY_LEDGER_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** The answer `senderUid` was already given for `commandId`, if still remembered. */
  recall(senderUid: string, commandId: string): Outcome | undefined {
    const entry = this.bySender.get(senderUid)?.get(commandId);
    if (!entry || this.now() - entry.at > this.ttlMs) return undefined;
    return entry.outcome;
  }

  remember(senderUid: string, outcome: Outcome): void {
    const now = this.now();
    let entries = this.bySender.get(senderUid);
    if (!entries) {
      entries = new Map();
      this.bySender.set(senderUid, entries);
    }
    entries.set(outcome.commandId, { outcome, at: now });
    // Insertion order is age order, so the oldest are always at the front.
    for (const [commandId, entry] of entries) {
      if (entries.size <= this.limit && now - entry.at <= this.ttlMs) break;
      entries.delete(commandId);
    }
    this.sweepIdleSenders(now);
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
