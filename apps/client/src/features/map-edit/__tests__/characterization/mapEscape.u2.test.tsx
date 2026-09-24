import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { at } from "./mapLifecycle.fixtures";
import { dispatchMapEscape, renderMapComposition } from "./mapOwners.u2.fixtures";

afterEach(cleanup);

describe.each([false, true])("real map ownership; driverFirst=%s", (driverFirst) => {
  it.each(["terrain", "erase"] as const)(
    "%s Escape cancels live refs before residual move/release and retains tool/selection",
    (subTool) => {
      const { current, controller, sendMessage } = renderMapComposition(subTool, driverFirst);
      act(() => current().map.onMouseDown(at(100, 100)));
      act(() => current().map.onMouseMove(at(160, 160)));
      expect(current().map.strokeCells).toHaveLength(2);
      const held = current().map;
      let consumed = false;
      act(() => {
        consumed = dispatchMapEscape().defaultPrevented;
        held.onMouseMove(at(210, 210));
        held.onMouseMove(at(260, 260));
        held.onMouseUp();
      });
      expect(consumed).toBe(true);
      expect(controller.paintTerrain).not.toHaveBeenCalled();
      expect(current().map.strokeCells).toEqual([]);
      expect(current().tool.activeTool).toBe("map-edit");
      expect(current().selectedObjectId).toBe("token:owned");
      // A new stroke works without reselecting Map Edit; no old cells ride along.
      act(() => {
        current().map.onMouseDown(at(320, 320));
        current().map.onMouseUp();
      });
      expect(controller.paintTerrain).toHaveBeenCalledExactlyOnceWith([
        { x: 6, y: 6, assetId: subTool === "terrain" ? "terrain:grass" : null },
      ]);
      act(() => {
        expect(dispatchMapEscape().defaultPrevented).toBe(true);
      });
      expect(current().tool.activeTool).toBeNull();
      expect(current().selectedObjectId).toBe("token:owned");
      act(() => {
        expect(dispatchMapEscape().defaultPrevented).toBe(true);
      });
      expect(current().selectedObjectId).toBeNull();
      expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
      expect(sendMessage).not.toHaveBeenCalled();
    },
  );

  it.each(["wall", "room"] as const)(
    "%s uses the same cancel → Move → selection ladder with a live nonzero drag",
    (subTool) => {
      const { current, controller } = renderMapComposition(subTool, driverFirst);
      const commit = subTool === "wall" ? controller.addWall : controller.placeRoom;
      const held = current().map;
      // All in one act: cancellation cannot rely on rendered previewDrag.
      act(() => {
        held.onMouseDown(at(100, 100));
        held.onMouseMove(at(250, 200));
        expect(dispatchMapEscape().defaultPrevented).toBe(true);
        held.onMouseMove(at(350, 300));
        held.onMouseUp();
      });
      expect(commit).not.toHaveBeenCalled();
      expect(current().map.previewDrag).toBeNull();
      expect(current().tool.activeTool).toBe("map-edit");
      expect(current().selectedObjectId).toBe("token:owned");
      act(() => {
        current().map.onMouseDown(at(400, 400));
        current().map.onMouseMove(at(550, 500));
        current().map.onMouseUp();
      });
      expect(commit).toHaveBeenCalledTimes(1);
      act(() => {
        dispatchMapEscape();
      });
      expect(current().tool.activeTool).toBeNull();
      expect(current().selectedObjectId).toBe("token:owned");
      act(() => {
        dispatchMapEscape();
      });
      expect(current().selectedObjectId).toBeNull();
      expect(commit).toHaveBeenCalledTimes(1);
    },
  );
});
