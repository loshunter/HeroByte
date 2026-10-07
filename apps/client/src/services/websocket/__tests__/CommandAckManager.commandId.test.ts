/**
 * CommandAckManager — a minted commandId is never reused by the same player.
 *
 * The server answers a repeated commandId from its replay ledger (per uid,
 * minutes long) instead of applying it: that is what stops a late-ack retry
 * from landing twice. So a NEW command must never reuse an id — not after a
 * reconnect (reset), not after a reload (a new manager, same uid). Without
 * crypto.randomUUID (plain-http LAN play is not a secure context) the old
 * fallback restarted at `cmd-1` on every reset, and the ledger swallowed the
 * first commands after each reconnect as duplicates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { CommandAckManager } from "../CommandAckManager";

const move: ClientMessage = { t: "move", id: "token-1", x: 1, y: 2 };

describe("CommandAckManager commandId minting without crypto.randomUUID", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mint = (manager: CommandAckManager, count: number) =>
    Array.from({ length: count }, () => manager.attachCommandId(move).commandId!);

  it("never repeats an id across a reconnect's reset", () => {
    const manager = new CommandAckManager();
    const before = mint(manager, 5);
    manager.reset();
    const after = mint(manager, 5);

    expect(new Set([...before, ...after]).size).toBe(10);
  });

  it("never repeats an id across a reload (a fresh manager)", () => {
    const first = mint(new CommandAckManager(), 5);
    const second = mint(new CommandAckManager(), 5);

    expect(new Set([...first, ...second]).size).toBe(10);
  });
});
