// ============================================================================
// REJECT AUTHENTICATION — on real sockets, a long reason cannot crash the server
// ============================================================================
// `ws` throws when a close reason passes 123 bytes. rejectAuthentication used to
// close with the reason itself; the full-table reason is longer, and the throw,
// in a timer, ended the server process (found live 2026-10-13, joining a
// 31st player). The contract suites mock close(), so they cannot see the limit:
// this drives the real library over loopback.

import { describe, it, expect, vi } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import type { RoomState } from "../../domains/room/model.js";
import { rejectAuthentication } from "../announceClosing.js";
import { TABLE_SEAT_LIMIT, seatRefusal } from "../auth/joinProvisioning.js";

vi.setConfig({ testTimeout: 15_000 });

describe("rejectAuthentication on real ws sockets", () => {
  it("sends the full-table reason whole and closes with 4001, without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = {
      players: Array.from({ length: TABLE_SEAT_LIMIT }, (_, n) => ({ uid: `seat-${n}` })),
    } as unknown as RoomState;
    const reason = seatRefusal(full, "newcomer");
    expect(reason).not.toBeNull();
    expect(Buffer.byteLength(reason!)).toBeGreaterThan(123);

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

    rejectAuthentication(ws, reason!);

    expect(await closed).toBe(4001);
    expect(frames).toEqual([{ t: "auth-failed", reason }]);
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });
});
