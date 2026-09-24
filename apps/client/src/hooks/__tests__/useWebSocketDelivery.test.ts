import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../useWebSocket";
import type { CommandDeliveryEvent } from "../../services/websocket/serviceTypes";
import {
  generation,
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "../../services/__tests__/characterization/transport.fixtures";

beforeEach(installTransportEnvironment);
afterEach(() => {
  cleanup();
  restoreTransportEnvironment();
});

describe("delivery observation does not recreate the transport", () => {
  function setup() {
    const h = renderHook(({ uid }) => useWebSocket({ url: "ws://localhost:8787", uid }), {
      initialProps: { uid: "observer-a" },
    });
    const socket = TransportSocket.instances[0]!;
    act(() => {
      socket.open();
      h.result.current.authenticate("test");
      socket.receive({ t: "auth-ok" });
    });
    return { ...h, socket };
  }

  it("preserves registrar identity, announces replacement, and an old unsubscribe cannot remove the replacement", () => {
    const h = setup();
    const register = h.result.current.registerCommandDelivery;
    const first = vi.fn(),
      second = vi.fn();
    const unsubscribeFirst = register(first);
    h.rerender({ uid: "observer-a" });
    expect(h.result.current.registerCommandDelivery).toBe(register);
    expect(TransportSocket.instances).toHaveLength(1);
    const unsubscribeSecond = register(second);
    expect(first).toHaveBeenCalledExactlyOnceWith({ type: "tracking-lost" });
    unsubscribeFirst();
    act(() => h.result.current.send(generation));
    expect(second).toHaveBeenCalledExactlyOnceWith({ type: "send-attempt", message: generation });
    unsubscribeSecond();
    act(() => vi.advanceTimersByTime(500));
    expect(h.socket.generationFrames()).toHaveLength(2);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("observes every physical attempt before the socket write and reports service replacement", () => {
    const h = setup();
    const counts: number[] = [];
    const observer = vi.fn((event: CommandDeliveryEvent) => {
      if (event.type === "send-attempt") counts.push(h.socket.generationFrames().length);
    });
    h.result.current.registerCommandDelivery(observer);
    act(() => h.result.current.send(generation));
    act(() => vi.advanceTimersByTime(500));
    expect(counts).toEqual([0, 1]);
    h.rerender({ uid: "observer-b" });
    expect(observer).toHaveBeenLastCalledWith({ type: "tracking-lost" });
    expect(h.socket.onmessage).toBeNull();
  });
});
