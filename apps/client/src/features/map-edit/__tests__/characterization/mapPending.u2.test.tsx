import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { escapeRegistry } from "../../../interaction/useEscapeOwner";
import { at } from "./mapLifecycle.fixtures";
import { dispatchMapEscape, renderMapComposition } from "./mapOwners.u2.fixtures";

afterEach(cleanup);

describe("map pending gesture controls and touch lifetime", () => {
  it.each(["terrain", "erase", "wall", "place"] as const)(
    "%s publishes pending state synchronously and Cancel clears it without exiting mode",
    (subTool) => {
      const { current, controller } = renderMapComposition(subTool);
      const input = subTool === "place" ? "touch" : "mouse";
      const label =
        subTool === "terrain" || subTool === "erase" ? "Cancel stroke" : "Cancel placement";
      const held = current().map;
      act(() => {
        held.onMouseDown(at(100, 100), input);
        // Check before React can commit the preview: a layout-effect-only refresh fails.
        expect(escapeRegistry.getPendingLabel()).toBe(label);
        expect(escapeRegistry.cancelPending()).toBe(true);
        expect(escapeRegistry.getPendingLabel()).toBeNull();
        held.onMouseMove(at(250, 200), input);
        held.onMouseUp(input);
        expect(escapeRegistry.cancelPending()).toBe(false);
      });
      expect(current().tool.activeTool).toBe("map-edit");
      expect(current().selectedObjectId).toBe("token:owned");
      expect(current().map.strokeCells).toEqual([]);
      expect(current().map.previewDrag).toBeNull();
      expect(current().map.placementGhost).toBeNull();
      expect(controller.paintTerrain).not.toHaveBeenCalled();
      expect(controller.addWall).not.toHaveBeenCalled();
      expect(controller.addTile).not.toHaveBeenCalled();
    },
  );

  it.each(["onCancel", "escape"] as const)(
    "%s touch cancellation survives residual movement in the same turn, then a fresh touch works",
    (path) => {
      const { current, controller } = renderMapComposition("place");
      act(() => current().map.onMouseDown(at(100, 100), "touch"));
      expect(current().map.placementGhost).not.toBeNull();
      const held = current().map;
      act(() => {
        if (path === "onCancel") held.onCancel();
        else expect(dispatchMapEscape().defaultPrevented).toBe(true);
        held.onMouseMove(at(300, 300), "touch");
        held.onMouseUp("touch");
      });
      expect(current().tool.activeTool).toBe("map-edit");
      expect(current().selectedObjectId).toBe("token:owned");
      expect(current().map.placementGhost).toBeNull();
      expect(controller.addTile).not.toHaveBeenCalled();
      act(() => {
        current().map.onMouseDown(at(400, 400), "touch");
        current().map.onMouseMove(at(500, 500), "touch");
        current().map.onMouseUp("touch");
        current().map.onMouseUp("touch");
      });
      expect(controller.addTile).toHaveBeenCalledTimes(1);
    },
  );

  it("desktop point press commits once and advertises no retractable gesture", () => {
    const { current, controller } = renderMapComposition("place");
    act(() => {
      current().map.onMouseDown(at(100, 100));
      expect(controller.addTile).toHaveBeenCalledTimes(1);
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      expect(escapeRegistry.cancelPending()).toBe(false);
    });
    expect(current().tool.activeTool).toBe("map-edit");
    act(() => {
      dispatchMapEscape();
    });
    expect(current().tool.activeTool).toBeNull();
    expect(current().selectedObjectId).toBe("token:owned");
    act(() => {
      current().map.onMouseUp();
      current().map.onMouseUp();
    });
    expect(controller.addTile).toHaveBeenCalledTimes(1);
    expect(controller.addStamp).not.toHaveBeenCalled();
  });
});
