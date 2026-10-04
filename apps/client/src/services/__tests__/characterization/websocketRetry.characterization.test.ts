import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketService } from "../../websocket";
import {
  generation,
  refusal,
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "./transport.fixtures";

describe("WebSocketService retry and result-channel baseline", () => {
  let service: WebSocketService;
  let socket: TransportSocket;
  const control = vi.fn();
  const snapshot = vi.fn();
  const drop = vi.fn();

  beforeEach(() => {
    installTransportEnvironment();
    control.mockClear();
    snapshot.mockClear();
    drop.mockClear();
    service = new WebSocketService({
      url: "ws://localhost:8787",
      uid: "transport-user",
      onMessage: snapshot,
      onControlMessage: control,
      onCommandDropped: drop,
    });
    service.connect();
    socket = TransportSocket.instances[0];
    socket.open();
  });

  afterEach(() => {
    service.disconnect();
    restoreTransportEnvironment();
  });

  function authenticate(): void {
    service.authenticate("local-test", "transport-table");
    socket.receive({ t: "auth-ok" });
  }

  it("retries identical Generate bytes and preserves both existing identities until exhaustion", () => {
    authenticate();
    service.send(generation);
    const first = socket.generationFrames()[0];
    expect(JSON.parse(first)).toEqual(generation);
    vi.advanceTimersByTime(499);
    expect(socket.generationFrames()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(socket.generationFrames()).toEqual([first, first]);
    vi.advanceTimersByTime(1_000);
    expect(socket.generationFrames()).toEqual([first, first, first]);
    vi.advanceTimersByTime(2_000);
    expect(socket.generationFrames()).toEqual([first, first, first, first]);
    vi.advanceTimersByTime(3_999);
    expect(drop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(drop).toHaveBeenCalledOnce();
    expect(drop).toHaveBeenCalledWith("map-studio-generate", "retry-exhausted");
    // Exhaustion provides no application-level result, rollback, or document.
    expect(control).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });

  it.each(["ack", "nack"] as const)(
    "U3a: transport %s preserves the application-result boundary",
    (type) => {
      authenticate();
      service.send(generation);
      socket.receive({ t: type, commandId: "unrelated" });
      vi.advanceTimersByTime(500);
      expect(socket.generationFrames()).toHaveLength(2);
      socket.receive({ t: type, commandId: generation.commandId });
      vi.advanceTimersByTime(10_000);
      expect(socket.generationFrames()).toHaveLength(type === "ack" ? 4 : 2);
      if (type === "ack")
        expect(drop).toHaveBeenCalledExactlyOnceWith("map-studio-generate", "retry-exhausted");
      else expect(drop).not.toHaveBeenCalled();
      expect(control).not.toHaveBeenCalled();
      expect(snapshot).not.toHaveBeenCalled();
    },
  );

  it("U3a: a correlated application refusal reaches control and retires its transport retry", () => {
    authenticate();
    service.send(generation);
    socket.receive(refusal);
    expect(control).toHaveBeenCalledOnce();
    expect(control).toHaveBeenCalledWith(refusal);
    vi.advanceTimersByTime(500);
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation)]);
    expect(drop).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("a transport ack following refusal stops retry while preserving that refusal as the only control result", () => {
    authenticate();
    service.send(generation);
    socket.receive(refusal);
    socket.receive({ t: "ack", commandId: generation.commandId });
    vi.advanceTimersByTime(10_000);
    expect(control).toHaveBeenCalledOnce();
    expect(control).toHaveBeenCalledWith(refusal);
    expect(socket.generationFrames()).toHaveLength(1);
    expect(drop).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("disconnect cancels retries and detaches socket callbacks without reporting non-application", () => {
    authenticate();
    service.send(generation);
    service.disconnect();
    expect(socket.onmessage).toBeNull();
    expect(socket.onclose).toBeNull();
    socket.receive(refusal);
    vi.advanceTimersByTime(10_000);
    expect(TransportSocket.instances).toHaveLength(1);
    expect(socket.generationFrames()).toHaveLength(1);
    expect(drop).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
  });

  it("buffered first dispatch has no retry timer before auth flush and retains the supplied command id", () => {
    service.send(generation);
    vi.advanceTimersByTime(1_000);
    expect(socket.generationFrames()).toHaveLength(0);
    expect(drop).not.toHaveBeenCalled();
    authenticate();
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation)]);
    vi.advanceTimersByTime(499);
    expect(socket.generationFrames()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(socket.generationFrames()).toEqual(Array(2).fill(JSON.stringify(generation)));
    expect(control).not.toHaveBeenCalled();
  });
});
