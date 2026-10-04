import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { generation, mapDocument, queueHarness, wireId } from "./mapQueue.fixtures";

describe("map queue lifecycle (baseline pinned before U3a; intentional repairs below)", () => {
  it("U3a: deleting an unrelated document preserves sent and unsent tracking and history", () => {
    const h = queueHarness();
    h.receive({
      t: "map-studio-document",
      document: mapDocument(),
      history: { canUndo: true, canRedo: true },
    });
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    const first = h.command();
    h.receive({ t: "map-studio-deleted", documentId: "unrelated-map" });
    expect(h.result.current.activeDocument?.id).toBe("doc-a");
    expect(h.result.current.saving).toBe(true);
    expect(h.result.current.canUndo).toBe(true);
    expect(h.result.current.canRedo).toBe(true);
    h.connection(false);
    h.connection(true);
    expect(h.command(1)).toBe(first);
    h.refuse(wireId(first));
    expect(h.command(2)).toMatchObject({
      t: "map-studio-command",
      command: { type: "update-grid", documentId: "doc-a" },
    });
    expect(h.commands()).toHaveLength(3);
    expect(h.mint).toHaveBeenCalledTimes(2);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command(2)));
    expect(h.result.current.saving).toBe(false);
  });

  it("the unsent entry has no wire ID until dispatch, including across reconnect replay", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    const first = h.command();
    const serialized = JSON.stringify(first);
    expect(h.mint).toHaveBeenCalledTimes(1);
    h.documentFrame(mapDocument("doc-a", 4), "unrelated-command");
    h.refuse("unrelated-command");
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.error).toBeNull();
    h.connection(false);
    expect(h.result.current.saving).toBe(true);
    expect(h.commands()).toHaveLength(1);
    h.connection(true);
    expect(h.commands()).toHaveLength(2);
    expect(h.command(1)).toBe(first);
    expect(JSON.stringify(h.command(1))).toBe(serialized);
    expect(h.mint).toHaveBeenCalledTimes(1);
    h.documentFrame(mapDocument("doc-a", 5), wireId(first));
    expect(h.command(2)).toMatchObject({
      t: "map-studio-command",
      command: { commandId: "wire-2", baseRevision: 5 },
    });
    expect(h.mint).toHaveBeenCalledTimes(2);
    h.documentFrame(mapDocument("doc-a", 6), wireId(first));
    h.refuse(wireId(first));
    expect(h.commands()).toHaveLength(3);
    expect(h.result.current.saving).toBe(true);
    expect(h.result.current.error).toBeNull();
  });

  it("U3a: reconnect refreshes before dispatching the conflict successor", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.updateGrid({ size: 60 });
      h.result.current.generate(generation);
    });
    h.refuse(wireId(h.command()), "doc-a", "revision-conflict");
    expect(h.commands()).toHaveLength(1);
    h.connection(false);
    h.connection(true);
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
    h.documentFrame(mapDocument("doc-a", 5));
    expect(h.commands()).toHaveLength(2);
    expect(h.command(1)).toMatchObject({ t: "map-studio-generate", commandId: "wire-2" });
    expect(h.mint).toHaveBeenCalledTimes(2);
  });

  it("StrictMode setup replay leaves enqueue, matching replies, and reconnect usable", () => {
    const h = queueHarness(mapDocument(), { strictMode: true });
    expect(h.effectLifecycle.setup).toHaveBeenCalledTimes(2);
    expect(h.effectLifecycle.cleanup).toHaveBeenCalledTimes(1);
    expect(h.commands()).toHaveLength(0);
    expect(h.mint).not.toHaveBeenCalled();
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    const first = h.command();
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
    expect(h.result.current.saving).toBe(true);
    h.connection(false);
    h.connection(true);
    expect(h.commands()).toHaveLength(2);
    expect(h.command(1)).toBe(first);
    expect(h.mint).toHaveBeenCalledTimes(1);
    h.documentFrame(mapDocument("doc-a", 4), wireId(first));
    const follower = h.command(2);
    expect(follower).toMatchObject({
      t: "map-studio-command",
      command: { commandId: "wire-2", documentId: "doc-a", baseRevision: 4 },
    });
    expect(h.mint).toHaveBeenCalledTimes(2);
    h.documentFrame(mapDocument("doc-a", 5), wireId(follower));
    expect(h.result.current.saving).toBe(false);
    expect(h.result.current.error).toBeNull();
    act(() => h.result.current.generate({ ...generation, seed: 99 }));
    expect(h.command(3)).toMatchObject({
      t: "map-studio-generate",
      documentId: "doc-a",
      commandId: "wire-3",
      seed: 99,
    });
    h.documentFrame(mapDocument("doc-a", 6), wireId(h.command(3)));
    expect(h.commands()).toHaveLength(4);
    expect(h.mint).toHaveBeenCalledTimes(3);
    expect(h.result.current.saving).toBe(false);
    expect(h.effectLifecycle.setup).toHaveBeenCalledTimes(2);
    expect(h.effectLifecycle.cleanup).toHaveBeenCalledTimes(1);
  });

  it("U3a: unmount makes retained reply callbacks inert immediately", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    const receiveAfterUnmount = h.result.current.handleServerMessage;
    const first = wireId(h.command());
    h.unmount();
    expect(h.commands()).toHaveLength(1);
    act(() =>
      receiveAfterUnmount({
        t: "map-studio-document",
        document: mapDocument("doc-a", 4),
        appliedCommandId: first,
      }),
    );
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
  });
});
