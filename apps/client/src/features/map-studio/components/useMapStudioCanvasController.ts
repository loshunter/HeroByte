import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import type { MapDocument, MapLayer } from "@herobyte/shared";
import { snapPointToGrid } from "../snapToGrid";
import type { MapStudioTileAsset } from "../starterTiles";
import type { MapStampDraft, MapTileDraft } from "../types";
import {
  MAX_ROOM_TILES,
  type MapViewBox,
  type RoomDrag,
  type StudioTool,
} from "./MapStudioWorkspace.types";
import {
  buildRoomTileDrafts,
  buildStampDraft,
  clamp,
  clampViewBox,
  eventToMapPoint,
  paintPlacementBounds,
  pickPlacementLayer,
  screenDeltaToMapDelta,
  topmostTileAtPoint,
  zoomViewBox,
} from "./mapStudioWorkspaceUtils";
import { buildScatterDrafts } from "../scatterBrush";
import { useAltKeyTracking } from "./useAltKeyTracking";

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
  removeElement: (elementId: string) => void;
  setSelectedElementId: (elementId: string | null) => void;
  setPublishMessage: (message: string) => void;
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
  removeElement,
  setSelectedElementId,
  setPublishMessage,
}: UseMapStudioCanvasControllerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const paintedCells = useRef(new Set<string>());
  const panState = useRef<{ pointerId: number; lastClientX: number; lastClientY: number } | null>(
    null,
  );
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [freePlacement, setFreePlacement] = useAltKeyTracking();
  const [painting, setPainting] = useState(false);
  const [roomDrag, setRoomDrag] = useState<RoomDrag | null>(null);
  const [viewBox, setViewBox] = useState<MapViewBox>({ x: 0, y: 0, width: 2048, height: 2048 });

  useEffect(() => {
    if (!activeDocument) return;
    setViewBox({ x: 0, y: 0, width: activeDocument.width, height: activeDocument.height });
    setRoomDrag(null);
    panState.current = null;
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

  const handleResetView = () => {
    if (!activeDocument) return;
    setViewBox({ x: 0, y: 0, width: activeDocument.width, height: activeDocument.height });
  };

  const handleZoom = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      if (!activeDocument) return;
      setViewBox((current) => zoomViewBox(current, activeDocument, factor, anchor));
    },
    [activeDocument],
  );

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    event.preventDefault();
    const anchor = eventToMapPoint(event, viewBox, svgRef.current);
    handleZoom(event.deltaY < 0 ? 0.82 : 1.18, anchor);
  };

  const startPan = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panState.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
  };

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
      if (!activeDocument || saving) return;
      const element = topmostTileAtPoint(activeDocument, layers, point);
      if (!element) return;
      const cellKey = `erase:${element.id}`;
      if (paintedCells.current.has(cellKey)) return;
      paintedCells.current.add(cellKey);
      removeElement(element.id);
    },
    [activeDocument, layers, removeElement, saving],
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
    if (!activeDocument || saving) return;
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
      if (event.altKey) {
        stampAtPoint(point);
        return;
      }
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setPainting(true);
      paintAtPoint(point);
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
    if (tool === "room") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const snapped = snapPointToGrid(point, activeDocument.grid);
      setPainting(true);
      setRoomDrag({ start: snapped, end: snapped });
      return;
    }
    if (event.target === event.currentTarget) {
      setSelectedElementId(null);
    }
  };

  const handleCanvasPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    if (panState.current?.pointerId === event.pointerId) {
      const delta = screenDeltaToMapDelta(
        event.clientX - panState.current.lastClientX,
        event.clientY - panState.current.lastClientY,
        viewBox,
        svgRef.current,
      );
      panState.current = {
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      };
      setViewBox((current) =>
        clampViewBox(
          { ...current, x: current.x - delta.x, y: current.y - delta.y },
          activeDocument,
        ),
      );
      return;
    }
    const point = eventToMapPoint(event, viewBox, svgRef.current);
    setCursorPoint(point);
    setFreePlacement(event.altKey);
    if (!painting || saving) return;
    if (tool === "tile") paintAtPoint(point);
    if (tool === "erase") eraseAtPoint(point);
    if (tool === "room") {
      setRoomDrag((current) =>
        current ? { ...current, end: snapPointToGrid(point, activeDocument.grid) } : current,
      );
    }
  };

  const handleCanvasPointerEnd = () => {
    if (roomDrag && tool === "room") commitRoomDrag(roomDrag);
    setPainting(false);
    paintedCells.current = new Set();
    panState.current = null;
    setRoomDrag(null);
  };

  return {
    svgRef,
    viewBox,
    roomDrag,
    snappedCursor,
    stampPreview,
    handleZoom,
    handleResetView,
    handleWheel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerEnd,
  };
}
