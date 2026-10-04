import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CommandDeliveryEvent } from "../../../services/websocket/serviceTypes";
import type { MapOperationHandle } from "../mapOperation";
import {
  generation,
  mapDocument,
  queueHarness,
  wireId,
} from "./characterization/mapQueue.fixtures";

function conflict() {
  vi.useFakeTimers();
  let deliver: (event: CommandDeliveryEvent) => void = () => {};
  const h = queueHarness(mapDocument(), {
    registerCommandDelivery: (handler) => {
      deliver = handler;
      return () => {};
    },
  });
  let waiting!: MapOperationHandle;
  act(() => {
    h.result.current.updateGrid({ size: 60 });
    waiting = h.result.current.generate(generation);
  });
  const settled = vi.fn();
  void waiting.completion.then(settled);
  h.refuse(wireId(h.command()), "doc-a", "revision-conflict");
  expect(h.commands()).toHaveLength(1);
  expect(h.send).toHaveBeenCalledWith({ t: "map-studio-get", documentId: "doc-a" });
  return { ...h, settled, deliver: (event: CommandDeliveryEvent) => act(() => deliver(event)) };
}

describe("a failed conflict refresh terminates only its unsent successors", () => {
  it("a dropped separate GET for A cannot cancel A's still-viable conflict refresh", async () => {
    const h = conflict();
    act(() => h.result.current.openDocument("doc-a"));
    const otherGet = h.send.mock.calls.at(-1)![0];
    expect(otherGet).toEqual({ t: "map-studio-get", documentId: "doc-a" });
    h.deliver({ type: "dropped", message: otherGet, reason: "queue-overflow" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.settled).not.toHaveBeenCalled();
    expect(h.result.current.saving).toBe(true);
    h.documentFrame(mapDocument("doc-a", 10));
    expect(h.commands()).toHaveLength(2);
    h.documentFrame(mapDocument("doc-a", 11), wireId(h.command(1)));
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(h.settled).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
  });

  it("switching to B clears A's deadline without timing out B's already-sent generation", async () => {
    const h = conflict();
    h.open(mapDocument("doc-b", 20));
    let next!: MapOperationHandle;
    act(() => {
      next = h.result.current.generate(generation);
    });
    const settled = vi.fn();
    void next.completion.then(settled);
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(h.settled).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: "cancelled-before-send" }),
    );
    expect(settled).not.toHaveBeenCalled();
    expect(h.result.current.error).toBeNull();
    h.documentFrame(mapDocument("doc-b", 21), wireId(h.command(1)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(settled).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
  });
  it.each(["not-found", "drop", "timeout"] as const)(
    "settles after %s and cannot revive on a late frame",
    async (mode) => {
      const h = conflict();
      if (mode === "not-found") h.refuse("get:doc-a", "doc-a", "not-found", "Map no longer exists");
      if (mode === "drop") {
        h.deliver({
          type: "dropped",
          message: { t: "map-studio-get", documentId: "doc-a" },
          reason: "retry-exhausted",
        });
        await act(async () => {
          vi.advanceTimersByTime(11_999);
        });
        expect(h.settled).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
      }
      if (mode === "timeout") act(() => vi.advanceTimersByTime(12_000));
      await act(async () => {
        await Promise.resolve();
      });
      expect(h.settled).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: "failed", kind: "cancelled-before-send" }),
      );
      expect(h.result.current.saving).toBe(false);
      h.documentFrame(mapDocument("doc-a", 10));
      h.connection(false);
      h.connection(true);
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(h.commands()).toHaveLength(1);
      expect(h.settled).toHaveBeenCalledTimes(1);
    },
  );

  it("a completed list request cannot cancel the conflict refresh deadline", async () => {
    const h = conflict();
    act(() => h.result.current.refresh());
    h.receive({ t: "map-studio-documents", documents: [] });
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(h.settled).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: "cancelled-before-send" }),
    );
    expect(h.result.current.saving).toBe(false);
    expect(h.commands()).toHaveLength(1);
  });

  it("ignores a foreign refresh drop and releases the successor on the matching document", async () => {
    const h = conflict();
    h.deliver({
      type: "dropped",
      message: { t: "map-studio-get", documentId: "other" },
      reason: "retry-exhausted",
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.settled).not.toHaveBeenCalled();
    h.documentFrame(mapDocument("doc-a", 10));
    expect(h.commands()).toHaveLength(2);
    h.documentFrame(mapDocument("doc-a", 11), wireId(h.command(1)));
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(h.settled).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
  });
});
