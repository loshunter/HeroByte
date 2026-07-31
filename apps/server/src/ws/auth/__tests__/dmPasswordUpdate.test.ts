import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { setDMPasswordForUid } from "../dmPasswordUpdate.js";
import type { Container } from "../../../container.js";

/**
 * The test table's DM password is fixed for the same reason its entry password
 * is: both are published, so a changeable one lets a single visitor lock the
 * host out of their own public demo — permanently, since it persists.
 */
function setup(roomId: string, opts: { isDM?: boolean; hasDMPassword?: boolean } = {}) {
  const sent: Array<Record<string, unknown>> = [];
  const ws = {
    send: vi.fn((payload: string) => sent.push(JSON.parse(payload))),
  } as unknown as WebSocket;

  const updateDMPassword = vi.fn().mockReturnValue({ source: "user", updatedAt: 1 });
  const state = { players: [{ uid: "u1", isDM: opts.isDM ?? true }] };

  const container = {
    roomIdForUid: () => roomId,
    getRoomServiceForRoom: () => ({
      getState: () => state,
      broadcast: vi.fn(),
    }),
    playerService: { findPlayer: () => state.players[0] },
    authService: {
      hasDMPassword: () => opts.hasDMPassword ?? true,
      updateDMPassword,
    },
    getAuthenticatedClientsForRoom: () => new Set(),
    uidToWs: new Map(),
  } as unknown as Container;

  return { ws, sent, container, updateDMPassword };
}

describe("setDMPasswordForUid", () => {
  it("REFUSES to change the test table's DM password, even for its DM", () => {
    const { ws, sent, container, updateDMPassword } = setup("default");

    setDMPasswordForUid(container, ws, "u1", "a-new-dm-password", "default");

    expect(updateDMPassword).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({ t: "dm-password-update-failed" });
    expect(sent[0].reason).toMatch(/fixed so it stays open/i);
    // Names the operation that IS available there.
    expect(sent[0].reason).toMatch(/private table/i);
  });

  it("refuses even when the table reports no DM password yet", () => {
    // Otherwise the elevation modal's bootstrap offer would be a dead end on
    // the one table where it can never succeed.
    const { ws, sent, container, updateDMPassword } = setup("default", {
      hasDMPassword: false,
      isDM: false,
    });

    setDMPasswordForUid(container, ws, "u1", "a-new-dm-password", "default");

    expect(updateDMPassword).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({ t: "dm-password-update-failed" });
  });

  it("still lets a private table's DM change its own DM password", () => {
    const { ws, sent, container, updateDMPassword } = setup("table-mine");

    setDMPasswordForUid(container, ws, "u1", "a-new-dm-password", "default");

    expect(updateDMPassword).toHaveBeenCalledWith("a-new-dm-password", "table-mine");
    expect(sent[0]).toMatchObject({ t: "dm-password-updated" });
  });

  it("still bootstraps a private table that has no DM password yet", () => {
    const { ws, sent, container } = setup("table-mine", { hasDMPassword: false, isDM: false });

    setDMPasswordForUid(container, ws, "u1", "a-new-dm-password", "default");

    expect(sent.some((m) => m.t === "dm-password-updated")).toBe(true);
    expect(sent.some((m) => m.t === "dm-status" && m.isDM === true)).toBe(true);
  });

  it("refuses a non-DM on a private table that already has one", () => {
    const { ws, sent, container, updateDMPassword } = setup("table-mine", { isDM: false });

    setDMPasswordForUid(container, ws, "u1", "a-new-dm-password", "default");

    expect(updateDMPassword).not.toHaveBeenCalled();
    expect(sent[0].reason).toMatch(/only dm/i);
  });
});
