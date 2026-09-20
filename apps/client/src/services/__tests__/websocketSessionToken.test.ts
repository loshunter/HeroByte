/**
 * WebSocketService — the session-token half of the auth handshake.
 *
 * The server mints a token on every `auth-ok`; the client must keep the
 * newest one and send it back as `authenticate.token` on every later
 * authenticate — the first login excepted, when it has none. That token is
 * the ONLY thing that lets a reconnect prove it is the same session (so a DM
 * stays DM through a blip and can take over from its own stale socket), so
 * "did the frame carry it" is the whole test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketService, type SessionTokenStore } from "../websocket";

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

  close(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }

  receive(frame: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
  }

  /** Every authenticate frame this socket sent, parsed. */
  authFrames(): Array<{ t: string; secret: string; roomId?: string; token?: string }> {
    return this.sent
      .map(
        (raw) => JSON.parse(raw) as { t: string; secret: string; roomId?: string; token?: string },
      )
      .filter((frame) => frame.t === "authenticate");
  }
}

function memoryStore(): SessionTokenStore & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    read: (roomId) => entries.get(roomId ?? "default"),
    write: (roomId, token) => {
      entries.set(roomId ?? "default", token);
    },
  };
}

describe("WebSocketService session token flow", () => {
  beforeEach(() => {
    sockets = [];
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

  function connectedService(store?: SessionTokenStore) {
    const service = new WebSocketService({
      url: "ws://localhost:8787",
      uid: "dave",
      onMessage: () => {},
      sessionTokenStore: store,
    });
    service.connect();
    const socket = sockets[0];
    socket.open();
    return { service, socket };
  }

  it("a first login carries no token", () => {
    const { service, socket } = connectedService(memoryStore());

    service.authenticate("Fun1", "the-keep");

    const [frame] = socket.authFrames();
    expect(frame).toMatchObject({ secret: "Fun1", roomId: "the-keep" });
    expect("token" in frame).toBe(false);
  });

  it("stores the token from auth-ok under the table it authenticated into", () => {
    const store = memoryStore();
    const { service, socket } = connectedService(store);

    service.authenticate("Fun1", "the-keep");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });

    expect(store.entries.get("the-keep")).toBe("tok-1");
    expect(store.entries.has("default")).toBe(false);
  });

  it("presents the stored token on the reconnect after a drop", () => {
    const store = memoryStore();
    const { service, socket } = connectedService(store);
    service.authenticate("Fun1", "the-keep");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });

    // A transient drop: the lifecycle manager schedules a reconnect.
    socket.close(1006, "gone");
    vi.advanceTimersByTime(2_500);
    const reopened = sockets[1];
    expect(reopened).toBeDefined();
    reopened.open();

    const [reauth] = reopened.authFrames();
    expect(reauth).toMatchObject({ secret: "Fun1", roomId: "the-keep", token: "tok-1" });
    void service;
  });

  it("keeps the NEWEST token: every auth-ok rotates it", () => {
    const store = memoryStore();
    const { service, socket } = connectedService(store);
    service.authenticate("Fun1", "the-keep");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });
    socket.receive({ t: "auth-ok", sessionToken: "tok-2" });

    expect(store.entries.get("the-keep")).toBe("tok-2");

    socket.close(1006, "gone");
    vi.advanceTimersByTime(2_500);
    sockets[1].open();
    expect(sockets[1].authFrames()[0].token).toBe("tok-2");
  });

  it("presents a token another tab stashed for this table (the store wins over memory)", () => {
    const store = memoryStore();
    const { service, socket } = connectedService(store);
    service.authenticate("Fun1", "the-keep");
    socket.receive({ t: "auth-ok", sessionToken: "tok-mine" });

    // Another tab of this browser logged in since and rotated the token.
    store.entries.set("the-keep", "tok-theirs");

    socket.close(1006, "gone");
    vi.advanceTimersByTime(2_500);
    sockets[1].open();
    expect(sockets[1].authFrames()[0].token).toBe("tok-theirs");
  });

  it("falls back to this page's own copy when the store has nothing (private mode)", () => {
    const { service, socket } = connectedService(); // no store at all
    service.authenticate("Fun1", "the-keep");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });

    socket.close(1006, "gone");
    vi.advanceTimersByTime(2_500);
    sockets[1].open();
    expect(sockets[1].authFrames()[0].token).toBe("tok-1");
  });

  it("a fresh page load presents the token the store already holds", () => {
    const store = memoryStore();
    store.entries.set("the-keep", "tok-from-last-visit");
    const { service, socket } = connectedService(store);

    service.authenticate("Fun1", "the-keep");

    expect(socket.authFrames()[0].token).toBe("tok-from-last-visit");
  });

  it("an auth-ok without a token leaves the stored one alone", () => {
    const store = memoryStore();
    store.entries.set("the-keep", "tok-kept");
    const { service, socket } = connectedService(store);
    service.authenticate("Fun1", "the-keep");

    socket.receive({ t: "auth-ok" });

    expect(store.entries.get("the-keep")).toBe("tok-kept");
  });

  it("auth-failed does NOT discard the token — a mistyped password is not a bad token", () => {
    // The token is still valid server-side; throwing it away here would turn
    // one typo into a demotion (the corrected password would then arrive
    // tokenless and the reclaim would reset the player's DM flag).
    const store = memoryStore();
    store.entries.set("the-keep", "tok-kept");
    const { service, socket } = connectedService(store);
    service.authenticate("wrong", "the-keep");

    socket.receive({ t: "auth-failed", reason: "Invalid table password" });

    expect(store.entries.get("the-keep")).toBe("tok-kept");
    // The rejected PASSWORD is dropped, exactly as before.
    expect(service.getAuthCredentials()).toBeNull();
  });
});
