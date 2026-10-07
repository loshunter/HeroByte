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
// retry exists because the first ack never arrived in time). Except the two
// commands answered by a reply (session-export, set-room-password): those
// run again.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { ChatService } from "../../domains/chat/service.js";
import type { AuthService } from "../../domains/auth/service.js";
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

  it("a malformed commandId is dropped: not applied, not acked, not nacked", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const malformed: unknown[] = ["x".repeat(121), "", 42, ["cmd-array"]];
    malformed.forEach((commandId, index) => {
      harness.route({ t: "chat", text: `malformed ${index}`, commandId } as ClientMessage, ALICE);
    });

    expect(state().chatLog.filter((m) => m.text.startsWith("malformed"))).toHaveLength(0);
    expect(messagesOf(harness.sockets[ALICE]!, "ack")).toHaveLength(0);
    expect(messagesOf(harness.sockets[ALICE]!, "nack")).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(malformed.length);
    warn.mockRestore();
  });

  it("a commandId of exactly 120 characters is applied and acked", () => {
    const commandId = "c".repeat(120);
    harness.route({ t: "chat", text: "longest id", commandId }, ALICE);

    expect(state().chatLog.filter((m) => m.text === "longest id")).toHaveLength(1);
    expect(acksTo(ALICE, commandId)).toHaveLength(1);
  });

  it("a mic-level carrying a commandId (a pre-voice tab) is acked", () => {
    harness.route({ t: "mic-level", level: 0.4, commandId: "cmd-meter" }, ALICE);

    expect(acksTo(ALICE, "cmd-meter")).toHaveLength(1);
  });

  it("a flood of meter frames never pushes a real command out of the ledger", () => {
    const line: ClientMessage = { t: "chat", text: "keep me", commandId: "cmd-keep" };
    harness.route(line, ALICE);
    for (let i = 0; i < 300; i += 1) {
      harness.route({ t: "mic-level", level: 0.1, commandId: `cmd-meter-${i}` }, ALICE);
    }
    harness.route(line, ALICE); // the late retry

    expect(state().chatLog.filter((m) => m.text === "keep me")).toHaveLength(1);
    expect(acksTo(ALICE, "cmd-keep")).toHaveLength(2);
  });

  // Two commands whose answer is a reply, not the ack: a retry flushed after a reconnect
  // must run again, or the backup file or the password confirmation the dead socket lost
  // never arrives (both are safe to repeat). Every other command is still answered from
  // the ledger.
  describe("commands answered by a reply run again on a retry", () => {
    it("a retried session-export sends the session file again", () => {
      const exportIt: ClientMessage = { t: "session-export", commandId: "cmd-export-1" };
      harness.route(exportIt, DM);
      harness.route(exportIt, DM);

      expect(messagesOf(harness.sockets[DM]!, "session-file")).toHaveLength(2);
      expect(acksTo(DM, "cmd-export-1")).toHaveLength(2);
    });

    it("a retried set-room-password runs again and confirms again", () => {
      const update = vi.fn(() => ({ updatedAt: 1234, source: "user" }));
      harness = createRouterHarness("command-replay-password.json", [{ uid: DM, isDM: true }], {
        authService: { update } as unknown as AuthService,
        roomId: "private-table",
      });
      const setIt: ClientMessage = {
        t: "set-room-password",
        secret: "Secret123",
        commandId: "cmd-password-1",
      };
      harness.route(setIt, DM);
      harness.route(setIt, DM);

      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledWith("Secret123", "private-table");
      expect(messagesOf(harness.sockets[DM]!, "room-password-updated")).toHaveLength(2);
      expect(messagesOf(harness.sockets[DM]!, "room-password-update-failed")).toHaveLength(0);
    });

    it("beside them, a retried chat line is still answered from the ledger", () => {
      harness.route({ t: "session-export", commandId: "cmd-export-2" }, DM);
      const line: ClientMessage = { t: "chat", text: "once only", commandId: "cmd-chat-2" };
      harness.route(line, DM);
      harness.route({ t: "session-export", commandId: "cmd-export-2" }, DM);
      harness.route(line, DM);

      expect(state().chatLog.filter((m) => m.text === "once only")).toHaveLength(1);
      expect(acksTo(DM, "cmd-chat-2")).toHaveLength(2);
      expect(messagesOf(harness.sockets[DM]!, "session-file")).toHaveLength(2);
    });
  });
});
