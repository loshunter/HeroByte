// ============================================================================
// REJECT AUTHENTICATION — on real sockets, a long reason cannot crash the server
// ============================================================================
// `ws` throws when a close reason passes 123 bytes. rejectAuthentication used to
// close with the reason itself; a 30-seat refusal on dev was longer, and the throw,
// in a timer, ended the server process (found live 2026-10-13, joining a 31st
// player). Any login-screen reason may grow that long, so the close text is fixed.
// The contract suites mock close(), so they cannot see the limit: this drives the
// real library over loopback.

import { describe, it, expect, vi } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { rejectAuthentication } from "../announceClosing.js";

vi.setConfig({ testTimeout: 15_000 });

describe("rejectAuthentication on real ws sockets", () => {
  it("sends a reason past 123 bytes whole and closes with 4001, without throwing", async () => {
    const reason =
      "This table cannot seat you right now: a reason the login screen shows in full, longer than a WebSocket close frame may carry.";
    expect(Buffer.byteLength(reason)).toBeGreaterThan(123);

    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
    const { port } = wss.address() as { port: number };
    const serverSide = new Promise<WebSocket>((resolve) => wss.once("connection", resolve));
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve) => client.once("open", () => resolve()));
    const ws = await serverSide;

    const frames: unknown[] = [];
    client.on("message", (data) => frames.push(JSON.parse(data.toString())));
    const closed = new Promise<number>((resolve) => client.once("close", resolve));

    rejectAuthentication(ws, reason);

    expect(await closed).toBe(4001);
    expect(frames).toEqual([{ t: "auth-failed", reason }]);
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });
});
