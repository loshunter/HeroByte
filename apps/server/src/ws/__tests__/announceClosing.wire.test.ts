// ============================================================================
// ANNOUNCE CLOSING — on real sockets, the frame lands before the close
// ============================================================================
// The whole fix rests on one library property: `ws` writes a send() and a
// following synchronous close() to the socket in that order, so the
// `connection-closing` frame reaches the client before the close frame does.
// The contract suites mock send/close, so they cannot see this; a `ws`
// upgrade inside package.json's ^8.18 range could break it and every other
// gate would stay green. This test drives closeAnnounced over loopback
// sockets and records the order the CLIENT saw. The permessage-deflate rows
// exercise the Sender's async compression queue (the path an upgrade could
// change); the plain rows exercise Node's own socket write order, with and
// without a 4 MiB message queued ahead of the frame.

import { describe, it, expect, vi } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { closeAnnounced } from "../announceClosing.js";

vi.setConfig({ testTimeout: 15_000 });

async function orderSeenByClient(options: { deflate: boolean; queuedBytes: number }) {
  const wss = new WebSocketServer({ port: 0, perMessageDeflate: options.deflate });
  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
  const { port } = wss.address() as { port: number };

  const serverSide = new Promise<WebSocket>((resolve) => wss.once("connection", resolve));
  const client = new WebSocket(`ws://127.0.0.1:${port}`, { perMessageDeflate: options.deflate });
  await new Promise<void>((resolve) => client.once("open", () => resolve()));
  const ws = await serverSide;

  const seen: string[] = [];
  client.on("message", (data) => {
    const frame = JSON.parse(data.toString()) as { t?: string; reason?: string };
    seen.push(frame.t === "connection-closing" ? `frame:${frame.reason}` : "bulk");
  });
  const closed = new Promise<number>((resolve) =>
    client.once("close", (code) => {
      seen.push("close");
      resolve(code);
    }),
  );

  if (options.queuedBytes > 0) {
    // A big message the socket has not drained yet: the frame and the close
    // must both queue behind it, in order.
    ws.send(JSON.stringify({ t: "bulk", pad: "x".repeat(options.queuedBytes) }));
  }
  closeAnnounced(ws, "replaced");

  const code = await closed;
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  return { seen: seen.filter((event) => event !== "bulk"), code };
}

describe("closeAnnounced on real ws sockets", () => {
  it.each([
    ["plain", false, 0],
    ["permessage-deflate", true, 0],
    ["plain, 4 MiB queued ahead", false, 4 * 1024 * 1024],
    ["permessage-deflate, 4 MiB queued ahead", true, 4 * 1024 * 1024],
  ])(
    "%s: the client sees the frame, then the close, with the code intact",
    async (_label, deflate, queuedBytes) => {
      const { seen, code } = await orderSeenByClient({ deflate, queuedBytes });

      expect(seen).toEqual(["frame:replaced", "close"]);
      expect(code).toBe(4002);
    },
  );
});
