import { describe, it, expect } from "vitest";
import { COMMAND_ID_MAX_LENGTH, CommandReplayLedger } from "../CommandReplayLedger.js";

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

  it("ignores a malformed commandId: empty, over 120 characters, or not a string", () => {
    const ledger = new CommandReplayLedger();
    const tooLong = "x".repeat(COMMAND_ID_MAX_LENGTH + 1);
    const longest = "y".repeat(COMMAND_ID_MAX_LENGTH);
    for (const id of ["", tooLong, 7, ["c1"]]) ledger.remember("alice", ack(id as string));
    ledger.remember("alice", ack(longest));

    expect(ledger.recall("alice", "")).toBeUndefined();
    expect(ledger.recall("alice", tooLong)).toBeUndefined();
    expect(ledger.recall("alice", 7 as unknown as string)).toBeUndefined();
    expect(ledger.recall("alice", ["c1"] as unknown as string)).toBeUndefined();
    expect(ledger.recall("alice", longest)).toEqual(ack(longest));
  });

  it("stores a long nack reason trimmed to 200 characters", () => {
    const ledger = new CommandReplayLedger();
    const reason = "r".repeat(150) + "s".repeat(350);
    ledger.remember("alice", { t: "nack", commandId: "c1", reason });
    ledger.remember("alice", { t: "nack", commandId: "c2", reason: "short" });

    expect(ledger.recall("alice", "c1")).toEqual({
      t: "nack",
      commandId: "c1",
      reason: reason.slice(0, 200),
    });
    expect(ledger.recall("alice", "c2")).toEqual({ t: "nack", commandId: "c2", reason: "short" });
  });

  it("re-remembering an id moves it to the back, so the count limit drops the oldest", () => {
    const ledger = new CommandReplayLedger(3, 60_000, () => 0);
    for (const id of ["a", "b", "c"]) ledger.remember("alice", ack(id));
    ledger.remember("alice", ack("a")); // now the newest
    ledger.remember("alice", ack("d"));

    expect(ledger.recall("alice", "a")).toEqual(ack("a"));
    expect(ledger.recall("alice", "b")).toBeUndefined();
  });

  it("re-remembering an expired id moves it, so the expired entries behind it go", () => {
    let now = 0;
    const ledger = new CommandReplayLedger(256, 1_000, () => now);
    ledger.remember("alice", ack("x"));
    ledger.remember("alice", ack("w"));
    now = 1_000;
    ledger.remember("alice", ack("y")); // the idle sweep runs here, while all are fresh
    now = 1_500; // x and w have expired; no sweep is due until 2_000
    ledger.remember("alice", ack("x"));
    now = 0; // rewind: an entry still held would be recalled again

    expect(ledger.recall("alice", "w")).toBeUndefined();
    expect(ledger.recall("alice", "x")).toEqual(ack("x"));
    expect(ledger.recall("alice", "y")).toEqual(ack("y"));
  });

  it("at the sender cap, a new sender drops the stalest one and keeps the active", () => {
    let now = 0;
    const ledger = new CommandReplayLedger(256, 60_000, () => now, 2);
    ledger.remember("alice", ack("a1"));
    now = 10;
    ledger.remember("bob", ack("b1"));
    now = 20;
    ledger.remember("alice", ack("a2")); // alice is the active one now
    now = 30;
    ledger.remember("carol", ack("c1"));

    expect(ledger.recall("bob", "b1")).toBeUndefined();
    expect(ledger.recall("alice", "a1")).toEqual(ack("a1"));
    expect(ledger.recall("alice", "a2")).toEqual(ack("a2"));
    expect(ledger.recall("carol", "c1")).toEqual(ack("c1"));
  });

  it("a sender already held never evicts anyone", () => {
    const ledger = new CommandReplayLedger(256, 60_000, () => 0, 2);
    ledger.remember("alice", ack("a1"));
    ledger.remember("bob", ack("b1"));
    ledger.remember("bob", ack("b2"));
    ledger.remember("alice", ack("a2"));

    expect(ledger.recall("alice", "a1")).toEqual(ack("a1"));
    expect(ledger.recall("bob", "b1")).toEqual(ack("b1"));
  });
});
