// Intended sibling of generateOutcome.characterization.test.ts.
import { describe, expect, it, vi } from "vitest";
import { generation, outcomeHarness } from "./characterization/generateOutcome.fixtures.js";

describe("Generate's positive not-applied classification", () => {
  it("a fresh locked-layer refusal is correlated, unchanged, and explicitly not applied", () => {
    const h = outcomeHarness();
    const walls = h.document().layers.find((layer) => layer.kind === "walls");
    if (!walls) throw new Error("Fixture requires the real default walls layer");
    h.service.apply(
      "outcome-room",
      {
        type: "update-layer",
        documentId: generation.documentId,
        commandId: "lock-walls",
        baseRevision: h.document().revision,
        layerId: walls.id,
        update: { locked: true },
      },
      90,
    );
    const before = structuredClone(h.document());
    h.clearFrames();
    h.generate();
    expect(h.document()).toEqual(before);
    expect(h.broadcast).not.toHaveBeenCalled();
    expect(h.errors()).toEqual([
      expect.objectContaining({
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-not-applied",
        reason: 'Generate needs an unlocked "walls" layer, but every walls layer is locked',
      }),
    ]);
  });

  it("an exception inside service.apply after its store mutation stays ambiguous", () => {
    const h = outcomeHarness();
    const apply = h.service.apply.bind(h.service);
    vi.spyOn(h.service, "apply").mockImplementationOnce((...args) => {
      apply(...args);
      throw new Error("Injected error after the service wrote the command");
    });
    h.generate();
    expect(h.document().revision).toBe(1);
    expect(h.document().elements.length).toBeGreaterThan(0);
    expect(h.broadcast).not.toHaveBeenCalled();
    expect(h.errors()).toEqual([
      expect.objectContaining({
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: "Injected error after the service wrote the command",
      }),
    ]);
    const applied = structuredClone(h.document());
    h.clearFrames();
    h.generate();
    expect(h.errors()).toEqual([
      expect.objectContaining({
        code: "command-rejected",
        reason: expect.stringMatching(/completion.*cannot be confirmed/),
      }),
    ]);
    expect(h.document()).toEqual(applied);
    expect(h.broadcast).not.toHaveBeenCalled();
  });

  it("a cache lookup exception cannot be certified as a fresh refusal", () => {
    const h = outcomeHarness();
    h.generate();
    const applied = structuredClone(h.document());
    h.clearFrames();
    vi.spyOn(h.service, "cachedResult").mockImplementationOnce(() => {
      throw new Error("Injected cache lookup failure");
    });
    h.generate();
    expect(h.document()).toEqual(applied);
    expect(h.errors()).toEqual([
      expect.objectContaining({
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: "Injected cache lookup failure",
      }),
    ]);
    expect(h.broadcast).not.toHaveBeenCalled();
  });
});
