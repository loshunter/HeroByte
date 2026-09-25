import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  addMapElement,
  compileScene,
  paintTerrain,
  placeRoom,
  updateMapElement,
  type MapDocument,
} from "@herobyte/shared";
import { commitDragTool } from "../commitDragTool";
import { boundPalette } from "./characterization/palette.fixtures";

afterEach(cleanup);

/** Real controller + drag commit; document replies use the shared server mutation. */
function placedRegion(kind: "room" | "hallway" = "room") {
  const h = boundPalette();
  const before = paintTerrain(
    h.document,
    Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
      assetId: "terrain:grass",
    })),
    2,
  );
  const receive = (document: MapDocument, appliedCommandId?: string) =>
    act(() =>
      h.result.current.controller.handleServerMessage({
        t: "map-studio-document",
        document,
        appliedCommandId,
        history: { canUndo: true, canRedo: false },
      }),
    );
  receive(before);
  act(() => h.props().onSelectSubTool(kind));
  act(() =>
    commitDragTool({
      subTool: kind,
      drag: { start: { x: 0, y: 0 }, end: { x: 450, y: kind === "room" ? 450 : 0 } },
      document: before,
      controller: h.result.current.controller,
      floorFamily: "grass",
      roomWallFamily: "none",
      hallwayWidth: 2,
      selectedAssetId: "unused",
      splineKind: "rope",
      onRegionPlaced: h.result.current.state.onRegionPlaced,
    }),
  );
  const message = h.send.mock.calls.at(-1)?.[0];
  if (message?.t !== "map-studio-command" || message.command.type !== "place-room")
    throw new Error("Expected the real drag to dispatch place-room");
  const { command } = message;
  const document = placeRoom(before, command.cells, command.elements, 3);
  const acknowledge = () => receive(document, command.commandId);
  const assertInvalid = () => {
    expect(h.props().canPopulate).toBe(false);
    expect(h.props().populateTarget).toBeNull();
    expect(h.result.current.state.persistentPreview.populateTarget).toBeNull();
    expect(h.result.current.state.persistentPreview.populateGhosts).toBeNull();
  };
  return { ...h, before, document, receive, acknowledge, assertInvalid };
}

describe("decoration follows the actual last placement", () => {
  it.each(["room", "hallway"] as const)(
    "invalidates an undone %s even when underlying floor survives",
    (kind) => {
      const h = placedRegion(kind);
      h.acknowledge();
      expect(h.props().canPopulate).toBe(true);
      expect(h.props().populateTarget?.kind).toBe(kind);
      act(() => h.result.current.controller.undo());
      const undo = h.send.mock.calls.at(-1)?.[0];
      if (undo?.t !== "map-studio-command" || undo.command.type !== "undo")
        throw new Error("Expected real controller undo");
      h.receive({ ...h.before, revision: h.document.revision + 1 }, undo.command.commandId);
      expect(h.result.current.controller.activeDocument?.terrain).toEqual(h.before.terrain);
      h.assertInvalid();
    },
  );

  it("invalidates a partially erased footprint, not only a completely empty rectangle", () => {
    const h = placedRegion();
    h.acknowledge();
    expect(h.props().canPopulate).toBe(true);
    h.receive(paintTerrain(h.document, [{ x: 5, y: 5, assetId: null }], 4));
    h.assertInvalid();
  });

  it("a retained action refuses an undone placement over existing floor", () => {
    const h = placedRegion();
    h.acknowledge();
    expect(h.props().canPopulate).toBe(true);
    const decorate = h.props().onPopulate;
    h.receive({ ...h.before, revision: h.document.revision + 1 });
    h.send.mockClear();
    act(() => decorate());
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each(["moved perimeter", "changed grid"] as const)("invalidates a %s", (change) => {
    const h = placedRegion();
    h.acknowledge();
    expect(h.props().canPopulate).toBe(true);
    h.receive({
      ...h.document,
      revision: h.document.revision + 1,
      ...(change === "changed grid"
        ? { grid: { ...h.document.grid, size: 100 } }
        : {
            elements: h.document.elements.map((element) => ({
              ...element,
              transform: { ...element.transform, x: 100 },
            })),
          }),
    });
    h.assertInvalid();
  });

  it("keeps a pending placement until its acknowledgement arrives", () => {
    const h = placedRegion();
    expect(h.props().saving).toBe(true);
    expect(h.props().canPopulate).toBe(false);
    h.acknowledge();
    expect(h.props().saving).toBe(false);
    expect(h.props().canPopulate).toBe(true);
    expect(h.result.current.state.persistentPreview.populateTarget).not.toBeNull();
  });

  it.each(["room", "hallway"] as const)(
    "invalidates a %s when one perimeter is hidden through the real update action",
    (kind) => {
      const h = placedRegion(kind);
      h.acknowledge();
      expect(h.props().canPopulate).toBe(true);
      const decorate = h.props().onPopulate;
      const wall = h.document.elements[0]!;
      const wallSegments = (document: MapDocument) =>
        compileScene(document).walls.filter((segment) => segment.id.startsWith(`${wall.id}#`));
      expect(wallSegments(h.document).length).toBeGreaterThan(0);
      act(() => h.props().onUpdateElement(wall.id, { hidden: true }));
      const message = h.send.mock.calls.at(-1)?.[0];
      if (message?.t !== "map-studio-command" || message.command.type !== "update-element")
        throw new Error("Expected the real inspector action to dispatch update-element");
      const { command } = message;
      const hidden = updateMapElement(h.document, command.elementId, command.update, 4);
      expect(wallSegments(hidden)).toEqual([]);
      h.receive(hidden, command.commandId);
      expect(h.props().saving).toBe(false);
      const readiness = {
        enabled: h.props().canPopulate,
        target: h.props().populateTarget,
        outline: h.result.current.state.persistentPreview.populateTarget,
        ghosts: h.result.current.state.persistentPreview.populateGhosts,
      };
      h.send.mockClear();
      act(() => decorate());
      expect({ ...readiness, commands: h.send.mock.calls }).toEqual({
        enabled: false,
        target: null,
        outline: null,
        ghosts: null,
        commands: [],
      });
    },
  );

  it("permits floor repaint, door placement and layer presentation changes", () => {
    const h = placedRegion();
    h.acknowledge();
    const wall = h.document.elements[0]!;
    const withDoor = addMapElement(h.document, {
      id: "door-on-room",
      type: "door",
      layerId: wall.layerId,
      locked: false,
      hidden: false,
      transform: { x: 0, y: 100, scaleX: 1, scaleY: 1, rotation: 90 },
      data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
    });
    const repainted = paintTerrain(withDoor, [{ x: 5, y: 5, assetId: "terrain:dirt" }], 5);
    h.receive({
      ...repainted,
      layers: repainted.layers.map((layer) =>
        layer.id === wall.layerId ? { ...layer, opacity: 0.5, locked: true } : layer,
      ),
    });
    expect(h.props().canPopulate).toBe(true);
    expect(h.props().populateTarget?.kind).toBe("room");
    expect(h.result.current.state.persistentPreview.populateGhosts?.length).toBeGreaterThan(0);
    h.send.mockClear();
    act(() => h.props().onPopulate());
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send.mock.calls[0]?.[0]).toMatchObject({
      t: "map-studio-command",
      command: { type: "add-elements" },
    });
  });
});
