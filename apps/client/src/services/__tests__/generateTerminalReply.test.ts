// Destination: services/__tests__/generateTerminalReply.desired.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketService } from "../websocket";
import {
  generation,
  refusal,
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "./characterization/transport.fixtures";

describe("Generate terminal application refusal owns its remaining transport retry", () => {
  let service: WebSocketService;
  let socket: TransportSocket;
  const control = vi.fn();
  const drop = vi.fn();

  beforeEach(() => {
    installTransportEnvironment();
    control.mockReset();
    drop.mockReset();
    service = new WebSocketService({
      url: "ws://localhost:8787",
      uid: "terminal-reply-dm",
      onMessage: vi.fn(),
      onControlMessage: control,
      onCommandDropped: drop,
    });
    service.connect();
    socket = TransportSocket.instances[0];
    socket.open();
    service.authenticate("local-test", "transport-table");
    socket.receive({ t: "auth-ok" });
    service.send(generation);
  });

  afterEach(() => {
    service.disconnect();
    restoreTransportEnvironment();
  });

  it("keeps bounded same-ID retries after receipt ACK when the application result is lost", () => {
    socket.receive({ t: "ack", commandId: generation.commandId });
    vi.advanceTimersByTime(7500);
    expect(socket.generationFrames()).toEqual(Array(4).fill(JSON.stringify(generation)));
    expect(drop).toHaveBeenCalledExactlyOnceWith("map-studio-generate", "retry-exhausted");
    expect(control).not.toHaveBeenCalled();
  });

  it("still retires an ordinary command on receipt ACK", () => {
    socket.receive(refusal);
    socket.receive({ t: "ack", commandId: generation.commandId });
    const ordinary = {
      t: "map-studio-get" as const,
      documentId: generation.documentId,
      commandId: "ordinary",
    };
    service.send(ordinary);
    socket.receive({ t: "ack", commandId: ordinary.commandId });
    const before = socket.sent.filter((raw) => JSON.parse(raw).commandId === ordinary.commandId);
    vi.advanceTimersByTime(10000);
    expect(before).toHaveLength(1);
    expect(socket.sent.filter((raw) => JSON.parse(raw).commandId === ordinary.commandId)).toEqual(
      before,
    );
    expect(drop).not.toHaveBeenCalled();
  });

  it("retires the timer before forwarding a matching refusal, without waiting for transport ack", () => {
    const wireCountsInsideConsumer: number[] = [];
    control.mockImplementation(() => {
      vi.advanceTimersByTime(500);
      wireCountsInsideConsumer.push(socket.generationFrames().length);
    });
    socket.receive(refusal);
    expect(control).toHaveBeenCalledExactlyOnceWith(refusal);
    expect(wireCountsInsideConsumer).toEqual([1]);
    vi.advanceTimersByTime(10_000);
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation)]);
    expect(drop).not.toHaveBeenCalled();
    // Generic command-rejected remains ambiguous to the consumer. Retirement
    // proves no future timed send, not that an earlier invocation had no effect.
  });

  it.each([
    { commandId: "foreign-id", documentId: generation.documentId },
    { commandId: generation.commandId, documentId: "foreign-document" },
  ])("does not retire Generate for foreign identity %j", (identity) => {
    const foreign = { ...refusal, ...identity };
    socket.receive(foreign);
    expect(control).toHaveBeenCalledExactlyOnceWith(foreign);
    vi.advanceTimersByTime(500);
    expect(socket.generationFrames()).toEqual(Array(2).fill(JSON.stringify(generation)));
    socket.receive(refusal);
    vi.advanceTimersByTime(10_000);
    expect(socket.generationFrames()).toEqual(Array(2).fill(JSON.stringify(generation)));
    expect(drop).not.toHaveBeenCalled();
    // The resend before the real refusal still makes safe-new-ID retry unavailable;
    // monotonic observation is a separate controller/consumer assertion.
  });

  it("retires a retry already buffered after a socket write throws, preserving another command", () => {
    socket.beforeSend = (raw) => {
      if ((JSON.parse(raw) as { t: string }).t === "map-studio-generate") {
        throw new Error("socket write interrupted");
      }
    };
    vi.advanceTimersByTime(500);
    const other = { ...generation, commandId: "another-generation", documentId: "another-map" };
    service.send(other);
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation)]);
    socket.beforeSend = undefined;
    socket.receive(refusal);
    // Auth completion is the existing public path that flushes buffered writes.
    socket.receive({ t: "auth-ok" });
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation), JSON.stringify(other)]);
    socket.receive({ ...refusal, documentId: other.documentId, commandId: other.commandId });
    vi.advanceTimersByTime(10_000);
    expect(socket.generationFrames()).toEqual([JSON.stringify(generation), JSON.stringify(other)]);
    expect(control).toHaveBeenCalledTimes(2);
    expect(control).toHaveBeenNthCalledWith(1, refusal);
  });
});
