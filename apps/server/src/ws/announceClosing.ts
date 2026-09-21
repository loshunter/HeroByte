// ============================================================================
// ANNOUNCE CLOSING — tell the client WHY, in a data frame, before the close
// ============================================================================
// Render's proxy rewrites every server-sent WebSocket close code to 1005
// ("no status received"). Found live 2026-09-20, in a real browser: the
// server sent WS_CLOSE_REPLACED (4002), the console read 1005, and the
// client — branching on the code — auto-reconnected and took the seat back.
// Two tabs of one browser warred forever, which is precisely what 4002 was
// written in July to end; it had been inert since the day it shipped.
//
// A data frame is expected to survive that proxy — one that rewrites a close
// code usually forwards the rest of the stream untouched — but nothing in
// this repo's gates crosses that hop: `pnpm check:live-session` against the
// real host, after a deploy, is what confirms the frame arrives, and in
// order. So the two closes that must END a session — the takeover
// ("replaced") and the turned-away claim ("conflict"), both in
// AuthenticationHandler — send `{ t: "connection-closing", reason }` first,
// and the client goes terminal on that. The close code still follows, for
// direct connections (local dev, e2e) where it does arrive. Other intentional
// closes of a live socket (the heartbeat-timeout 4000, the policy-violation
// 1008 at connect) send no frame: through the proxy they read as a transient
// drop and the client reconnects, the right outcome for both. `auth-failed`
// before WS_CLOSE_AUTH_REJECTED is a similar send-then-close (with a 100 ms
// wait that ordering does not need), and why that code was never a casualty.
//
// Ordering on the server side: `ws`'s Sender writes through one FIFO queue
// whether or not permessage-deflate is on, so a send() followed synchronously
// by close() puts the data frame on the wire before the close frame.
// announceClosing.wire.test.ts pins that on real loopback sockets — with and
// without compression, with a 4 MiB message queued ahead — so a `ws` upgrade
// inside package.json's ^8.18 range cannot break it silently. The callers
// rely on close() staying synchronous (register the newcomer, THEN close the
// old socket), so no delay is taken.

import type { WebSocket } from "ws";
import {
  WS_CLOSE_REPLACED,
  WS_CLOSE_SESSION_CONFLICT,
  type ConnectionClosingReason,
  type ServerMessage,
} from "@herobyte/shared";

const OPEN = 1;

const CLOSE_FOR_REASON: Record<ConnectionClosingReason, { code: number; text: string }> = {
  replaced: { code: WS_CLOSE_REPLACED, text: "Replaced by new connection" },
  conflict: { code: WS_CLOSE_SESSION_CONFLICT, text: "Session held by another connection" },
};

/**
 * Send the `connection-closing` announcement to a socket that is about to be
 * closed on purpose. A socket that is not OPEN cannot hear it (and `ws`
 * itself discards a send on a non-OPEN socket — `sendAfterClose` in its
 * websocket.js), so it is skipped rather than attempted.
 */
export function announceClosing(ws: WebSocket, reason: ConnectionClosingReason): void {
  if (ws.readyState !== OPEN) return;
  const frame: Extract<ServerMessage, { t: "connection-closing" }> = {
    t: "connection-closing",
    reason,
  };
  ws.send(JSON.stringify(frame));
}

/**
 * Announce, then close with the code and text that belong to the reason —
 * the one call the two live-socket close sites make, so the frame and the
 * code can never disagree and their order can never flip.
 */
export function closeAnnounced(ws: WebSocket, reason: ConnectionClosingReason): void {
  announceClosing(ws, reason);
  const { code, text } = CLOSE_FOR_REASON[reason];
  ws.close(code, text);
}
