// Intended ws/handlers/__tests__/characterization/generateRecompile.desired.test.ts.
import { describe, expect, it, vi } from "vitest";
import type { MapDocument } from "@herobyte/shared";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { MapStudioMessageHandler } from "../MapStudioMessageHandler.js";
import type { MapStudioGenerateDeps, MapStudioGenerateMessage } from "../mapStudioGenerate.js";
import { generation, outcomeHarness } from "./characterization/generateOutcome.fixtures.js";

const fault = vi.hoisted(() => ({
  observeRecompile: vi.fn<MapStudioGenerateDeps["recompileLiveScene"]>(),
}));

// Keep the actual Generate handler, service and central error serializer. Replace
// only its existing recompile dependency, at the point where it would be invoked.
vi.mock("../mapStudioGenerate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../mapStudioGenerate.js")>();
  return {
    ...actual,
    handleMapStudioGenerate: (
      deps: MapStudioGenerateDeps,
      senderUid: string,
      roomId: string,
      message: MapStudioGenerateMessage,
    ) =>
      actual.handleMapStudioGenerate(
        {
          ...deps,
          recompileLiveScene: (...args) => {
            fault.observeRecompile(...args);
            throw new Error("Injected live recompile failure");
          },
        },
        senderUid,
        roomId,
        message,
      ),
  };
});

describe("Generate's post-apply live recompile boundary", () => {
  it("keeps a recompile exception ambiguous after the real store already changed", () => {
    const h = outcomeHarness();
    const room = createEmptyRoomState();
    room.liveMapDocumentId = generation.documentId;
    const handler = new MapStudioMessageHandler(
      h.service,
      h.send,
      h.broadcast,
      () => room,
      () => 100,
    );
    const apply = vi.spyOn(h.service, "apply");
    const before = structuredClone(h.document());
    const observations: {
      roomId: string;
      previous: MapDocument | undefined;
      next: MapDocument;
      stored: MapDocument;
    }[] = [];
    fault.observeRecompile.mockReset();
    fault.observeRecompile.mockImplementation((roomId, previous, next) => {
      // Assert outside the caught callback so a failed expectation cannot become
      // the injected command error and accidentally disguise a setup failure.
      observations.push({
        roomId,
        previous: structuredClone(previous),
        next: structuredClone(next),
        stored: structuredClone(h.document()),
      });
    });
    expect(before.revision).toBe(0);
    expect(before.elements).toEqual([]);

    const result = handler.handle(generation, "outcome-dm", "outcome-room", true);

    expect(result).toEqual({ broadcast: false, save: false });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(observations).toHaveLength(1);
    const observed = observations[0];
    if (!observed) throw new Error("The real live Generate path did not reach recompile");
    expect(observed.roomId).toBe("outcome-room");
    expect(observed.previous).toEqual(before);
    expect(observed.stored.revision).toBe(before.revision + 1);
    expect(observed.stored.elements.length).toBeGreaterThan(0);
    expect(observed.next).toEqual(observed.stored);
    expect(h.document()).toEqual(observed.stored);
    expect(h.broadcast).not.toHaveBeenCalled();
    expect(h.errors()).toEqual([
      {
        t: "map-studio-error",
        commandId: generation.commandId,
        documentId: generation.documentId,
        code: "command-rejected",
        reason: "Injected live recompile failure",
        actualRevision: undefined,
      },
    ]);

    // Losing the first error must not let a cache replay claim scene completion.
    const applied = structuredClone(h.document());
    h.clearFrames();
    handler.handle(generation, "outcome-dm", "outcome-room", true);
    expect(h.errors()).toEqual([
      expect.objectContaining({
        code: "command-rejected",
        reason: expect.stringMatching(/completion.*cannot be confirmed/),
      }),
    ]);
    expect(h.document()).toEqual(applied);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(fault.observeRecompile).toHaveBeenCalledTimes(1);
    expect(h.broadcast).not.toHaveBeenCalled();
  });
});
