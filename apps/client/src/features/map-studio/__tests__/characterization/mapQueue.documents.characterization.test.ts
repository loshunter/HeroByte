import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { generation, mapDocument, queueHarness, wireId } from "./mapQueue.fixtures";

describe("map queue document identity (baseline pinned before U3a; intentional repairs below)", () => {
  it("switching to B keeps sent A in flight; a late matching A reply releases it without activating A", () => {
    const h = queueHarness();
    act(() => h.result.current.generate(generation));
    const sent = h.command();
    h.open(mapDocument("doc-b", 20));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.result.current.saving).toBe(true);
    expect(h.commands()).toEqual([sent]);
    h.documentFrame(mapDocument("doc-a", 4), wireId(sent));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.result.current.saving).toBe(false);
    expect(h.commands()).toEqual([sent]);
  });

  it("U3a: late A acknowledgement releases waiting B entries without dropping or retargeting them", () => {
    const h = queueHarness();
    act(() => h.result.current.generate(generation));
    h.open(mapDocument("doc-b", 20));
    act(() => {
      h.result.current.generate({ ...generation, seed: 81 });
      h.result.current.updateGrid({ size: 60 });
    });
    expect(h.mint).toHaveBeenCalledTimes(1);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.result.current.saving).toBe(true);
    expect(h.command(1)).toMatchObject({
      t: "map-studio-generate",
      documentId: "doc-b",
      commandId: "wire-2",
      seed: 81,
    });
    h.connection(false);
    h.connection(true);
    expect(h.command(2)).toBe(h.command(1));
    expect(h.mint).toHaveBeenCalledTimes(2);
    h.documentFrame(mapDocument("doc-b", 21), wireId(h.command(1)));
    expect(h.command(3)).toMatchObject({
      t: "map-studio-command",
      command: { commandId: "wire-3", documentId: "doc-b", baseRevision: 21, type: "update-grid" },
    });
    h.documentFrame(mapDocument("doc-b", 22), wireId(h.command(3)));
    expect(h.result.current.saving).toBe(false);
    expect(h.commands()).toHaveLength(4);
  });

  it("U3a: an unsent A successor is cancelled when B activates", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    h.open(mapDocument("doc-b", 20));
    h.documentFrame(mapDocument("doc-a", 8), wireId(h.command()));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
    expect(h.result.current.saving).toBe(false);
  });

  it.each(["doc-a", "doc-b"])(
    "late A refusal only continues an unsent %s entry if it still targets B",
    (queuedDocument) => {
      const h = queueHarness();
      act(() => h.result.current.generate(generation));
      if (queuedDocument === "doc-a") act(() => h.result.current.updateGrid({ size: 60 }));
      h.open(mapDocument("doc-b", 20));
      if (queuedDocument === "doc-b") act(() => h.result.current.updateGrid({ size: 60 }));
      h.refuse(wireId(h.command()));
      expect(h.result.current.activeDocument?.id).toBe("doc-b");
      expect(h.commands()).toHaveLength(queuedDocument === "doc-b" ? 2 : 1);
      expect(h.result.current.saving).toBe(queuedDocument === "doc-b");
      if (queuedDocument === "doc-b") {
        expect(h.command(1)).toMatchObject({
          t: "map-studio-command",
          command: { documentId: "doc-b", baseRevision: 20 },
        });
      } else {
        // A's failed result belongs to A and must not pollute B's current error.
        expect(h.result.current.error).toBeNull();
        expect(h.mint).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("U3a: an unrelated document frame preserves the queue awaiting conflict refresh", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.updateGrid({ size: 60 });
      h.result.current.generate(generation);
    });
    h.refuse(wireId(h.command()), "doc-a", "revision-conflict");
    h.documentFrame(mapDocument("doc-b", 20));
    expect(h.result.current.activeDocument?.id).toBe("doc-a");
    expect(h.result.current.saving).toBe(true);
    h.documentFrame(mapDocument("doc-a", 8));
    expect(h.commands()).toHaveLength(2);
    expect(h.mint).toHaveBeenCalledTimes(2);
    expect(h.command(1)).toMatchObject({ t: "map-studio-generate", documentId: "doc-a" });
  });
});
