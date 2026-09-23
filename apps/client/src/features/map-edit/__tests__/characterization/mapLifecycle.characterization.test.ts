// U2 baseline at 44c6ab82, executed before the cancellation extraction.
// Assertions named BASELINE BUG are temporary pre-extraction pins. Replace
// them with the specified U2 contract in the repair commit, never skip them.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup } from "@testing-library/react";
import { at, escapeFromBody, renderMapOwners } from "./mapLifecycle.fixtures";

afterEach(cleanup);

describe("real map tool/cancel lifecycle before U2 extraction", () => {
  it.each(["terrain", "erase"] as const)("%s release commits one deduped stroke", (subTool) => {
    const { result, controller } = renderMapOwners(subTool);
    act(() => result.current.map.onMouseDown(at(100, 100)));
    act(() => result.current.map.onMouseMove(at(110, 110)));
    act(() => result.current.map.onMouseMove(at(160, 160)));
    const cells = [
      { x: 2, y: 2, assetId: subTool === "terrain" ? "terrain:grass" : null },
      { x: 3, y: 3, assetId: subTool === "terrain" ? "terrain:grass" : null },
    ];
    expect(result.current.map.strokeCells).toEqual(cells);
    expect(controller.paintTerrain).not.toHaveBeenCalled();

    act(() => result.current.map.onMouseUp());
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(controller.paintTerrain).toHaveBeenCalledWith(cells);
    expect(result.current.map.strokeCells).toEqual([]);
    expect(result.current.tool.activeTool).toBe("map-edit");
    act(() => result.current.map.onMouseUp());
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
  });

  it("BASELINE BUG IA-04: grass Escape exits the real mode and flushes before release", () => {
    const { result, controller } = renderMapOwners("terrain");
    act(() => result.current.map.onMouseDown(at(100, 100)));
    act(() => result.current.map.onMouseMove(at(160, 160)));
    expect(controller.paintTerrain).not.toHaveBeenCalled();
    expect(result.current.map.strokeCells).toHaveLength(2);

    const event = escapeFromBody();

    expect(result.current.tool.activeTool).toBeNull();
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(controller.paintTerrain).toHaveBeenCalledWith([
      { x: 2, y: 2, assetId: "terrain:grass" },
      { x: 3, y: 3, assetId: "terrain:grass" },
    ]);
    expect(result.current.map.strokeCells).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    act(() => result.current.map.onMouseUp());
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
  });

  it("BASELINE BUG: direct mode exit flushes a brush without waiting for release", () => {
    const { result, controller } = renderMapOwners("terrain");
    act(() => result.current.map.onMouseDown(at(100, 100)));
    expect(controller.paintTerrain).not.toHaveBeenCalled();
    act(() => result.current.tool.setActiveTool(null));
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(controller.paintTerrain).toHaveBeenCalledWith([
      { x: 2, y: 2, assetId: "terrain:grass" },
    ]);
    expect(result.current.map.strokeCells).toEqual([]);
    expect(result.current.tool.activeTool).toBeNull();
    act(() => result.current.map.onMouseUp());
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
  });

  it("drag Escape consumes the event, retains tool/selection and discards release", () => {
    const { result, controller } = renderMapOwners("wall");
    act(() => result.current.map.onMouseDown(at(100, 100)));
    act(() => result.current.map.onMouseMove(at(200, 100)));
    expect(result.current.map.previewDrag).not.toBeNull();
    const event = escapeFromBody();
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.tool.activeTool).toBe("map-edit");
    expect(result.current.selectedObjectId).toBe("token:owned");
    expect(result.current.map.previewDrag).toBeNull();
    act(() => result.current.map.onMouseUp());
    expect(controller.addWall).not.toHaveBeenCalled();

    // A positive control makes the zero-command assertion meaningful.
    act(() => result.current.map.onMouseDown(at(300, 300)));
    act(() => result.current.map.onMouseMove(at(400, 300)));
    act(() => result.current.map.onMouseUp());
    expect(controller.addWall).toHaveBeenCalledTimes(1);
    expect(controller.addWall).toHaveBeenCalledWith(
      expect.objectContaining({ x1: 300, y1: 300, x2: 400, y2: 300 }),
    );
  });

  it.each(["terrain", "erase"] as const)(
    "%s signal cancellation survives move/release",
    (subTool) => {
      const { result, rerender, controller } = renderMapOwners(subTool);
      act(() => result.current.map.onMouseDown(at(100, 100)));
      act(() => result.current.map.onMouseMove(at(160, 160)));
      expect(result.current.map.strokeCells).toHaveLength(2);
      act(() => rerender({ cancelSignal: 1 }));
      expect(result.current.map.strokeCells).toEqual([]);
      expect(result.current.tool.activeTool).toBe("map-edit");
      act(() => result.current.map.onMouseMove(at(210, 210)));
      act(() => result.current.map.onMouseUp());
      expect(controller.paintTerrain).not.toHaveBeenCalled();

      act(() => result.current.map.onMouseDown(at(320, 320)));
      act(() => result.current.map.onMouseUp());
      expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
      expect(controller.paintTerrain).toHaveBeenCalledWith([
        { x: 6, y: 6, assetId: subTool === "terrain" ? "terrain:grass" : null },
      ]);
    },
  );

  it("signal cancellation discards a nonzero wall drag and a later move/release", () => {
    const { result, rerender, controller } = renderMapOwners("wall");
    act(() => result.current.map.onMouseDown(at(100, 100)));
    act(() => result.current.map.onMouseMove(at(200, 100)));
    act(() => rerender({ cancelSignal: 1 }));
    act(() => result.current.map.onMouseMove(at(250, 100)));
    act(() => result.current.map.onMouseUp());
    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.map.previewDrag).toBeNull();
    expect(result.current.tool.activeTool).toBe("map-edit");
  });

  it.each(["signal", "onCancel"] as const)(
    "%s cancels touch aim before an immediate release",
    (path) => {
      const { result, rerender, controller } = renderMapOwners("place");
      act(() => result.current.map.onMouseDown(at(100, 100), "touch"));
      expect(result.current.map.placementGhost).not.toBeNull();
      expect(controller.addTile).not.toHaveBeenCalled();
      act(() =>
        path === "signal" ? rerender({ cancelSignal: 1 }) : result.current.map.onCancel(),
      );
      expect(result.current.map.placementGhost).toBeNull();
      act(() => result.current.map.onMouseUp("touch"));
      expect(controller.addTile).not.toHaveBeenCalled();
      expect(controller.addStamp).not.toHaveBeenCalled();

      act(() => result.current.map.onMouseDown(at(300, 300), "touch"));
      act(() => result.current.map.onMouseUp("touch"));
      expect(controller.addTile).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["signal", "onCancel"] as const)(
    "BASELINE BUG: %s aim cancellation can be rearmed by move",
    (path) => {
      const { result, rerender, controller } = renderMapOwners("place");
      act(() => result.current.map.onMouseDown(at(100, 100), "touch"));
      act(() =>
        path === "signal" ? rerender({ cancelSignal: 1 }) : result.current.map.onCancel(),
      );
      expect(result.current.map.placementGhost).toBeNull();
      expect(controller.addTile).not.toHaveBeenCalled();
      act(() => result.current.map.onMouseMove(at(300, 300), "touch"));
      expect(result.current.map.placementGhost).not.toBeNull();
      act(() => result.current.map.onMouseUp("touch"));
      expect(controller.addTile).toHaveBeenCalledTimes(1);
      act(() => result.current.map.onMouseUp("touch"));
      expect(controller.addTile).toHaveBeenCalledTimes(1);
    },
  );

  it("desktop point placement already commits on press; Escape cannot retract it", () => {
    const { result, controller } = renderMapOwners("place");
    act(() => result.current.map.onMouseDown(at(100, 100)));
    expect(controller.addTile).toHaveBeenCalledTimes(1);
    escapeFromBody();
    act(() => result.current.map.onMouseUp());
    expect(controller.addTile).toHaveBeenCalledTimes(1);
    expect(controller.addStamp).not.toHaveBeenCalled();
  });
});
