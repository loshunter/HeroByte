// Unit tests for the DM-elevation budget accounting. The full elevate/grant
// flow is covered through the message router; this pins the one thing the
// round-2 doc review found leaking — a second in-flight elevation on one
// socket must REFUND the per-IP budget token it spent, exactly as the
// authenticate path does, so a double-click on "Make me DM" cannot drain a
// network's budget.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import { elevateUidToDM, type DMElevationDeps } from "../dmElevation.js";
import { DMElevationThrottle } from "../dmElevationThrottle.js";

function fakeWs(): WebSocket {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket;
}

/** A container just deep enough to reach the budget/in-flight gate. */
function fakeContainer(ws: WebSocket, verifyDMPassword: () => Promise<boolean>) {
  const state = { players: [{ uid: "dave", name: "dave", isDM: false }] };
  const roomService = {
    getState: () => state,
    broadcast: vi.fn(),
  };
  return {
    roomIdForUid: () => "default",
    getRoomServiceForRoom: () => roomService,
    getAuthenticatedClientsForRoom: () => new Set<WebSocket>([ws]),
    playerService: { findPlayer: () => state.players[0] },
    authService: { hasDMPassword: () => true, verifyDMPassword },
  } as unknown as DMElevationDeps["container"];
}

describe("elevateUidToDM budget accounting", () => {
  let ws: WebSocket;
  let takeAuthWork: ReturnType<typeof vi.fn>;
  let refundAuthWork: ReturnType<typeof vi.fn>;
  let deps: DMElevationDeps;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ws = fakeWs();
    takeAuthWork = vi.fn().mockReturnValue(true);
    refundAuthWork = vi.fn();
  });

  function build(verifyDMPassword: () => Promise<boolean>): DMElevationDeps {
    return {
      container: fakeContainer(ws, verifyDMPassword),
      uidToWs: new Map<string, WebSocket>([["dave", ws]]),
      dmThrottle: new DMElevationThrottle(),
      pendingAuthWork: new Set<WebSocket>(),
      takeAuthWork,
      refundAuthWork,
    };
  }

  it("a successful elevation refunds its budget token", async () => {
    deps = build(async () => true);
    await elevateUidToDM(deps, "dave", "FunDM");
    expect(takeAuthWork).toHaveBeenCalledTimes(1);
    expect(refundAuthWork).toHaveBeenCalledTimes(1);
  });

  it("a SECOND elevation while the first hash is in flight refunds instead of draining the budget", async () => {
    let release!: (v: boolean) => void;
    deps = build(() => new Promise<boolean>((r) => (release = r)));

    const first = elevateUidToDM(deps, "dave", "FunDM"); // parks at the hash
    await Promise.resolve();
    // A double-click: same socket, in flight -> the second must refund the
    // token it spent and return, not silently drain the network's budget.
    await elevateUidToDM(deps, "dave", "FunDM");
    expect(takeAuthWork).toHaveBeenCalledTimes(2);
    expect(refundAuthWork).toHaveBeenCalledTimes(1); // the second's refund

    release(true);
    await first; // the first grants and refunds its own token
    expect(refundAuthWork).toHaveBeenCalledTimes(2);
  });
});
