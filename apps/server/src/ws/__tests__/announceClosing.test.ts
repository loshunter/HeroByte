// ============================================================================
// ANNOUNCE CLOSING — the data frame that survives the production proxy
// ============================================================================
// The sessionHijack contract suite pins WHERE the announcement is sent (both
// live-socket close sites in AuthenticationHandler.ts, through closeAnnounced)
// and that it precedes the close there; the connect-time dead-occupant replace
// in the server's ConnectionLifecycleManager.ts sends no announcement at all,
// by design, and that class's own unit tests pin it. This file pins the
// helpers' own properties: the frame's exact shape (the client's router guard
// matches `t` literally), that a socket which cannot hear it is skipped
// rather than written to, and that closeAnnounced pairs each reason with its
// code and text, frame first.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import type { WebSocket } from "ws";
import { announceClosing, closeAnnounced } from "../announceClosing.js";

const SERVER_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function socketAt(readyState: number) {
  return { readyState, send: vi.fn(), close: vi.fn() } as unknown as WebSocket & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

describe("announceClosing", () => {
  it("sends exactly { t: 'connection-closing', reason } to an OPEN socket", () => {
    const ws = socketAt(1);

    announceClosing(ws, "replaced");
    announceClosing(ws, "conflict");

    expect(ws.send.mock.calls.map(([raw]) => JSON.parse(raw as string))).toEqual([
      { t: "connection-closing", reason: "replaced" },
      { t: "connection-closing", reason: "conflict" },
    ]);
  });

  it("skips a socket that is not OPEN — closing or closed, nothing can hear it", () => {
    const closing = socketAt(2);
    const closed = socketAt(3);

    announceClosing(closing, "replaced");
    announceClosing(closed, "replaced");

    expect(closing.send).not.toHaveBeenCalled();
    expect(closed.send).not.toHaveBeenCalled();
  });
});

describe("closeAnnounced", () => {
  it("announces first, then closes with the reason's own code and text", () => {
    const ws = socketAt(1);

    closeAnnounced(ws, "replaced");

    expect(JSON.parse(ws.send.mock.calls[0][0] as string)).toEqual({
      t: "connection-closing",
      reason: "replaced",
    });
    expect(ws.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
    expect(ws.send.mock.invocationCallOrder[0]).toBeLessThan(ws.close.mock.invocationCallOrder[0]);
  });

  it("maps 'conflict' to 4003, and still closes a socket it could not announce to", () => {
    const open = socketAt(1);
    closeAnnounced(open, "conflict");
    expect(open.close).toHaveBeenCalledWith(4003, "Session held by another connection");

    const closing = socketAt(2);
    closeAnnounced(closing, "conflict");
    expect(closing.send).not.toHaveBeenCalled();
    expect(closing.close).toHaveBeenCalledWith(4003, "Session held by another connection");
  });
});

describe("every replaced/conflict close goes through closeAnnounced", () => {
  // A future close site written as `ws.close(WS_CLOSE_REPLACED, …)` would
  // type-check, pass every unit suite and pass e2e — local dev and e2e connect
  // directly and DO receive the code — and be inert in production. That is
  // exactly how the original defect hid for two months, so the source is
  // scanned — for the named constants and for the bare numbers 4002/4003,
  // which no lint rule would stop — and the one permitted bare close is the
  // connect-time replace of a DEAD occupant, which nothing can hear.
  it("no source file closes with the replaced or conflict code by hand, bar the dead-occupant replace", () => {
    const offenders = sourceFiles(SERVER_SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8").replace(/\/\/[^\n]*/g, "");
      const hits =
        text.match(/close\(\s*(?:WS_CLOSE_(?:REPLACED|SESSION_CONFLICT)\b|400[23]\b)/g) ?? [];
      return hits.map(() => path.relative(SERVER_SRC, file).replace(/\\/g, "/"));
    });

    expect(offenders).toEqual(["ws/lifecycle/ConnectionLifecycleManager.ts"]);
  });
});
