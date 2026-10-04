import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage } from "@herobyte/shared";
import { useMapStudio } from "../../../map-studio/useMapStudio";
import { useMapEditState } from "../../useMapEditState";

afterEach(cleanup);

function setup() {
  const send = vi.fn<(message: ClientMessage) => void>();
  const setActiveTool = vi.fn();
  const hook = renderHook(
    ({ mapEditMode }) => {
      const controller = useMapStudio(send);
      const state = useMapEditState({
        controller,
        sendMessage: send,
        mapEditMode,
        setActiveTool,
        isDM: true,
        snapshotLoaded: true,
        liveMapDocumentId: "composition-map",
        sceneSourceDocumentId: undefined,
        roomGridSize: 50,
        hasRasterBackground: false,
      });
      return { controller, state };
    },
    { initialProps: { mapEditMode: true } },
  );
  const document = createMapDocument({
    id: "composition-map",
    name: "Composition",
    width: 2000,
    height: 2000,
    timestamp: 1,
  });
  act(() =>
    hook.result.current.controller.handleServerMessage({ t: "map-studio-document", document }),
  );
  return { ...hook, send, setActiveTool, document };
}

describe("map-edit composition before interface extraction", () => {
  it("forwards the same controller's history and authoring callbacks", () => {
    const h = setup();
    const { controller, state } = h.result.current;
    expect(state.toolbarProps.onUndo).toBe(controller.undo);
    expect(state.toolbarProps.onRedo).toBe(controller.redo);
    expect(state.toolbarProps.onUpdateLayer).toBe(controller.updateLayer);
    expect(state.toolbarProps.onMoveLayer).toBe(controller.moveLayer);
    expect(state.toolbarProps.onUpdateElement).toBe(controller.updateElement);
    expect(state.toolbarProps.onUpdateDoor).toBe(controller.updateDoor);
    expect(state.toolbarProps.onRemoveElement).toBe(controller.removeElement);
    expect(state.toolbarProps.uploadAsset).toBe(controller.uploadAsset);
    expect(state.toolbarProps.layers).toBe(controller.activeDocument?.layers);
    expect(state.toolbarProps.isLive).toBe(true);
  });

  it("maps Generate dials/region into the original controller and preserves the current busy mapping", () => {
    const h = setup();
    act(() => h.result.current.state.toolbarProps.onSelectSubTool("generate"));
    const params = { seed: 42, theme: "stone" as const, density: "medium" as const };
    act(() => {
      h.result.current.state.toolbarProps.onGenerateParamsChange(params);
      h.result.current.state.onRegionDragged({ x: 0, y: 0, width: 1200, height: 1000 });
    });
    expect(h.result.current.state.toolbarProps.generateRegion).toEqual({ cols: 24, rows: 20 });
    expect(h.result.current.state.toolbarProps.generateParams).toEqual(params);
    expect(h.result.current.state.toolbarProps.canGenerate).toBe(true);
    act(() => h.result.current.state.toolbarProps.onGenerate());
    expect(
      h.send.mock.calls
        .map(([message]) => message)
        .filter((message) => message.t === "map-studio-generate"),
    ).toEqual([
      expect.objectContaining({
        documentId: h.document.id,
        seed: 42,
        bounds: { x: 0, y: 0, cols: 24, rows: 20 },
      }),
    ]);
    expect(h.result.current.controller.saving).toBe(true);
    expect(h.result.current.state.toolbarProps.saving).toBe(true);
    expect(h.result.current.state.toolbarProps.canGenerate).toBe(false);
    h.rerender({ mapEditMode: false });
    expect(h.result.current.state.toolbarProps.generateRegion).toBeNull();
  });

  it("keeps wheel choices and the close action on the shared state", () => {
    const h = setup();
    const wheel = h.result.current.state.wheelActions;
    act(() => {
      wheel.selectSubTool("terrain");
      wheel.selectFloorFamily("grass");
    });
    expect(h.result.current.state.activeSubTool).toBe("terrain");
    expect(h.result.current.state.toolbarProps.activeSubTool).toBe("terrain");
    expect(h.result.current.state.toolbarProps.floorFamily).toBe("grass");
    expect(h.result.current.state.wheelActions).toBe(wheel);
    act(() => h.result.current.state.toolbarProps.onClose());
    expect(h.setActiveTool).toHaveBeenCalledExactlyOnceWith(null);
  });
});
