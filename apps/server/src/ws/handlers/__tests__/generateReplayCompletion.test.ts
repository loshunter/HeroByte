import { describe, expect, it } from "vitest";
import { generation, outcomeHarness } from "./characterization/generateOutcome.fixtures.js";

describe("confirmed Generate replay completes every required readout", () => {
  it("repeats the campaign weight when the first application reply was lost", () => {
    const h = outcomeHarness();
    h.generate();
    const first = h.broadcast.mock.calls[0]?.[1];
    if (!first || !("t" in first) || first.t !== "map-studio-document")
      throw new Error("No original document frame");
    expect(first.exportBytes).toBeGreaterThan(0);
    h.clearFrames();
    h.generate();
    expect(h.broadcast).toHaveBeenCalledWith(
      "outcome-room",
      expect.objectContaining({
        t: "map-studio-document",
        appliedCommandId: generation.commandId,
        exportBytes: first.exportBytes,
      }),
    );
    expect(h.document().revision).toBe(1);
  });

  it("a confirmed live replay also republishes the player scene without applying twice", () => {
    const h = outcomeHarness();
    h.room.liveMapDocumentId = generation.documentId;
    expect(h.generate()).toEqual({ broadcast: true, save: true });
    const scene = structuredClone(h.room.compiledScene);
    expect(scene?.sourceRevision).toBe(1);
    h.clearFrames();
    expect(h.generate()).toEqual({ broadcast: true, save: true });
    expect(h.room.compiledScene).toEqual(scene);
    expect(h.document().revision).toBe(1);
  });
});
