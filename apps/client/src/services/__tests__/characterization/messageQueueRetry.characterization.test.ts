import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MessageQueueManager,
  type MessageQueueManagerConfig,
} from "../../websocket/MessageQueueManager";
import {
  generation,
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "./transport.fixtures";

describe("MessageQueueManager retry callback baseline", () => {
  let socket: TransportSocket;
  let manager: MessageQueueManager;

  beforeEach(() => {
    installTransportEnvironment();
    socket = new TransportSocket("ws://localhost:8787");
    socket.open();
  });

  afterEach(() => {
    manager?.resetRetries();
    restoreTransportEnvironment();
  });

  it("hands the original message to the callback but does not resend by itself", () => {
    const retry = vi.fn();
    const exhausted = vi.fn();
    manager = new MessageQueueManager({
      retryBackoffMs: 100,
      onRetryDispatch: retry,
      onRetryExhausted: exhausted,
    });
    manager.send(generation, socket.asWebSocket(), () => true);
    vi.advanceTimersByTime(99);
    expect(retry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith(generation);
    expect(retry.mock.calls[0][0]).toBe(generation);
    expect(socket.sent).toEqual([JSON.stringify(generation)]);
    vi.advanceTimersByTime(10_000);
    expect(retry).toHaveBeenCalledOnce();
    expect(exhausted).not.toHaveBeenCalled();
  });

  it("updates the attempt before synchronous callback redispatch and doubles the next delay", () => {
    const events: string[] = [];
    const callbackMessages: unknown[] = [];
    socket.beforeSend = () => events.push("wire");
    const exhausted = vi.fn(() => events.push("exhausted"));
    manager = new MessageQueueManager({
      retryBackoffMs: 100,
      maxRetries: 2,
      onRetryExhausted: exhausted,
      onRetryDispatch: (message) => {
        callbackMessages.push(message);
        events.push(`callback:${socket.sent.length}`);
        manager.send(message, socket.asWebSocket(), () => true);
        events.push("callback-return");
      },
    });
    manager.send(generation, socket.asWebSocket(), () => true);
    vi.advanceTimersByTime(100);
    expect(events).toEqual(["wire", "callback:1", "wire", "callback-return"]);
    vi.advanceTimersByTime(199);
    expect(callbackMessages).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(callbackMessages).toEqual([generation, generation]);
    expect(callbackMessages.every((message) => message === generation)).toBe(true);
    expect(events.slice(-3)).toEqual(["callback:2", "wire", "callback-return"]);
    vi.advanceTimersByTime(399);
    expect(exhausted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exhausted).toHaveBeenCalledOnce();
    expect(exhausted).toHaveBeenCalledWith(generation);
    expect(socket.sent).toEqual(Array(3).fill(JSON.stringify(generation)));
    vi.advanceTimersByTime(10_000);
    expect(exhausted).toHaveBeenCalledOnce();
  });

  it("a retry callback can enqueue while offline without proving another wire send", () => {
    const retry = vi.fn((message) => manager.send(message, socket.asWebSocket(), () => true));
    const exhausted = vi.fn();
    manager = new MessageQueueManager({
      retryBackoffMs: 100,
      onRetryDispatch: retry,
      onRetryExhausted: exhausted,
    });
    manager.send(generation, socket.asWebSocket(), () => true);
    // Queue-manager isolation: a real service close also calls resetRetries.
    socket.readyState = TransportSocket.CLOSED;
    vi.advanceTimersByTime(100);
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith(generation);
    expect(manager.getQueueLength()).toBe(1);
    expect(socket.sent).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(retry).toHaveBeenCalledOnce();
    expect(exhausted).not.toHaveBeenCalled();
    socket.open();
    manager.flush(socket.asWebSocket(), () => true);
    expect(socket.sent).toEqual(Array(2).fill(JSON.stringify(generation)));
    vi.advanceTimersByTime(199);
    expect(retry).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("clear removes buffered messages but leaves in-flight retry tracking intact", () => {
    const retry = vi.fn();
    manager = new MessageQueueManager({ retryBackoffMs: 100, onRetryDispatch: retry });
    manager.send(generation, socket.asWebSocket(), () => true);
    manager.send({ ...generation, commandId: "buffered" }, null, () => false);
    manager.clear();
    expect(manager.getQueueLength()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith(generation);
  });

  it("resetRetries cancels retry and exhaustion callbacks without clearing the offline buffer", () => {
    const retry = vi.fn();
    const exhausted = vi.fn();
    manager = new MessageQueueManager({
      retryBackoffMs: 100,
      onRetryDispatch: retry,
      onRetryExhausted: exhausted,
    });
    manager.send(generation, socket.asWebSocket(), () => true);
    manager.send({ ...generation, commandId: "buffered" }, null, () => false);
    manager.resetRetries();
    vi.advanceTimersByTime(10_000);
    expect(retry).not.toHaveBeenCalled();
    expect(exhausted).not.toHaveBeenCalled();
    expect(manager.getQueueLength()).toBe(1);
  });

  it("only a matching command result retires the retry timer", () => {
    const retry = vi.fn((message) => manager.send(message, socket.asWebSocket(), () => true));
    manager = new MessageQueueManager({ retryBackoffMs: 100, onRetryDispatch: retry });
    manager.send(generation, socket.asWebSocket(), () => true);
    manager.handleCommandResult("unrelated");
    vi.advanceTimersByTime(100);
    expect(retry).toHaveBeenCalledOnce();
    manager.handleCommandResult(generation.commandId);
    vi.advanceTimersByTime(10_000);
    expect(retry).toHaveBeenCalledOnce();
    expect(socket.sent).toHaveLength(2);
  });

  it("captures its callback at construction rather than rereading a mutated config", () => {
    const initial = vi.fn();
    const replacement = vi.fn();
    const config: MessageQueueManagerConfig = { retryBackoffMs: 100, onRetryDispatch: initial };
    manager = new MessageQueueManager(config);
    config.onRetryDispatch = replacement;
    manager.send(generation, socket.asWebSocket(), () => true);
    vi.advanceTimersByTime(100);
    expect(initial).toHaveBeenCalledOnce();
    expect(initial).toHaveBeenCalledWith(generation);
    expect(replacement).not.toHaveBeenCalled();
  });
});
