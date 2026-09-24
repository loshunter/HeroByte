import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage } from "@herobyte/shared";
import { useMapStudio } from "../../map-studio/useMapStudio";
import { useGenerate } from "../useGenerate";

afterEach(cleanup);
function setup() {
  const send = vi.fn<(message: ClientMessage) => void>();
  const hook = renderHook(
    ({ enabled }) => {
      const controller = useMapStudio(send);
      return { controller, generate: useGenerate(controller, true, "generate", enabled) };
    },
    { initialProps: { enabled: true } },
  );
  const receive = (id: string) =>
    act(() =>
      hook.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document: createMapDocument({ id, name: id, width: 3000, height: 3000, timestamp: 1 }),
      }),
    );
  receive("A");
  act(() =>
    hook.result.current.generate.onRegionDragged({ x: 0, y: 0, width: 1200, height: 1200 }),
  );
  const generations = () =>
    send.mock.calls
      .map(([message]) => message)
      .filter((message) => message.t === "map-studio-generate");
  return { ...hook, receive, generations };
}

describe("Generate retained callbacks cannot submit a stale target", () => {
  it("refuses A's activation after B becomes active, even after B has a valid aim", () => {
    const h = setup();
    const oldActivate = h.result.current.generate.onGenerate;
    act(() => h.result.current.controller.openDocument("B"));
    h.receive("B");
    act(() =>
      h.result.current.generate.onRegionDragged({ x: 100, y: 100, width: 1200, height: 1200 }),
    );
    expect(h.result.current.generate.canGenerate).toBe(true);
    act(oldActivate);
    expect(h.generations()).toEqual([]);
    act(() => h.result.current.generate.onGenerate());
    expect(h.generations()).toEqual([
      expect.objectContaining({ documentId: "B", bounds: { x: 2, y: 2, cols: 24, rows: 24 } }),
    ]);
  });

  it("refuses a retained activation after leaving Generate and clears its preview", () => {
    const h = setup();
    const oldActivate = h.result.current.generate.onGenerate;
    h.rerender({ enabled: false });
    act(oldActivate);
    expect(h.generations()).toEqual([]);
    expect(h.result.current.generate.preview).toBeNull();
    h.rerender({ enabled: true });
    expect(h.result.current.generate.region).toBeNull();
  });

  it("refuses the old seed after changing dials while allowing the current recipe", () => {
    const h = setup();
    const oldActivate = h.result.current.generate.onGenerate;
    act(() => h.result.current.generate.setParams({ seed: 73, theme: "wood", density: "low" }));
    act(oldActivate);
    expect(h.generations()).toEqual([]);
    act(() => h.result.current.generate.onGenerate());
    expect(h.generations()).toEqual([
      expect.objectContaining({ seed: 73, params: { theme: "wood", density: "low" } }),
    ]);
  });
});
