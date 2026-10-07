import { describe, it, expect } from "vitest";
import { CommandReplayLedger } from "../CommandReplayLedger.js";

const ack = (commandId: string) => ({ t: "ack" as const, commandId });

describe("CommandReplayLedger", () => {
  it("recalls the answer a sender was given, and only that sender", () => {
    const ledger = new CommandReplayLedger();
    ledger.remember("alice", ack("c1"));

    expect(ledger.recall("alice", "c1")).toEqual(ack("c1"));
    expect(ledger.recall("bob", "c1")).toBeUndefined();
    expect(ledger.recall("alice", "c2")).toBeUndefined();
  });

  it("keeps at most `limit` commands per sender, forgetting the oldest first", () => {
    const ledger = new CommandReplayLedger(3, 60_000, () => 0);
    for (const id of ["c1", "c2", "c3", "c4"]) ledger.remember("alice", ack(id));

    expect(ledger.recall("alice", "c1")).toBeUndefined();
    expect(["c2", "c3", "c4"].map((id) => ledger.recall("alice", id))).toEqual(
      ["c2", "c3", "c4"].map(ack),
    );
  });

  it("forgets a command once it is older than the window", () => {
    let now = 0;
    const ledger = new CommandReplayLedger(256, 1_000, () => now);
    ledger.remember("alice", ack("old"));
    now = 1_000;
    expect(ledger.recall("alice", "old")).toEqual(ack("old"));
    now = 1_001;
    expect(ledger.recall("alice", "old")).toBeUndefined();

    // ...and a newer remember drops the expired entry rather than carrying it.
    ledger.remember("alice", ack("new"));
    now = 0;
    expect(ledger.recall("alice", "old")).toBeUndefined();
  });

  it("drops a sender who has gone quiet for a whole window", () => {
    let now = 0;
    const ledger = new CommandReplayLedger(256, 1_000, () => now);
    ledger.remember("gone", ack("g1"));
    now = 5_000;
    ledger.remember("alice", ack("a1"));
    now = 0; // rewind: an entry still held would be recalled again
    expect(ledger.recall("gone", "g1")).toBeUndefined();
    expect(ledger.recall("alice", "a1")).toEqual(ack("a1"));
  });
});
