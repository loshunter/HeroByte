import { describe, expect, it, vi } from "vitest";
import { generation, outcomeHarness } from "./generateOutcome.fixtures.js";

describe("Generate outcome category before U3a", () => {
  it("a post-apply broadcast failure has a generic code despite stored effects", () => {
    const h = outcomeHarness();
    expect(h.document().revision).toBe(0);
    h.broadcast.mockImplementationOnce(() => {
      throw new Error("Injected broadcast failure");
    });
    h.generate();
    expect(h.document().revision).toBe(1);
    expect(h.document().elements.length).toBeGreaterThan(0);
    expect(h.errors()).toEqual([
      {
        t: "map-studio-error",
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: "Injected broadcast failure",
        actualRevision: undefined,
      },
    ]);
    const applied = structuredClone(h.document());
    h.clearFrames();
    h.generate();
    expect(h.errors()).toEqual([]);
    expect(h.document()).toEqual(applied);
    expect(h.broadcast).toHaveBeenCalledWith(
      "outcome-room",
      expect.objectContaining({
        t: "map-studio-document",
        appliedCommandId: generation.commandId,
      }),
    );
  });

  it("a failed cached-result broadcast also has a generic code despite prior effects", () => {
    const h = outcomeHarness();
    h.generate();
    const applied = structuredClone(h.document());
    h.clearFrames();
    h.broadcast.mockImplementationOnce(() => {
      throw new Error("Injected replay broadcast failure");
    });
    h.generate();
    expect(h.document()).toEqual(applied);
    expect(h.errors()).toEqual([
      expect.objectContaining({
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: "Injected replay broadcast failure",
      }),
    ]);
  });

  it("U3a: a duplicate after cache loss reports prior effects without claiming the complete result exists", () => {
    const h = outcomeHarness();
    h.generate();
    const first = h.document().elements[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("Positive generated-element prerequisite failed");
    h.service.apply(
      "outcome-room",
      {
        type: "remove-element",
        commandId: "remove-one",
        documentId: generation.documentId,
        baseRevision: h.document().revision,
        elementId: first.id,
      },
      101,
    );
    const remaining = structuredClone(h.document());
    expect(remaining.elements.length).toBeGreaterThan(0);
    expect(remaining.elements.some((element) => element.id === first.id)).toBe(false);
    // Simulate the existing bounded cache's miss; retain the real stored document,
    // deterministic recipe, duplicate validator and central error serializer.
    vi.spyOn(h.service, "cachedResult").mockReturnValue(undefined);
    h.clearFrames();
    h.generate();
    expect(h.document()).toEqual(remaining);
    expect(h.broadcast).not.toHaveBeenCalled();
    expect(h.errors()).toEqual([
      expect.objectContaining({
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: expect.stringMatching(/already affected.*complete result.*cannot be confirmed/),
      }),
    ]);
  });
});
