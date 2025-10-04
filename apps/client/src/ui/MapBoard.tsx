// ============================================================================
// MAP BOARD COMPONENT
// ============================================================================
// Main canvas component using Konva for rendering the VTT map.
// Features:
// - Pan and zoom camera controls
// - Infinite grid overlay
// - Token rendering and dragging
// - Freehand drawing
// - Pointer indicators
// - Distance measurement tool
// - Map background image support

import { useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import type { RoomSnapshot, Token, Player, Pointer, Drawing, ClientMessage } from "@shared";
import { useCamera, type Camera } from "../hooks/useCamera.js";
import { usePointerTool } from "../hooks/usePointerTool.js";
import { useDrawingTool } from "../hooks/useDrawingTool.js";
import { useDrawingSelection } from "../hooks/useDrawingSelection.js";
import {
  GridLayer,
  MapImageLayer,
  TokensLayer,
  PointersLayer,
  DrawingsLayer,
  MeasureLayer,
} from "../features/map/components";

// ----------------------------------------------------------------------------
// HOOKS
// ----------------------------------------------------------------------------

/**
 * Hook to track the size of a DOM element
 * Updates whenever the element is resized
 */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return { ref, ...size };
}

// ----------------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------------

interface MapBoardProps {
  snapshot: RoomSnapshot | null; // Current room state
  sendMessage: (msg: ClientMessage) => void; // Function to send messages to server
  uid: string; // Current player's UID
  gridSize: number; // Synchronized grid size
  snapToGrid: boolean; // Whether to snap tokens to grid
  pointerMode: boolean; // Pointer tool active
  measureMode: boolean; // Measure tool active
  drawMode: boolean; // Draw tool active
  selectMode: boolean; // Selection tool active
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser"; // Active drawing tool
  drawColor: string; // Drawing color
  drawWidth: number; // Drawing brush size
  drawOpacity: number; // Drawing opacity (0-1)
  drawFilled: boolean; // Whether shapes are filled
  onMoveToken: (id: string, x: number, y: number) => void;
  onRecolorToken: (id: string) => void;
  onDeleteToken: (id: string) => void;
  onDrawingComplete?: (drawingId: string) => void; // Called when a drawing is completed
}

/**
 * MapBoard: Main VTT canvas component
 *
 * Handles:
 * - Camera (pan/zoom)
 * - Interactive tools (pointer, measure, draw)
 * - Token rendering and interaction
 * - Grid and map background
 */
