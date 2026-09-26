import { useCallback, useReducer, useState } from "react";
import type { TerrainBrushSize } from "../map-studio/terrainBrushGeometry";
import { TOOL_DESCRIPTORS, TOOL_GROUPS, type MapEditGroup } from "./mapEditToolDescriptors";
import type {
  MapEditFloorFamily,
  MapEditSplineKind,
  MapEditSubTool,
  MapEditWallFamily,
} from "./mapEditTypes";

/** Palette choices outlive either responsive surface; they do not own a controller. */
export function useMapEditPaletteState() {
  const [tools, dispatch] = useReducer(toolReducer, initialTools);
  const setActiveSubTool = useCallback((tool: MapEditSubTool) => dispatch({ tool }), []);
  const onSelectGroup = useCallback(
    (group: MapEditGroup) => {
      dispatch({ group });
      return tools.remembered[group];
    },
    [tools.remembered],
  );
  const [floorFamily, setFloorFamily] = useState<MapEditFloorFamily>("grass");
  const [roomWallFamily, setRoomWallFamily] = useState<MapEditWallFamily | "none">("wall-stone");
  const [hallwayWidth, setHallwayWidth] = useState(2);
  const [terrainBrushSize, setTerrainBrushSize] = useState<TerrainBrushSize>(1);
  const [splineKind, setSplineKind] = useState<MapEditSplineKind>("rope");
  const [layersOpen, setLayersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [wallsOverlayPinned, setWallsOverlayPinned] = useState(false);
  const onToggleWallsOverlay = useCallback(() => setWallsOverlayPinned((pinned) => !pinned), []);
  const onToggleLayers = useCallback(() => setLayersOpen((open) => !open), []);
  const onToggleInspector = useCallback(() => setInspectorOpen((open) => !open), []);
  return {
    activeSubTool: tools.active,
    activeGroup: tools.group,
    onSelectGroup,
    setActiveSubTool,
    floorFamily,
    setFloorFamily,
    roomWallFamily,
    setRoomWallFamily,
    hallwayWidth,
    setHallwayWidth,
    terrainBrushSize,
    setTerrainBrushSize,
    splineKind,
    setSplineKind,
    layersOpen,
    inspectorOpen,
    wallsOverlayPinned,
    onToggleWallsOverlay,
    onToggleLayers,
    onToggleInspector,
  };
}

interface ToolState {
  active: MapEditSubTool;
  group: MapEditGroup;
  remembered: Record<MapEditGroup, MapEditSubTool>;
}
const initialTools: ToolState = {
  active: "wall",
  group: "structures",
  remembered: Object.fromEntries(
    TOOL_GROUPS.map(({ id, initialTool }) => [id, initialTool]),
  ) as Record<MapEditGroup, MapEditSubTool>,
};
function toolReducer(
  state: ToolState,
  action: { tool: MapEditSubTool } | { group: MapEditGroup },
): ToolState {
  const active = "tool" in action ? action.tool : state.remembered[action.group];
  const group = TOOL_DESCRIPTORS[active].group;
  return {
    active,
    group: group ?? state.group,
    remembered: group ? { ...state.remembered, [group]: active } : state.remembered,
  };
}
