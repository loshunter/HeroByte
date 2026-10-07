// ============================================================================
// COMMAND REPLAY CONTRACT — a retried command lands once
// ============================================================================
// The client retries an ack-tracked command whose ack is late (500/1000/2000
// ms backoff, MessageQueueManager) with the SAME commandId. Under load the
// first copy has usually already been applied — only its ack was slow — so
// the retry is a duplicate, not a second command. Before the ledger, route()
// applied it again: the same chat line twice, a keyboard step taken twice,
// a dice roll thrown twice (the 2026-10-06 interface-marquee-cancel failure
// saw one public chat message arrive twice).
//
// Drives the REAL MessageRouter with real services: the duplicate must not
// reach any handler, and the sender must still be told the outcome (the
// retry exists because the first ack never arrived in time).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { ChatService } from "../../domains/chat/service.js";
import { createRouterHarness, messagesOf, type RouterHarness } from "./routerHarness.js";

const ALICE = "player-alice";
const BOB = "player-bob";
const DM = "dm-player";

describe("command replay contract — the same commandId is applied once", () => {
  let harness: RouterHarness;
  const state = () => harness.roomService.getState();

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createRouterHarness("command-replay.json", [
      { uid: ALICE, isDM: false },
      { uid: BOB, isDM: false },
      { uid: DM, isDM: true },
    ]);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const acksTo = (uid: string, commandId: string) =>
    messagesOf(harness.sockets[uid]!, "ack").filter(
      (frame) => (frame as { commandId?: string }).commandId === commandId,
    );

  it("a retried public chat line appears once, and the retry is acked again", () => {
    const line: ClientMessage = { t: "chat", text: "hello table", commandId: "cmd-chat-1" };
    harness.route(line, ALICE);
    harness.route(line, ALICE);

    expect(state().chatLog.filter((m) => m.text === "hello table")).toHaveLength(1);
    expect(acksTo(ALICE, "cmd-chat-1")).toHaveLength(2);
  });

  it("a retried keyboard step moves the token one cell, not two", () => {
    harness.roomService.setState({
      tokens: [{ id: "tok-alice", owner: ALICE, x: 1, y: 1, color: "#0f0" }],
    });
    harness.roomService.createSnapshot(); // scene graph, so the transform road exists
    const step: ClientMessage = {
      t: "step-object",
      ids: ["token:tok-alice"],
      dx: 1,
      dy: 0,
      commandId: "cmd-step-1",
    };
    harness.route(step, ALICE);
    harness.route(step, ALICE);

    expect(state().tokens.find((t) => t.id === "tok-alice")).toMatchObject({ x: 2, y: 1 });
  });

  it("a retried dice roll is thrown once", () => {
    const roll: ClientMessage = { t: "dice-roll", formula: "1d20", commandId: "cmd-roll-1" };
    harness.route(roll, ALICE);
    const afterFirst = state().diceRolls.length;
    harness.route(roll, ALICE);

    expect(afterFirst).toBe(1);
    expect(state().diceRolls).toHaveLength(1);
  });

  it("a different commandId with the same payload is a new command", () => {
    harness.route({ t: "chat", text: "again", commandId: "cmd-a" }, ALICE);
    harness.route({ t: "chat", text: "again", commandId: "cmd-b" }, ALICE);

    expect(state().chatLog.filter((m) => m.text === "again")).toHaveLength(2);
  });

  it("the ledger is per sender: another player's identical commandId still lands", () => {
    harness.route({ t: "chat", text: "from alice", commandId: "cmd-shared" }, ALICE);
    harness.route({ t: "chat", text: "from bob", commandId: "cmd-shared" }, BOB);

    expect(state().chatLog.map((m) => m.text)).toEqual(
      expect.arrayContaining(["from alice", "from bob"]),
    );
    expect(acksTo(BOB, "cmd-shared")).toHaveLength(1);
  });

  it("a retried refused command is refused again with the same reason, not re-run", () => {
    const addMessage = vi.spyOn(ChatService.prototype, "addMessage").mockImplementationOnce(() => {
      throw new Error("chat is closed");
    });
    const line: ClientMessage = { t: "chat", text: "refused", commandId: "cmd-refused" };
    harness.route(line, ALICE);
    harness.route(line, ALICE);

    const nacks = messagesOf(harness.sockets[ALICE]!, "nack");
    expect(nacks).toEqual([
      { t: "nack", commandId: "cmd-refused", reason: "chat is closed" },
      { t: "nack", commandId: "cmd-refused", reason: "chat is closed" },
    ]);
    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(state().chatLog.filter((m) => m.text === "refused")).toHaveLength(0);
    addMessage.mockRestore();
  });

  it("messages without a commandId are never deduplicated", () => {
    harness.route({ t: "chat", text: "untracked" }, ALICE);
    harness.route({ t: "chat", text: "untracked" }, ALICE);

    expect(state().chatLog.filter((m) => m.text === "untracked")).toHaveLength(2);
  });
});