export default function MapBoard({
  snapshot,
  sendMessage,
  uid,
  gridSize,
  snapToGrid,
  pointerMode,
  measureMode,
  drawMode,
  selectMode,
  drawTool,
  drawColor,
  drawWidth,
  drawOpacity,
  drawFilled,
  onMoveToken,
  onRecolorToken,
  onDeleteToken,
  onDrawingComplete,
}: MapBoardProps) {
  // -------------------------------------------------------------------------
  // STATE & HOOKS
  // -------------------------------------------------------------------------

  const { ref, w, h } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<any>(null);

  // Drawing selection
  const {
    selectedDrawingId,
    selectDrawing: handleSelectDrawing,
    deselectIfEmpty,
    onDrawingDragEnd,
  } = useDrawingSelection({ selectMode, sendMessage });

  // Camera controls (pan/zoom)
  const {
    cam,
    setCam,
    isPanning,
    onWheel: handleWheel,
    onMouseDown: handleCameraMouseDown,
    onMouseMove: handleCameraMouseMove,
    onMouseUp: handleCameraMouseUp,
    toWorld,
  } = useCamera();

  // Pointer and measure tool
  const {
    measureStart,
    measureEnd,
    onStageClick: handlePointerClick,
    onMouseMove: handlePointerMouseMove,
  } = usePointerTool({
    pointerMode,
    measureMode,
    toWorld,
    sendMessage,
    gridSize,
  });

  // Drawing tool
  const {
    currentDrawing,
    isDrawing,
    onMouseDown: handleDrawMouseDown,
    onMouseMove: handleDrawMouseMove,
    onMouseUp: handleDrawMouseUp,
  } = useDrawingTool({
    drawMode,
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    toWorld,
    sendMessage,
    onDrawingComplete,
  });

  // Token interaction
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // Grid configuration
  const [grid, setGrid] = useState({
    show: true,
    size: gridSize,
    color: "#447DF7",
    majorEvery: 5,
    opacity: 0.15,
  });

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------

  // Sync grid size from props
  useEffect(() => {
    setGrid((prev) => ({ ...prev, size: gridSize }));
  }, [gridSize]);

  // Delete key handler for selected drawings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedDrawingId && selectMode) {
        sendMessage({ t: "delete-drawing", id: selectedDrawingId });
        handleSelectDrawing(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDrawingId, selectMode, sendMessage, handleSelectDrawing]);

  // -------------------------------------------------------------------------
  // UNIFIED EVENT HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Unified stage click handler (pointer/measure tools)
   */
  const onStageClick = (e: any) => {
    if (!pointerMode && !measureMode && !drawMode) {
      deselectIfEmpty(e);
      return;
    }
    handlePointerClick(e);
  };

  /**
   * Unified mouse down handler (camera pan, drawing)
   */
  const onMouseDown = (e: any) => {
    const shouldPan = !pointerMode && !measureMode && !drawMode && !selectMode;
    handleCameraMouseDown(e, stageRef, shouldPan);
    handleDrawMouseDown(stageRef);
  };

  /**
   * Unified mouse move handler (camera, drawing, measure)
   */
  const onMouseMove = (_e: any) => {
    handleCameraMouseMove(stageRef);
    handlePointerMouseMove(stageRef);
    handleDrawMouseMove(stageRef);
  };

  /**
   * Unified mouse up handler (camera, drawing)
   */
  const onMouseUp = () => {
    handleCameraMouseUp();
    handleDrawMouseUp();
  };

  /**
   * Determine cursor style based on active mode
   */
  const getCursor = () => {
    if (isPanning) return "grabbing";
    if (pointerMode) return "crosshair";
    if (measureMode) return "crosshair";
    if (drawMode) return "crosshair";
    if (selectMode) return "default";
    return "grab";
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div
      ref={ref}
      className="map-canvas-wrapper"
      style={{
        width: "100%",
        height: "100%",
        color: "#dbe1ff",
        position: "relative",
      }}
    >
      {/* Stage is the viewport; world content is translated/scaled by cam in child Groups */}
      <Stage
        ref={stageRef}
        width={w}
        height={h}
        onWheel={(e) => handleWheel(e, stageRef)}
        onClick={onStageClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{ cursor: getCursor() }}
      >
        {/* Background Layer: Map image and grid (non-interactive) */}
        <Layer listening={false}>
          <MapImageLayer cam={cam} src={snapshot?.mapBackground || null} x={0} y={0} />
          {grid.show && (
            <GridLayer
              cam={cam}
              viewport={{ w, h }}
              gridSize={grid.size}
              color={grid.color}
              majorEvery={5}
              opacity={grid.opacity}
            />
          )}
        </Layer>

        {/* Game Layer: Drawings and tokens (interactive) */}
        <Layer>
          <DrawingsLayer
            cam={cam}
            drawings={snapshot?.drawings || []}
            currentDrawing={currentDrawing}
            currentTool={drawTool}
            currentColor={drawColor}
            currentWidth={drawWidth}
            currentOpacity={drawOpacity}
            currentFilled={drawFilled}
            uid={uid}
            selectMode={selectMode}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={handleSelectDrawing}
            onDrawingDragEnd={onDrawingDragEnd}
          />
          <TokensLayer
            cam={cam}
            tokens={snapshot?.tokens || []}
            uid={uid}
            gridSize={grid.size}
            hoveredTokenId={hoveredTokenId}
            onHover={setHoveredTokenId}
            onMoveToken={onMoveToken}
            onRecolorToken={onRecolorToken}
            onDeleteToken={onDeleteToken}
            snapToGrid={snapToGrid}
          />
        </Layer>

        {/* Overlay Layer: Pointers and measure tool (top-most) */}
        <Layer listening={false}>
          <PointersLayer
            cam={cam}
            pointers={snapshot?.pointers || []}
            players={snapshot?.players || []}
            tokens={snapshot?.tokens || []}
          />
          <MeasureLayer
            cam={cam}
            measureStart={measureStart}
            measureEnd={measureEnd}
            gridSize={grid.size}
          />
        </Layer>
      </Stage>
    </div>
  );
}
