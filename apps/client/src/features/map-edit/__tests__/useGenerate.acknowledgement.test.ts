// Destination: features/map-edit/__tests__/useGenerate.acknowledgement.test.ts.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage, type MapDocument } from "@herobyte/shared";
import { useMapStudio } from "../../map-studio/useMapStudio";
import { useGenerate } from "../useGenerate";

afterEach(cleanup);
const params = { theme: "stone" as const, density: "medium" as const, seed: 42 };
const region = { x: 0, y: 0, width: 1200, height: 1000 };
const document = (id = "map-a", revision = 1): MapDocument => ({
  ...createMapDocument({ id, name: id, width: 2000, height: 2000, timestamp: 1 }),
  revision,
});

function harness() {
  const send = vi.fn<(message: ClientMessage) => void>();
  const hook = renderHook(() => {
    const controller = useMapStudio(send);
    const generate = useGenerate(controller, true, "generate", true);
    return { controller, generate };
  });
  const receive = (doc: MapDocument, appliedCommandId?: string) =>
    act(() =>
      hook.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: doc,
        appliedCommandId,
      }),
    );
  const aim = () =>
    act(() => {
      hook.result.current.generate.setParams(params);
      hook.result.current.generate.onRegionDragged(region);
    });
  receive(document());
  aim();
  const commands = () =>
    send.mock.calls
      .map(([message]) => message)
      .filter(
        (message): message is Extract<ClientMessage, { t: "map-studio-generate" }> =>
          message.t === "map-studio-generate",
      );
  return { ...hook, send, receive, aim, commands };
}

async function microtasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Generate acknowledgement boundaries through the real controller", () => {
  it("does not claim Built while pending or after an unrelated acknowledgement", async () => {
    const h = harness();
    act(() => h.result.current.generate.onGenerate());
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.generate.canGenerate).toBe(false);
    expect(h.result.current.generate.hint ?? "").not.toMatch(/built here already/i);
    h.receive(document("map-a", 2), "some-other-command");
    await microtasks();
    expect(h.result.current.generate.canGenerate).toBe(false);
    expect(h.result.current.generate.hint ?? "").not.toMatch(/built here already/i);
    h.receive(document("map-a", 3), h.commands()[0]!.commandId);
    await microtasks();
    expect(h.result.current.generate.hint).toMatch(/built here already/i);
  });

  it("two activations before a render create exactly one operation, including after drain", async () => {
    const h = harness();
    const activate = h.result.current.generate.onGenerate;
    act(() => {
      activate();
      activate();
    });
    expect(h.commands()).toHaveLength(1);
    h.receive(document("map-a", 2), h.commands()[0]!.commandId);
    await microtasks();
    expect(h.commands()).toHaveLength(1);
    expect(h.result.current.controller.saving).toBe(false);
  });

  it("the same recipe and region can be built on a different document", async () => {
    const h = harness();
    act(() => h.result.current.generate.onGenerate());
    h.receive(document("map-a", 2), h.commands()[0]!.commandId);
    await microtasks();
    expect(h.result.current.generate.hint).toMatch(/built here already/i);
    act(() => h.result.current.controller.openDocument("map-b"));
    h.receive(document("map-b", 20));
    h.aim();
    expect(h.result.current.generate.canGenerate).toBe(true);
    act(() => h.result.current.generate.onGenerate());
    expect(h.commands()).toHaveLength(2);
    expect(h.commands()[1]!.documentId).toBe("map-b");
  });

  it("late A acknowledgement does not label B's freshly selected region as built", async () => {
    const h = harness();
    act(() => h.result.current.generate.onGenerate());
    const first = h.commands()[0]!;
    act(() => h.result.current.controller.openDocument("map-b"));
    h.receive(document("map-b", 20));
    h.aim();
    h.receive(document("map-a", 2), first.commandId);
    await microtasks();
    expect(h.result.current.controller.activeDocument?.id).toBe("map-b");
    expect(h.result.current.generate.hint ?? "").not.toMatch(/built here already/i);
    expect(h.result.current.generate.canGenerate).toBe(true);
  });

  it("refuses an otherwise large-enough region crossing the actual document edge locally", () => {
    const h = harness();
    act(() =>
      h.result.current.generate.onRegionDragged({ x: 500, y: 0, width: 1700, height: 1200 }),
    );
    expect(h.result.current.generate.canGenerate).toBe(false);
    expect(h.result.current.generate.hint).toMatch(/inside|outside/i);
    act(() => h.result.current.generate.onGenerate());
    expect(h.commands()).toEqual([]);
  });
});
