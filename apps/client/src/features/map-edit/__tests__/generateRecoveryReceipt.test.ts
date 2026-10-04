import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage } from "@herobyte/shared";
import { useMapStudio } from "../../map-studio/useMapStudio";
import { useGenerate } from "../useGenerate";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function uncertain() {
  const send = vi.fn<(message: ClientMessage) => void>();
  const hook = renderHook(() => {
    const controller = useMapStudio(send);
    return { controller, generate: useGenerate(controller, true, "generate", true) };
  });
  const document = createMapDocument({
    id: "map",
    name: "Map",
    width: 2000,
    height: 2000,
    timestamp: 1,
  });
  act(() =>
    hook.result.current.controller.handleServerMessage({ t: "map-studio-document", document }),
  );
  act(() =>
    hook.result.current.generate.onRegionDragged({ x: 0, y: 0, width: 1200, height: 1200 }),
  );
  act(() => hook.result.current.generate.onGenerate());
  const request = send.mock.calls.map(([m]) => m).find((m) => m.t === "map-studio-generate");
  if (request?.t !== "map-studio-generate") throw new Error("Generate did not dispatch");
  await act(async () =>
    hook.result.current.controller.handleServerMessage({
      t: "map-studio-error",
      documentId: document.id,
      commandId: request.commandId,
      code: "command-rejected",
      reason: "Completion unavailable",
    }),
  );
  expect(hook.result.current.generate.feedback.recovery).not.toBeNull();
  return { ...hook, send, document };
}

describe("Generate recovery requires a receipt", () => {
  it("does not accept a command broadcast as the requested refresh", async () => {
    const h = await uncertain();
    act(() => h.result.current.generate.feedback.recovery!.refresh());
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: { ...h.document, revision: 2 },
        appliedCommandId: "other-dm-edit",
      }),
    );
    expect(h.result.current.controller.activeDocument?.revision).toBe(2);
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(false);
    act(() => h.result.current.generate.feedback.recovery!.acknowledge());
    act(() => h.result.current.generate.onGenerate());
    expect(h.send.mock.calls.filter(([m]) => m.t === "map-studio-generate")).toHaveLength(1);
  });

  it("does not accept an earlier same-document GET with no applied-command ID", async () => {
    const h = await uncertain();
    act(() => h.result.current.controller.openDocument(h.document.id));
    act(() => vi.advanceTimersByTime(12_000));
    act(() => h.result.current.generate.feedback.recovery!.refresh());
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: { ...h.document },
      }),
    );
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(false);
  });

  it("does not unlock on the loading watchdog or a later uncorrelated document", async () => {
    const h = await uncertain();
    act(() => h.result.current.generate.feedback.recovery!.refresh());
    act(() => vi.advanceTimersByTime(12_000));
    expect(h.result.current.controller.loading).toBe(false);
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(false);
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: { ...h.document, revision: 3 },
      }),
    );
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(false);
    expect(h.result.current.generate.canGenerate).toBe(false);
  });
});
