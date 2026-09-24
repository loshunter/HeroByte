// Destination: features/map-studio/__tests__/mapQueue.outcomes.test.ts.
// Establish the minimal handle type/API before calling a compiler failure RED.
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapOperationHandle } from "../mapOperation";
import {
  generation,
  mapDocument,
  queueHarness,
  wireId,
} from "./characterization/mapQueue.fixtures";

type Harness = ReturnType<typeof queueHarness>;
function submit(h: Harness, seed = 42): MapOperationHandle {
  let request!: MapOperationHandle;
  act(() => {
    request = h.result.current.generate({ ...generation, seed });
  });
  return request;
}
async function drain() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("map request outcomes belong to their original queue entry", () => {
  it("has a handle before dispatch and cancels unsent A when B activates", async () => {
    const h = queueHarness();
    const sent = submit(h);
    const waiting = submit(h, 81);
    const onSent = vi.fn();
    const onWaiting = vi.fn();
    void sent.completion.then(onSent);
    void waiting.completion.then(onWaiting);
    expect(sent.documentId).toBe("doc-a");
    expect(waiting.documentId).toBe("doc-a");
    expect(h.mint).toHaveBeenCalledTimes(1);
    await drain();
    expect(onWaiting).not.toHaveBeenCalled();
    h.open(mapDocument("doc-b", 20));
    await drain();
    expect(onWaiting).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: "failed",
        kind: "cancelled-before-send",
      }),
    );
    expect(onSent).not.toHaveBeenCalled();
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await drain();
    expect(onSent).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
    expect(onWaiting).toHaveBeenCalledTimes(1);
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
  });

  it("late A success dispatches waiting B using B's revision, never A's", async () => {
    const h = queueHarness();
    const first = submit(h);
    h.open(mapDocument("doc-b", 20));
    const second = submit(h, 81);
    act(() => h.result.current.updateGrid({ size: 60 }));
    h.documentFrame(mapDocument("doc-a", 8), wireId(h.command()));
    await expect(first.completion).resolves.toEqual({ status: "succeeded" });
    expect(h.command(1)).toMatchObject({ t: "map-studio-generate", documentId: "doc-b", seed: 81 });
    h.documentFrame(mapDocument("doc-b", 21), wireId(h.command(1)));
    await expect(second.completion).resolves.toEqual({ status: "succeeded" });
    expect(h.command(2)).toMatchObject({
      t: "map-studio-command",
      command: { documentId: "doc-b", baseRevision: 21 },
    });
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
  });

  it("same command id on a foreign document cannot settle or release the head", async () => {
    const h = queueHarness();
    const first = submit(h);
    submit(h, 81);
    const settled = vi.fn();
    void first.completion.then(settled);
    h.documentFrame(mapDocument("foreign", 40), wireId(h.command()));
    h.refuse(wireId(h.command()), "foreign");
    await drain();
    expect(settled).not.toHaveBeenCalled();
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.error).toBeNull();
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await drain();
    expect(settled).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
    expect(h.commands()).toHaveLength(2);
  });

  it("unrelated deletion preserves queue and current history", async () => {
    const h = queueHarness();
    h.receive({
      t: "map-studio-document",
      document: mapDocument(),
      history: { canUndo: true, canRedo: true },
    });
    const first = submit(h);
    submit(h, 81);
    const settled = vi.fn();
    void first.completion.then(settled);
    h.receive({ t: "map-studio-deleted", documentId: "unrelated" });
    await drain();
    expect(settled).not.toHaveBeenCalled();
    expect(h.result.current.canUndo).toBe(true);
    expect(h.result.current.canRedo).toBe(true);
    expect(h.result.current.saving).toBe(true);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await drain();
    expect(settled).toHaveBeenCalledOnce();
    expect(h.commands()).toHaveLength(2);
  });

  it("matching deletion distinguishes sent uncertainty from unsent cancellation", async () => {
    const h = queueHarness();
    const first = submit(h);
    const second = submit(h, 81);
    const id = wireId(h.command());
    h.receive({ t: "map-studio-deleted", documentId: "doc-a" });
    await expect(first.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
    await expect(second.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
    });
    h.refuse(id);
    h.connection(false);
    h.connection(true);
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.saving).toBe(false);
  });

  it("a conflict successor waits through unrelated frames and reconnect for its refresh", async () => {
    const h = queueHarness();
    act(() => h.result.current.updateGrid({ size: 60 }));
    const waiting = submit(h);
    h.refuse(wireId(h.command()), "doc-a", "revision-conflict");
    h.documentFrame(mapDocument("foreign", 40));
    h.connection(false);
    h.connection(true);
    expect(h.commands()).toHaveLength(1);
    h.documentFrame(mapDocument("doc-a", 10));
    expect(h.command(1)).toMatchObject({ t: "map-studio-generate", documentId: "doc-a" });
    h.documentFrame(mapDocument("doc-a", 11), wireId(h.command(1)));
    await expect(waiting.completion).resolves.toEqual({ status: "succeeded" });
  });

  it("no active document returns a terminal unsent handle without minting", async () => {
    const h = queueHarness(null);
    const request = submit(h);
    expect(request.documentId).toBeNull();
    await expect(request.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
    });
    expect(h.commands()).toEqual([]);
    expect(h.mint).not.toHaveBeenCalled();
  });

  it("real disposal settles both phases and retained reply callbacks cannot send", async () => {
    const h = queueHarness();
    const first = submit(h);
    const second = submit(h, 81);
    const retired = h.result.current;
    const id = wireId(h.command());
    h.unmount();
    await expect(first.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
    await expect(second.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
    });
    retired.handleServerMessage({
      t: "map-studio-document",
      document: mapDocument("doc-a", 4),
      appliedCommandId: id,
    });
    const after = retired.generate(generation);
    await expect(after.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
    });
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
  });

  it("StrictMode effect replay keeps requests usable, real disposal still settles", async () => {
    const h = queueHarness(mapDocument(), { strictMode: true });
    expect(h.effectLifecycle.setup).toHaveBeenCalledTimes(2);
    expect(h.effectLifecycle.cleanup).toHaveBeenCalledTimes(1);
    await drain();
    const first = submit(h);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await expect(first.completion).resolves.toEqual({ status: "succeeded" });
    const second = submit(h, 81);
    h.unmount();
    await expect(second.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
  });
});
