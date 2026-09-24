import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../../useWebSocket";
import {
  generation,
  refusal,
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "../../../services/__tests__/characterization/transport.fixtures";

describe("useWebSocket current callback registrar baseline", () => {
  beforeEach(installTransportEnvironment);
  afterEach(() => {
    cleanup();
    restoreTransportEnvironment();
  });

  function mount() {
    const hook = renderHook(({ uid }) => useWebSocket({ url: "ws://localhost:8787", uid }), {
      initialProps: { uid: "transport-user-a" },
    });
    const socket = TransportSocket.instances[0];
    act(() => {
      socket.open();
      hook.result.current.authenticate("local-test", "transport-table");
      socket.receive({ t: "auth-ok" });
    });
    return { ...hook, socket };
  }

  it("keeps the control registrar stable and routes through its latest replacement without recreating the service", () => {
    const { result, rerender, socket } = mount();
    const register = result.current.registerServerEventHandler;
    const first = vi.fn();
    const second = vi.fn();
    // Current API returns void: this is not the proposed unsubscribe API.
    expect(register(first)).toBeUndefined();
    act(() => socket.receive(refusal));
    expect(first).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith(refusal);
    rerender({ uid: "transport-user-a" });
    expect(result.current.registerServerEventHandler).toBe(register);
    expect(TransportSocket.instances).toHaveLength(1);
    expect(register(second)).toBeUndefined();
    act(() => socket.receive(refusal));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith(refusal);
  });

  it("uses the newest drop handler at exhaustion and exposes only message type and reason", () => {
    const { result, rerender, socket } = mount();
    const register = result.current.registerCommandDropHandler;
    const first = vi.fn();
    const second = vi.fn();
    expect(register(first)).toBeUndefined();
    act(() => result.current.send(generation));
    act(() => vi.advanceTimersByTime(500));
    rerender({ uid: "transport-user-a" });
    expect(result.current.registerCommandDropHandler).toBe(register);
    expect(TransportSocket.instances).toHaveLength(1);
    register(second);
    act(() => vi.advanceTimersByTime(7_000));
    expect(socket.generationFrames()).toHaveLength(4);
    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls).toEqual([["map-studio-generate", "retry-exhausted"]]);
    expect(result.current.snapshot).toBeNull();
  });

  it("UID replacement disconnects the old service, retains stable registrars, and uses the latest ref on the new socket", () => {
    const { result, rerender, socket } = mount();
    const register = result.current.registerServerEventHandler;
    const first = vi.fn();
    const second = vi.fn();
    const drop = vi.fn();
    register(first);
    result.current.registerCommandDropHandler(drop);
    act(() => result.current.send(generation));
    rerender({ uid: "transport-user-b" });
    expect(result.current.registerServerEventHandler).toBe(register);
    expect(TransportSocket.instances).toHaveLength(2);
    expect(socket.onmessage).toBeNull();
    const replacement = TransportSocket.instances[1];
    act(() => {
      replacement.open();
      result.current.authenticate("local-test", "transport-table");
      replacement.receive({ t: "auth-ok" });
    });
    register(second);
    act(() => {
      socket.receive(refusal);
      replacement.receive(refusal);
      vi.advanceTimersByTime(10_000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith(refusal);
    expect(drop).not.toHaveBeenCalled();
    expect(socket.generationFrames()).toHaveLength(1);
    expect(replacement.generationFrames()).toHaveLength(0);
  });

  it("unmount detaches actual socket delivery and cancels timed retries without a drop callback", () => {
    const { result, socket, unmount } = mount();
    const control = vi.fn();
    const drop = vi.fn();
    result.current.registerServerEventHandler(control);
    result.current.registerCommandDropHandler(drop);
    act(() => result.current.send(generation));
    unmount();
    expect(socket.onmessage).toBeNull();
    act(() => {
      socket.receive(refusal);
      vi.advanceTimersByTime(10_000);
    });
    expect(TransportSocket.instances).toHaveLength(1);
    expect(socket.generationFrames()).toHaveLength(1);
    expect(control).not.toHaveBeenCalled();
    expect(drop).not.toHaveBeenCalled();
  });
});
