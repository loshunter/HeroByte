import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { at, makeController } from "./mapLifecycle.fixtures";
import { renderMapComposition } from "./mapOwners.u2.fixtures";

afterEach(cleanup);

describe("map gesture identity and latest-snapshot boundaries", () => {
  it.each(["move", "subtool", "document", "live-binding"] as const)(
    "%s transition discards a held stroke, including a captured release",
    (transition) => {
      const { current, controller, update } = renderMapComposition("terrain");
      act(() => current().map.onMouseDown(at(100, 100)));
      act(() => current().map.onMouseMove(at(160, 160)));
      const held = current().map;
      const replacement = makeController();
      replacement.activeDocument = { ...replacement.activeDocument!, id: "other" };
      act(() => {
        if (transition === "move") current().tool.setActiveTool(null);
        if (transition === "subtool") update({ activeSubTool: "erase" });
        if (transition === "document") update({ controller: replacement, liveDocumentId: "other" });
        if (transition === "live-binding") update({ liveDocumentId: "other" });
      });
      expect(current().map.strokeCells).toEqual([]);
      act(() => {
        held.onMouseMove(at(210, 210));
        held.onMouseUp();
        current().map.onMouseMove(at(260, 260));
        current().map.onMouseUp();
      });
      expect(controller.paintTerrain).not.toHaveBeenCalled();
      expect(replacement.paintTerrain).not.toHaveBeenCalled();
      // Restore a valid authoring context and prove a new press still commits.
      act(() => {
        current().tool.setActiveTool("map-edit");
        update({ controller, liveDocumentId: "live", activeSubTool: "terrain" });
      });
      act(() => {
        current().map.onMouseDown(at(320, 320));
        current().map.onMouseUp();
      });
      expect(controller.paintTerrain).toHaveBeenCalledExactlyOnceWith([
        { x: 6, y: 6, assetId: "terrain:grass" },
      ]);
    },
  );

  it("same-document revision, saving, callback and coordinate-function refresh preserve the stroke", () => {
    const { current, controller, update } = renderMapComposition("terrain");
    act(() => current().map.onMouseDown(at(100, 100)));
    const paintTerrain = vi.fn();
    update({
      controller: {
        ...controller,
        saving: true,
        activeDocument: { ...controller.activeDocument!, revision: 2, updatedAt: 2 },
        paintTerrain,
      },
      toWorld: (x, y) => ({ x, y }),
    });
    expect(current().map.strokeCells).toEqual([{ x: 2, y: 2, assetId: "terrain:grass" }]);
    act(() => {
      current().map.onMouseMove(at(160, 160));
      current().map.onMouseUp();
    });
    expect(controller.paintTerrain).not.toHaveBeenCalled();
    expect(paintTerrain).toHaveBeenCalledExactlyOnceWith([
      { x: 2, y: 2, assetId: "terrain:grass" },
      { x: 3, y: 3, assetId: "terrain:grass" },
    ]);
  });

  it.each(["terrain", "erase", "wall", "room", "place"] as const)(
    "%s unmount disarms a retained move/release callback",
    (subTool) => {
      const { current, controller, unmount } = renderMapComposition(subTool);
      const input = subTool === "place" ? "touch" : "mouse";
      act(() => current().map.onMouseDown(at(100, 100), input));
      act(() => current().map.onMouseMove(at(250, 200), input));
      const held = current().map;
      unmount();
      act(() => {
        held.onMouseMove(at(350, 300), input);
        held.onMouseUp(input);
        held.onMouseUp(input);
      });
      expect(controller.paintTerrain).not.toHaveBeenCalled();
      expect(controller.addWall).not.toHaveBeenCalled();
      expect(controller.placeRoom).not.toHaveBeenCalled();
      expect(controller.addTile).not.toHaveBeenCalled();
      expect(controller.addStamp).not.toHaveBeenCalled();
    },
  );
});
