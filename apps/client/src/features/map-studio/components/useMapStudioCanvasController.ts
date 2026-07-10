import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { MapDocument, MapLayer, TerrainPaintCell } from "@herobyte/shared";
import { getTerrainCell } from "@herobyte/shared";
import { snapPointToGrid } from "../snapToGrid";
import type { MapStudioTileAsset } from "../starterTiles";
import type { MapDoorDraft, MapStampDraft, MapTileDraft, MapWallDraft } from "../types";
import { MAX_ROOM_TILES, type RoomDrag, type StudioTool } from "./MapStudioWorkspace.types";
import { commitSegmentDrag } from "./wallDoorDrafts";
import {
  buildRoomTileDrafts,
  buildStampDraft,
  clamp,
  eventToMapPoint,
  paintPlacementBounds,
  pickPlacementLayer,
  sampleAssetAtPoint,
  topmostTileAtPoint,
} from "./mapStudioWorkspaceUtils";
import { buildScatterDrafts } from "../scatterBrush";
import { useAltKeyTracking } from "./useAltKeyTracking";
import { useStudioCamera } from "./useStudioCamera";
import { useTerrainBrush } from "./useTerrainBrush";

interface UseMapStudioCanvasControllerProps {
  activeDocument?: MapDocument | null;
  saving: boolean;
  selectedAsset: MapStudioTileAsset;
  roomFillAsset: MapStudioTileAsset;
  roomWallAsset: MapStudioTileAsset | null;
  layers: Map<string, MapLayer>;
  tool: StudioTool;
  addTile: (tile: MapTileDraft) => void;
  addTiles: (tiles: MapTileDraft[]) => void;
  addStamp: (stamp: MapStampDraft) => void;
  addStamps: (stamps: MapStampDraft[]) => void;
  addWall: (draft: MapWallDraft) => string | null;
  addDoor: (draft: MapDoorDraft) => string | null;
  paintTerrain: (cells: TerrainPaintCell[]) => void;
  removeElement: (elementId: string) => void;
  setSelectedElementId: (elementId: string | null) => void;
  setPublishMessage: (message: string) => void;
  onSampleAsset: (assetId: string) => void;
}

