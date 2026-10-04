import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import type {
  CommandDeliveryEvent,
  RegisterCommandDelivery,
} from "../../../services/websocket/serviceTypes";
import { useMapStudio } from "../useMapStudio";
import {
  generation,
  mapDocument,
  queueHarness,
  wireId,
} from "./characterization/mapQueue.fixtures";
import type { MapOperationHandle } from "../mapOperation";

afterEach(cleanup);

describe("map operation delivery certainty", () => {
  it("a positive refusal without continuous transport observation is still uncertain", async () => {
    const h = queueHarness();
    let handle!: MapOperationHandle;
    act(() => {
      handle = h.result.current.generate(generation);
    });
    h.refuse(wireId(h.command()), "doc-a", "command-not-applied");
    await expect(handle.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
  });

  it.each(["replace", "tracking-lost", "retry"] as const)(
    "%s prevents a fresh-refusal claim",
    async (mode) => {
      let deliver: (event: CommandDeliveryEvent) => void = () => {};
      const register: RegisterCommandDelivery = (handler) => {
        deliver = handler;
        return () => {};
      };
      const send = vi.fn((message: ClientMessage) => {
        deliver({ type: "send-attempt", message });
      });
      const h = renderHook(({ observer }) => useMapStudio(send, undefined, true, observer), {
        initialProps: { observer: register },
      });
      const doc = mapDocument();
      act(() => h.result.current.handleServerMessage({ t: "map-studio-document", document: doc }));
      let handle!: MapOperationHandle;
      act(() => {
        handle = h.result.current.generate(generation);
      });
      const message = send.mock.calls.map(([m]) => m).find((m) => m.t === "map-studio-generate");
      if (message?.t !== "map-studio-generate") throw new Error("No generated request");
      if (mode === "replace") h.rerender({ observer: (handler) => register(handler) });
      if (mode === "tracking-lost") act(() => deliver({ type: "tracking-lost" }));
      if (mode === "retry") act(() => deliver({ type: "send-attempt", message }));
      act(() =>
        h.result.current.handleServerMessage({
          t: "map-studio-error",
          documentId: doc.id,
          commandId: message.commandId,
          code: "command-not-applied",
          reason: "Locked",
        }),
      );
      await expect(handle.completion).resolves.toMatchObject({
        status: "failed",
        kind: "completion-unavailable",
      });
    },
  );

  it("copies a queued payload before the caller changes its inputs", () => {
    const h = queueHarness();
    act(() => h.result.current.generate(generation));
    const input = structuredClone(generation);
    act(() => h.result.current.generate(input));
    input.seed = 901;
    input.bounds.cols = 41;
    input.params.theme = "wood";
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    expect(h.command(1)).toMatchObject({
      seed: 42,
      bounds: generation.bounds,
      params: generation.params,
    });
  });

  it("a sender exception settles as uncertain, releases the queue, and cannot later succeed", async () => {
    const h = queueHarness();
    h.send.mockImplementationOnce(() => {
      throw new Error("Write status unknown");
    });
    let handle!: MapOperationHandle;
    act(() => {
      handle = h.result.current.generate(generation);
    });
    await expect(handle.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
    expect(h.result.current.saving).toBe(false);
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await expect(handle.completion).resolves.toMatchObject({ status: "failed" });
  });

  it("a late success cannot resurrect a deleted document", async () => {
    const h = queueHarness();
    let handle!: MapOperationHandle;
    act(() => {
      handle = h.result.current.generate(generation);
    });
    const id = wireId(h.command());
    h.receive({ t: "map-studio-deleted", documentId: "doc-a" });
    h.documentFrame(mapDocument("doc-a", 4), id);
    expect(h.result.current.activeDocument).toBeNull();
    await expect(handle.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
  });
});
