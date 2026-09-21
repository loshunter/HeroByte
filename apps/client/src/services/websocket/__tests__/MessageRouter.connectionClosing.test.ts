// ============================================================================
// MESSAGE ROUTER — the server's `connection-closing` announcement
// ============================================================================
// Render's proxy rewrites every server-sent WebSocket close code to 1005, so
// the code was never the signal in production: WS_CLOSE_REPLACED (4002) had
// been inert since July, and two tabs of one browser took the seat from each
// other every 2 s. Found live 2026-09-20. The server now announces an
// intentional close in a DATA frame first, and this is the frame's one way
// into the client: its own callback, ahead of the control list, like an auth
// response — the session's fate must not depend on what the app subscribes to.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED_REASONS = path.join(HERE, "../../../../../../packages/shared/src/wsCloseCodes.ts");

function routerWithSpies() {
  const spies = {
    onMessage: vi.fn(),
    onAuthResponse: vi.fn(),
    onConnectionClosing: vi.fn(),
    onControlMessage: vi.fn(),
  };
  return { router: new MessageRouter(spies), spies };
}

describe("MessageRouter — connection-closing", () => {
  it("delivers both reasons to onConnectionClosing, and to nothing else", () => {
    const { router, spies } = routerWithSpies();

    router.route(JSON.stringify({ t: "connection-closing", reason: "replaced" }));
    router.route(JSON.stringify({ t: "connection-closing", reason: "conflict" }));

    expect(spies.onConnectionClosing.mock.calls.map(([m]) => m)).toEqual([
      { t: "connection-closing", reason: "replaced" },
      { t: "connection-closing", reason: "conflict" },
    ]);
    expect(spies.onMessage).not.toHaveBeenCalled();
    expect(spies.onAuthResponse).not.toHaveBeenCalled();
    expect(spies.onControlMessage).not.toHaveBeenCalled();
  });

  it("does not need a control handler to deliver it — it is a lifecycle signal, not a control message", () => {
    const onConnectionClosing = vi.fn();
    const router = new MessageRouter({ onMessage: vi.fn(), onConnectionClosing });

    router.route(JSON.stringify({ t: "connection-closing", reason: "replaced" }));

    expect(onConnectionClosing).toHaveBeenCalledTimes(1);
  });

  it("delivers a reason this build does not know — the server is closing the socket either way", () => {
    const { router, spies } = routerWithSpies();

    router.route(JSON.stringify({ t: "connection-closing", reason: "maintenance" }));

    // Dropping it would leave the tab to reconnect into the war the frame
    // exists to end; the service holds an unknown reason as a conflict.
    expect(spies.onConnectionClosing).toHaveBeenCalledWith({
      t: "connection-closing",
      reason: "maintenance",
    });
  });

  it("a frame without a string reason is malformed: unknown-type floor, never a snapshot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { router, spies } = routerWithSpies();

    router.route(JSON.stringify({ t: "connection-closing" }));
    router.route(JSON.stringify({ t: "connection-closing", reason: 7 }));

    expect(spies.onConnectionClosing).not.toHaveBeenCalled();
    expect(spies.onMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("says so, loudly, when no handler is wired — a silent drop is a dead feature", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const router = new MessageRouter({ onMessage: vi.fn() });

    router.route(JSON.stringify({ t: "connection-closing", reason: "replaced" }));

    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("knows every reason the shared type declares — a new one is a deliberate edit here too", () => {
    const source = readFileSync(SHARED_REASONS, "utf8");
    const declaration = source.match(/export type ConnectionClosingReason\s*=\s*([^;]+);/);
    expect(declaration, "ConnectionClosingReason declaration not found — renamed?").not.toBeNull();
    const reasons = [...(declaration?.[1] ?? "").matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .sort();

    // handleServerClosing maps "replaced" to REPLACED and everything else to
    // CONFLICT, and the auth gate's copy describes a conflict. A third reason
    // needs its own state and copy before it ships; update this list when it
    // has them — not before.
    expect(reasons).toEqual(["conflict", "replaced"]);
  });
});