export function useMapStudioCanvasController({
  activeDocument,
  saving,
  selectedAsset,
  roomFillAsset,
  roomWallAsset,
  layers,
  tool,
  addTile,
  addTiles,
  addStamp,
  addStamps,
  addWall,
  addDoor,
  paintTerrain,
  removeElement,
  setSelectedElementId,
  setPublishMessage,
  onSampleAsset,
}: UseMapStudioCanvasControllerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const paintedCells = useRef(new Set<string>());
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [freePlacement, setFreePlacement] = useAltKeyTracking();
  const [painting, setPainting] = useState(false);
  const [roomDrag, setRoomDrag] = useState<RoomDrag | null>(null);
  // Wall/door two-point drag (both live on the walls layer; commit differs).
  const [segmentDrag, setSegmentDrag] = useState<RoomDrag | null>(null);
  const { viewBox, handleResetView, handleZoom, handleWheel, startPan, handlePanMove, endPan } =
    useStudioCamera(activeDocument, svgRef);
  const { addStrokePoint, flushStroke, strokeCells } = useTerrainBrush({
    activeDocument,
    paintTerrain,
  });
  // Terrain-kind assets paint cells on square grids; hex/iso grids keep
  // element placement (hex-snapped) — hex autotile masks are post-launch.
  const terrainAsset =
    selectedAsset.layerKind === "terrain" && activeDocument?.grid.type === "square";

  useEffect(() => {
    setRoomDrag(null);
    setSegmentDrag(null);
  }, [activeDocument?.id, activeDocument?.width, activeDocument?.height]);

  const snappedCursor = useMemo(
    () =>
      activeDocument && cursorPoint ? snapPointToGrid(cursorPoint, activeDocument.grid) : null,
    [activeDocument, cursorPoint],
  );

  // Alt-held ghost: the selected asset's footprint centered on the raw cursor,
  // previewing exactly where an Alt-click would drop the free stamp.
  const stampPreview = useMemo(() => {
    if (!activeDocument || !cursorPoint || !freePlacement || painting || tool !== "tile") {
      return null;
    }
    const width = selectedAsset.columns * activeDocument.grid.size;
    const height = selectedAsset.rows * activeDocument.grid.size;
    return {
      x: clamp(cursorPoint.x - width / 2, 0, activeDocument.width - width),
      y: clamp(cursorPoint.y - height / 2, 0, activeDocument.height - height),
      width,
      height,
    };
  }, [activeDocument, cursorPoint, freePlacement, tool, selectedAsset]);

  const paintAtPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!activeDocument || !selectedAsset || saving) return;
      const { grid } = activeDocument;
      const snapped = snapPointToGrid(point, grid);
      const xBounds = paintPlacementBounds(
        activeDocument.width,
        selectedAsset.columns,
        grid.size,
        grid.offsetX,
        grid.snap,
      );
      const yBounds = paintPlacementBounds(
        activeDocument.height,
        selectedAsset.rows,
        grid.size,
        grid.offsetY,
        grid.snap,
      );
      const x = clamp(snapped.x, xBounds.min, xBounds.max);
      const y = clamp(snapped.y, yBounds.min, yBounds.max);
      const cellKey = `${selectedAsset.id}:${x}:${y}`;
      if (paintedCells.current.has(cellKey)) return;
      paintedCells.current.add(cellKey);
      if (
        activeDocument.elements.some(
          (element) =>
            element.type === "tile" &&
            element.data.assetId === selectedAsset.id &&
            element.transform.x === x &&
            element.transform.y === y,
        )
      ) {
        return;
      }
      const layer = pickPlacementLayer(activeDocument, selectedAsset);
      if (!layer) return;
      addTile({
        layerId: layer.id,
        assetId: selectedAsset.id,
        x,
        y,
        columns: selectedAsset.columns,
        rows: selectedAsset.rows,
      });
    },
    [activeDocument, addTile, saving, selectedAsset],
  );

  const eraseAtPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!activeDocument) return;
      const element = topmostTileAtPoint(activeDocument, layers, point);
      if (element) {
        // Element removal dispatches a command immediately — gate on saving.
        if (saving) return;
        const cellKey = `erase:${element.id}`;
        if (paintedCells.current.has(cellKey)) return;
        paintedCells.current.add(cellKey);
        removeElement(element.id);
        return;
      }
      // Nothing stacked here: erase painted terrain under the cursor. Cells
      // accumulate LOCALLY and commit once on release, so this path must
      // never gate on saving — a mid-drag element removal would otherwise
      // freeze the stroke for a full round trip (found by adversarial
      // review); the command queue sequences the flush safely.
      if (!activeDocument.terrain) return;
      const { size, offsetX, offsetY } = activeDocument.grid;
      const cellX = Math.floor((point.x - offsetX) / size);
      const cellY = Math.floor((point.y - offsetY) / size);
      if (getTerrainCell(activeDocument.terrain, cellX, cellY) === null) return;
      addStrokePoint(point, null);
    },
    [activeDocument, layers, removeElement, saving, addStrokePoint],
  );

  const commitRoomDrag = useCallback(
    (drag: RoomDrag) => {
      if (!activeDocument || saving) return;
      const drafts = buildRoomTileDrafts({
        document: activeDocument,
        layers,
        fillAsset: roomFillAsset,
        wallAsset: roomWallAsset,
        drag,
      });
      if (drafts.length === 0 || drafts.length > MAX_ROOM_TILES) {
        setPublishMessage(`Room area is too large for one edit (${drafts.length} tiles).`);
        return;
      }
      addTiles(drafts);
    },
    [activeDocument, addTiles, layers, roomFillAsset, roomWallAsset, saving, setPublishMessage],
  );

  const stampAtPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!activeDocument || !selectedAsset || saving) return;
      const draft = buildStampDraft(activeDocument, selectedAsset, point);
      if (draft) addStamp(draft);
    },
    [activeDocument, selectedAsset, saving, addStamp],
  );

  const scatterAtPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!activeDocument || !selectedAsset || saving) return;
      // Fresh seed per click; the scatter itself is deterministic per seed.
      const seed = Math.floor(Math.random() * 0xffffffff);
      const drafts = buildScatterDrafts(activeDocument, selectedAsset, point, seed);
      if (drafts.length > 0) addStamps(drafts);
    },
    [activeDocument, selectedAsset, saving, addStamps],
  );

  const handleCanvasPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    // No blanket saving gate: local-only paths (pan, terrain strokes, erase
    // accumulation) stay live while a command is in flight; every command-
    // dispatching path (paint, stamp, scatter, element removal) gates itself.
    if (!activeDocument) return;
    if (tool === "pan" || event.button === 1 || event.shiftKey) {
      startPan(event);
      return;
    }
    // Right/back/forward buttons never paint, stamp, or erase.
    if (event.button !== 0) return;
    const point = eventToMapPoint(event, viewBox, svgRef.current);
    setCursorPoint(point);
    setFreePlacement(event.altKey);
    paintedCells.current = new Set();
    if (tool === "tile") {
      // Ctrl/Cmd+click samples the asset under the cursor (eyedropper).
      if (event.ctrlKey || event.metaKey) {
        const sampled = sampleAssetAtPoint(activeDocument, layers, point);
        if (sampled) onSampleAsset(sampled);
        return;
      }
      if (event.altKey) {
        stampAtPoint(point);
        return;
      }
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setPainting(true);
      if (terrainAsset) {
        addStrokePoint(point, selectedAsset.id);
      } else {
        paintAtPoint(point);
      }
      return;
    }
    if (tool === "scatter") {
      scatterAtPoint(point);
      return;
    }
    if (tool === "erase") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setPainting(true);
      eraseAtPoint(point);
      return;
    }
    // Room, wall, and door share one two-point drag lifecycle; only the drag
    // state (and its commit at pointer-up) differ.
    if (tool === "room" || tool === "wall" || tool === "door") {
      if (saving) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const snapped = snapPointToGrid(point, activeDocument.grid);
      setPainting(true);
      (tool === "room" ? setRoomDrag : setSegmentDrag)({ start: snapped, end: snapped });
      return;
    }
    if (event.target === event.currentTarget) {
      setSelectedElementId(null);
    }
  };

  const handleCanvasPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    if (handlePanMove(event)) return;
    const point = eventToMapPoint(event, viewBox, svgRef.current);
    setCursorPoint(point);
    setFreePlacement(event.altKey);
    if (!painting) return;
    if (tool === "tile") {
      if (terrainAsset) {
        // Local accumulation — never gated on saving, or a mid-stroke
        // command ack would freeze the brush for a round trip.
        addStrokePoint(point, selectedAsset.id);
      } else {
        paintAtPoint(point); // self-gates on saving
      }
    }
    if (tool === "erase") eraseAtPoint(point); // gates element removal only
    if ((tool === "room" || tool === "wall" || tool === "door") && !saving) {
      const setDrag = tool === "room" ? setRoomDrag : setSegmentDrag;
      setDrag((current) =>
        current ? { ...current, end: snapPointToGrid(point, activeDocument.grid) } : current,
      );
    }
  };

  const handleCanvasPointerEnd = () => {
    if (roomDrag && tool === "room") commitRoomDrag(roomDrag);
    // Wall/door commit self-guards on the walls layer + zero-length; gate on
    // saving here (addWall/addDoor don't self-gate — a known command-queue drop).
    if (segmentDrag && !saving) commitSegmentDrag(tool, layers, segmentDrag, addWall, addDoor);
    flushStroke();
    setPainting(false);
    paintedCells.current = new Set();
    endPan();
    setRoomDrag(null);
    setSegmentDrag(null);
  };

  return {
    svgRef,
    viewBox,
    roomDrag,
    segmentDrag,
    snappedCursor,
    strokeCells,
    stampPreview,
    handleZoom,
    handleResetView,
    handleWheel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerEnd,
  };
}
