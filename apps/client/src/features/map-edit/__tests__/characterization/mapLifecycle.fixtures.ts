// Real map/tool/cancel composition for the U2 characterization baseline.
import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type Konva from "konva";
import type { MapDocument } from "@herobyte/shared";
import { useToolMode } from "../../../../hooks/useToolMode";
import { useKeyboardNavigation } from "../../../../hooks/useKeyboardNavigation";
import { useMapEditTool } from "../../useMapEditTool";
import type { MapStudioController } from "../../../map-studio/types";
import type { MapEditSubTool } from "../../mapEditTypes";

function makeDocument(): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Lifecycle fixture",
    width: 8192,
    height: 8192,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [
      {
        id: "walls",
        name: "Walls",
        kind: "walls",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 30,
      },
      {
        id: "objects",
        name: "Objects",
        kind: "objects",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 20,
      },
    ],
    elements: [],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

export function makeController(): MapStudioController {
  return {
    activeDocument: makeDocument(),
    saving: false,
    addWall: vi.fn(() => "wall-1"),
    addDoor: vi.fn(() => "door-1"),
    addTile: vi.fn(() => "tile-1"),
    addStamp: vi.fn(() => "stamp-1"),
    addStamps: vi.fn(() => ["stamp-1"]),
    placeRoom: vi.fn(),
    paintTerrain: vi.fn(),
  } as unknown as MapStudioController;
}

export function at(x: number, y: number) {
  return { current: { getPointerPosition: () => ({ x, y }) } as unknown as Konva.Stage };
}

const identityToWorld = (x: number, y: number) => ({ x, y });

// No map/tool/cancel/brush/aim hook is mocked. The only boundaries substituted
// are a stage pointer and controller command methods; this is not server evidence.
export function renderMapOwners(subTool: MapEditSubTool) {
  const controller = makeController();
  const sendMessage = vi.fn();
  const handleSelectDrawing = vi.fn();
  const hook = renderHook(
    ({ cancelSignal }: { cancelSignal: number }) => {
      const tool = useToolMode();
      const [selectedObjectId, setSelectedObjectId] = useState<string | null>("token:owned");
      useKeyboardNavigation({
        selectedDrawingId: null,
        selectMode: tool.selectMode,
        sendMessage,
        handleSelectDrawing,
        selectedObjectId,
        onSelectObject: setSelectedObjectId,
      });
      const map = useMapEditTool({
        mapEditMode: tool.mapEditMode,
        activeSubTool: subTool,
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        cancelSignal,
        toWorld: identityToWorld,
        mapTransform: undefined,
      });
      return { tool, map, selectedObjectId };
    },
    { initialProps: { cancelSignal: 0 } },
  );
  act(() => hook.result.current.tool.setActiveTool("map-edit"));
  return { ...hook, controller };
}

export function escapeFromBody() {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}
