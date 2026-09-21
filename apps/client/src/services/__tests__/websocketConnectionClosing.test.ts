/**
 * WebSocketService — the end of a session as production actually delivers it.
 *
 * Render's proxy rewrites every server-sent WebSocket close code to 1005
 * ("no status received"). Found live 2026-09-20, in a real browser: the
 * server sent WS_CLOSE_REPLACED, the console read 1005, the client (branching
 * on the code) auto-reconnected and took the seat back, and two tabs of one
 * browser warred every 2 s — the very bug the code was written in July to
 * end. It had been inert since the day it shipped, and no test could see it:
 * local dev and e2e connect directly, where the code arrives intact.
 *
 * So the server now announces an intentional close in a DATA frame first,
 * and THIS suite feeds the client exactly what production sends: the frame,
 * then a close whose code is 1005. The wiring under test is the whole path —
 * socket → lifecycle manager → router → service → lifecycle manager — in the
 * real WebSocketService, not a mocked router.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketService, ConnectionState, type AuthEvent } from "../websocket";

let sockets: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    sockets.push(this);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  /** The browser's own close(): a close frame goes out, then onclose fires. */
  close(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }

  /** The proxy's version of a server close: the frame arrives, its code does not. */
  closeFromServerThroughProxy(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code: 1005, reason: "" }));
  }

  receive(frame: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
  }

  frameTypes(): string[] {
    return this.sent.map((raw) => (JSON.parse(raw) as { t: string }).t);
  }
}

function memoryStore() {
  const entries = new Map<string, string>();
  return {
    read: (roomId?: string) => entries.get(roomId ?? "default"),
    write: (roomId: string | undefined, token: string) => {
      entries.set(roomId ?? "default", token);
    },
  };
}

describe("WebSocketService — connection-closing through a proxy that strips close codes", () => {
  let states: ConnectionState[];
  let authEvents: AuthEvent[];

  beforeEach(() => {
    sockets = [];
    states = [];
    authEvents = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(undefined));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A logged-in tab: connected, authenticated, heartbeat running. */
  function loggedInService() {
    const service = new WebSocketService({
      url: "ws://localhost:8787",
      uid: "dave",
      onMessage: () => {},
      onStateChange: (state) => states.push(state),
      onAuthEvent: (event) => authEvents.push(event),
      sessionTokenStore: memoryStore(),
    });
    service.connect();
    const socket = sockets[0];
    socket.open();
    service.authenticate("Fun1");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });
    return { service, socket };
  }

  it("the REPLACED announcement, then a 1005 close: terminal, nothing reconnects, nothing else is sent", () => {
    const { socket } = loggedInService();
    const sentBefore = socket.sent.length;

    socket.receive({ t: "connection-closing", reason: "replaced" });
    // The frame alone runs the service's close teardown — the auth state is
    // reset before the (stripped) close frame ever arrives.
    expect(authEvents.at(-1)).toEqual({ type: "reset" });
    socket.closeFromServerThroughProxy();

    expect(states.at(-1)).toBe(ConnectionState.REPLACED);
    // The war was a reconnect every 2 s. Five minutes — past every backoff
    // and heartbeat window — must open no second socket and send nothing on
    // the first.
    vi.advanceTimersByTime(5 * 60_000);
    expect(sockets).toHaveLength(1);
    expect(socket.sent.length).toBe(sentBefore);
    expect(states.at(-1)).toBe(ConnectionState.REPLACED);
  });

  it("the CONFLICT announcement, then a 1005 close: held, not retried — a manual connect() is the user's retry", () => {
    const { service, socket } = loggedInService();

    socket.receive({ t: "connection-closing", reason: "conflict" });
    socket.closeFromServerThroughProxy();

    expect(states.at(-1)).toBe(ConnectionState.CONFLICT);
    vi.advanceTimersByTime(5 * 60_000);
    expect(sockets).toHaveLength(1);

    service.connect();

    expect(sockets).toHaveLength(2);
    expect(states.at(-1)).toBe(ConnectionState.CONNECTING);
  });

  it("a reason this build does not know still ends the session — held, never reconnected", () => {
    const { socket } = loggedInService();

    socket.receive({ t: "connection-closing", reason: "maintenance" });
    socket.closeFromServerThroughProxy();

    expect(states.at(-1)).toBe(ConnectionState.CONFLICT);
    vi.advanceTimersByTime(5 * 60_000);
    expect(sockets).toHaveLength(1);
  });

  it("the tab coming back to the foreground does not revive a REPLACED session", () => {
    const { socket } = loggedInService();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    socket.receive({ t: "connection-closing", reason: "replaced" });
    socket.closeFromServerThroughProxy();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sockets).toHaveLength(1);
    expect(states.at(-1)).toBe(ConnectionState.REPLACED);
    visibility.mockRestore();
  });

  it("a bare 1005 close with NO announcement still reconnects — a deploy restart must not strand the tab", () => {
    const { socket } = loggedInService();

    socket.closeFromServerThroughProxy();

    expect(states.at(-1)).toBe(ConnectionState.RECONNECTING);
    vi.advanceTimersByTime(2_000);
    expect(sockets).toHaveLength(2);
    expect(states.at(-1)).toBe(ConnectionState.CONNECTING);
  });

  it("on a direct connection the close code alone still ends the session (defence in depth)", () => {
    const { socket } = loggedInService();

    socket.close(4002, "Replaced by new connection");

    expect(states.at(-1)).toBe(ConnectionState.REPLACED);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });
});
