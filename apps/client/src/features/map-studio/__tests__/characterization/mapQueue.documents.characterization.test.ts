import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { generation, mapDocument, queueHarness, wireId } from "./mapQueue.fixtures";

describe("map queue document identity before U3a outcomes", () => {
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

  it("BASELINE BUG: late A acknowledgement drops all unsent B entries before they receive IDs", () => {
    const h = queueHarness();
    act(() => h.result.current.generate(generation));
    h.open(mapDocument("doc-b", 20));
    act(() => {
      h.result.current.generate({ ...generation, seed: 81 });
      h.result.current.updateGrid({ size: 60 });
    });
    expect(h.mint).toHaveBeenCalledTimes(1);
    expect(h.result.current.saving).toBe(true);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.result.current.saving).toBe(false);
    expect(h.mint).toHaveBeenCalledTimes(1);
    expect(h.commands()).toHaveLength(1);
    h.connection(false);
    h.connection(true);
    expect(h.commands()).toHaveLength(1);
    act(() => h.result.current.updateLayer("terrain", { opacity: 0.25 }));
    expect(h.command(1)).toMatchObject({
      t: "map-studio-command",
      command: { commandId: "wire-2", documentId: "doc-b", baseRevision: 20, type: "update-layer" },
    });
  });

  it("BASELINE RULE: an A successor continues against late A's revision even while B stays active", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.generate(generation);
      h.result.current.updateGrid({ size: 60 });
    });
    h.open(mapDocument("doc-b", 20));
    h.documentFrame(mapDocument("doc-a", 8), wireId(h.command()));
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.command(1)).toMatchObject({
      t: "map-studio-command",
      command: { documentId: "doc-a", baseRevision: 8 },
    });
    expect(h.result.current.saving).toBe(true);
  });

  it.each(["doc-a", "doc-b"])(
    "late A refusal dispatches using active B, dropping an unsent %s head only on mismatch",
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
        // BASELINE BUG: no handle exists to tell the dropped A caller what happened.
        expect(h.result.current.error).toBe("Rejected by server");
        expect(h.mint).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("BASELINE BUG: an unrelated document frame drops the queue while a conflict reload is pending", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.updateGrid({ size: 60 });
      h.result.current.generate(generation);
    });
    h.refuse(wireId(h.command()), "doc-a", "revision-conflict");
    h.documentFrame(mapDocument("doc-b", 20));
    expect(h.result.current.activeDocument?.id).toBe("doc-a");
    expect(h.result.current.saving).toBe(false);
    h.documentFrame(mapDocument("doc-a", 8));
    expect(h.commands()).toHaveLength(1);
    expect(h.mint).toHaveBeenCalledTimes(1);
  });
});
