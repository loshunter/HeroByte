/**
 * WebSocketService — a late ack re-sends the SAME command.
 *
 * The client retries an ack-tracked command whose ack has not arrived after
 * 500 ms (then 1000, then 2000), with the same commandId. A late ack is not a
 * lost command: under load the first copy has usually landed already, so the
 * server receives the same command twice. That is correct client behaviour
 * only because the server answers a repeated commandId from its ledger
 * instead of applying it again (commandReplay.contract.test.ts on the server).
 *
 * Pins the client half of that contract: a retry carries the original
 * commandId (a fresh id would defeat the ledger), and an ack ends the retries.
 * And the one the server answers without an ack (fork-table) is never retried.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketService } from "../websocket";

let sockets: MockWebSocket[] = [];

const FORK = {
  t: "fork-table",
  roomId: "new-table",
  name: "New Table",
  roomPassword: "room-pass",
  dmPassword: "dm-pass",
} as const;

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

  framesOfType(type: string): Array<{ t: string; commandId?: string }> {
    return this.sent
      .map((raw) => JSON.parse(raw) as { t: string; commandId?: string })
      .filter((frame) => frame.t === type);
  }
}

describe("WebSocketService late-ack retry", () => {
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

  function authenticatedSocket() {
    const service = new WebSocketService({
      url: "ws://localhost:8787",
      uid: "dave",
      onMessage: () => {},
    });
    service.connect();
    const socket = sockets[0]!;
    socket.open();
    service.authenticate("Fun1");
    socket.receive({ t: "auth-ok", sessionToken: "tok-1" });
    return { service, socket };
  }

  it("an ack later than 500 ms gets the same chat line sent twice, same commandId", () => {
    const { service, socket } = authenticatedSocket();

    service.send({ t: "chat", text: "hello table" });
    const [first] = socket.framesOfType("chat");
    expect(first?.commandId).toEqual(expect.any(String));

    vi.advanceTimersByTime(499);
    expect(socket.framesOfType("chat")).toHaveLength(1);

    vi.advanceTimersByTime(1); // 500 ms, no ack yet: the retry fires
    const chats = socket.framesOfType("chat");
    expect(chats).toHaveLength(2);
    expect(chats[1]?.commandId).toBe(first?.commandId);

    // The first copy's ack, late. No third send follows.
    socket.receive({ t: "ack", commandId: first!.commandId });
    vi.advanceTimersByTime(10_000);
    expect(socket.framesOfType("chat")).toHaveLength(2);
  });

  it("an ack inside 500 ms sends the command once", () => {
    const { service, socket } = authenticatedSocket();

    service.send({ t: "chat", text: "quick" });
    const [first] = socket.framesOfType("chat");
    vi.advanceTimersByTime(200);
    socket.receive({ t: "ack", commandId: first!.commandId });
    vi.advanceTimersByTime(10_000);

    expect(socket.framesOfType("chat")).toHaveLength(1);
  });

  it("a fork-table is sent once, with no commandId, and never retried (it is never acked)", () => {
    // The server answers it with fork-table-result, not an ack: tracked, it was sent
    // three more times, each copy carrying both passwords and minting the table again.
    const { service, socket } = authenticatedSocket();

    service.send(FORK);
    const forks = () => socket.framesOfType("fork-table");
    expect(forks()).toHaveLength(1);
    expect(forks()[0]).not.toHaveProperty("commandId");

    for (const step of [500, 1000, 2000, 10_000]) {
      vi.advanceTimersByTime(step);
      expect(forks(), `after another ${step} ms`).toHaveLength(1);
    }
  });
});
