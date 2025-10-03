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
import { Stage, Layer, Image as KonvaImage, Line, Group, Rect, Circle, Text } from "react-konva";
import useImage from "use-image";
import type { RoomSnapshot, Token, Player, Pointer, Drawing, ClientMessage } from "@shared";
import { useCamera, type Camera } from "../hooks/useCamera.js";
import { usePointerTool } from "../hooks/usePointerTool.js";
import { useDrawingTool } from "../hooks/useDrawingTool.js";

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
// LAYER COMPONENTS
// ----------------------------------------------------------------------------

/**
 * GridLayer: Renders an infinite procedural grid
 * - Only renders visible grid lines based on camera position
 * - Highlights major grid lines every N steps
 * - Scales line thickness based on zoom level
 */
function GridLayer({
  cam,
  viewport,
  gridSize = 50,
  color = "#447DF7",
  majorEvery = 5,
  opacity = 0.15,
}: {
  cam: Camera;
  viewport: { w: number; h: number };
  gridSize?: number;
  color?: string;
  majorEvery?: number;
  opacity?: number;
}) {
  // Convert viewport bounds to world coordinates
  const minX = (-cam.x) / cam.scale;
  const minY = (-cam.y) / cam.scale;
  const maxX = (viewport.w - cam.x) / cam.scale;
  const maxY = (viewport.h - cam.y) / cam.scale;

  // Calculate which grid lines are visible
  const step = gridSize;
  const startX = Math.floor(minX / step) * step;
  const startY = Math.floor(minY / step) * step;

  const lines: JSX.Element[] = [];

  // Generate vertical grid lines with subtle glow
  for (let x = startX; x <= maxX; x += step) {
    const isMajor = Math.round(x / step) % majorEvery === 0;
    lines.push(
      <Line
        key={`vx-${x}`}
        points={[x, minY, x, maxY]}
        stroke={color}
        opacity={isMajor ? opacity * 2 : opacity}
        strokeWidth={isMajor ? 2 / cam.scale : 1.5 / cam.scale}
        listening={false}
        shadowColor={color}
        shadowBlur={isMajor ? 3 : 1.5}
        shadowOpacity={isMajor ? 0.4 : 0.2}
      />
    );
  }

  // Generate horizontal grid lines with subtle glow
  for (let y = startY; y <= maxY; y += step) {
    const isMajor = Math.round(y / step) % majorEvery === 0;
    lines.push(
      <Line
        key={`hy-${y}`}
        points={[minX, y, maxX, y]}
        stroke={color}
        opacity={isMajor ? opacity * 2 : opacity}
        strokeWidth={isMajor ? 2 / cam.scale : 1.5 / cam.scale}
        listening={false}
        shadowColor={color}
        shadowBlur={isMajor ? 3 : 1.5}
        shadowOpacity={isMajor ? 0.4 : 0.2}
      />
    );
  }

  // Apply camera transformation
  return (
    <Group
      x={cam.x}
      y={cam.y}
      scaleX={cam.scale}
      scaleY={cam.scale}
      listening={false}
    >
      {lines}
    </Group>
  );
}

/**
 * MapImageLayer: Renders the background map image
 */
function MapImageLayer({
  cam,
  src,
  x = 0,
  y = 0,
}: {
  cam: Camera;
  src: string | null;
  x?: number;
  y?: number;
}) {
  const [img] = useImage(src || "", "anonymous");
  if (!img) return null;

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <KonvaImage image={img} x={x} y={y} listening={false} />
    </Group>
  );
}

/**
 * TokensLayer: Renders all player tokens
 * - Players can drag their own tokens
 * - Double-click to recolor
 * - Other players' tokens are non-interactive
 */
function TokensLayer({
  cam,
  tokens,
  uid,
  gridSize,
  hoveredTokenId,
  onHover,
  onMoveToken,
  onRecolorToken,
  onDeleteToken,
  snapToGrid,
}: {
  cam: Camera;
  tokens: Token[];
  uid: string;
  gridSize: number;
  hoveredTokenId: string | null;
  onHover: (id: string | null) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  onRecolorToken: (id: string) => void;
  onDeleteToken?: (id: string) => void;
  snapToGrid: boolean;
}) {
  const myTokens = tokens.filter((t) => t.owner === uid);
  const otherTokens = tokens.filter((t) => t.owner !== uid);

  const handleDrag = (tokenId: string, e: any) => {
    const pos = e.target.position();
    // Convert screen position to grid coordinates
    let gx, gy;
    if (snapToGrid) {
      gx = Math.round(pos.x / gridSize);
      gy = Math.round(pos.y / gridSize);
    } else {
      gx = pos.x / gridSize;
      gy = pos.y / gridSize;
    }
    onMoveToken(tokenId, gx, gy);
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {/* Render other players' tokens first */}
      {otherTokens.map((t) => (
        <Rect
          key={t.id}
          x={t.x * gridSize + gridSize / 4}
          y={t.y * gridSize + gridSize / 4}
          width={gridSize / 2}
          height={gridSize / 2}
          fill={t.color}
          stroke={hoveredTokenId === t.id ? "#aaa" : "none"}
          strokeWidth={2 / cam.scale}
          onMouseEnter={() => onHover(t.id)}
          onMouseLeave={() => onHover(null)}
        />
      ))}

      {/* Render my tokens last (on top) */}
      {myTokens.map((t) => (
        <Rect
          key={t.id}
          x={t.x * gridSize + gridSize / 4}
          y={t.y * gridSize + gridSize / 4}
          width={gridSize / 2}
          height={gridSize / 2}
          fill={t.color}
          stroke="#fff"
          strokeWidth={2 / cam.scale}
          draggable
          onDragEnd={(e) => handleDrag(t.id, e)}
          onMouseEnter={() => onHover(t.id)}
          onMouseLeave={() => onHover(null)}
          onDblClick={() => onRecolorToken(t.id)}
        />
      ))}
    </Group>
  );
}

/**
 * PointersLayer: Renders temporary pointer indicators
 * Shows player name and uses their token color
 */
function PointersLayer({
  cam,
  pointers,
  players,
  tokens,
}: {
  cam: Camera;
  pointers: Pointer[];
  players: Player[];
  tokens: Token[];
}) {
  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {pointers.map((pointer) => {
        const player = players.find((p) => p.uid === pointer.uid);
        const token = tokens.find((t) => t.owner === pointer.uid);
        return (
          <Group key={pointer.uid}>
            <Circle
              x={pointer.x}
              y={pointer.y}
              radius={20}
              fill={token?.color || "#fff"}
              opacity={0.6}
            />
            <Text
              x={pointer.x}
              y={pointer.y + 30}
              text={player?.name || "???"}
              fill={token?.color || "#fff"}
              fontSize={12 / cam.scale}
              fontStyle="bold"
              align="center"
              offsetX={30}
            />
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * DrawingsLayer: Renders all drawings (freehand, lines, shapes)
 * Includes both completed drawings and current drawing in progress
 */
function DrawingsLayer({
  cam,
  drawings,
  currentDrawing,
  currentTool,
  currentColor,
  currentWidth,
  currentOpacity,
  currentFilled,
}: {
  cam: Camera;
  drawings: Drawing[];
  currentDrawing: { x: number; y: number }[];
  currentTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  currentColor?: string;
  currentWidth?: number;
  currentOpacity?: number;
  currentFilled?: boolean;
}) {
  // Render a single completed drawing
  const renderDrawing = (drawing: Drawing) => {
    const points = drawing.points;

    if (drawing.type === "eraser") {
      // Eraser removes drawings, so render as white thick line in erase mode
      return (
        <Line
          key={drawing.id}
          points={points.flatMap((p: { x: number; y: number }) => [p.x, p.y])}
          stroke="#0b0d12"
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="destination-out"
        />
      );
    }

    if (drawing.type === "freehand") {
      return (
        <Line
          key={drawing.id}
          points={points.flatMap((p: { x: number; y: number }) => [p.x, p.y])}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          lineJoin="round"
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "line" && points.length >= 2) {
      return (
        <Line
          key={drawing.id}
          points={[points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y]}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "rect" && points.length >= 2) {
      const x1 = Math.min(points[0].x, points[points.length - 1].x);
      const y1 = Math.min(points[0].y, points[points.length - 1].y);
      const x2 = Math.max(points[0].x, points[points.length - 1].x);
      const y2 = Math.max(points[0].y, points[points.length - 1].y);

      return (
        <Rect
          key={drawing.id}
          x={x1}
          y={y1}
          width={x2 - x1}
          height={y2 - y1}
          fill={drawing.filled ? drawing.color : undefined}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "circle" && points.length >= 2) {
      const cx = points[0].x;
      const cy = points[0].y;
      const radius = Math.sqrt(
        Math.pow(points[points.length - 1].x - cx, 2) +
        Math.pow(points[points.length - 1].y - cy, 2)
      );

      return (
        <Circle
          key={drawing.id}
          x={cx}
          y={cy}
          radius={radius}
          fill={drawing.filled ? drawing.color : undefined}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          opacity={drawing.opacity}
        />
      );
    }

    return null;
  };

  // Render the current drawing in progress
  const renderCurrentDrawing = () => {
    if (currentDrawing.length === 0) return null;

    const color = currentColor || "#fff";
    const width = (currentWidth || 3) / cam.scale;
    const opacity = currentOpacity || 0.7;

    if (currentTool === "eraser") {
      return (
        <Line
          points={currentDrawing.flatMap((p: { x: number; y: number }) => [p.x, p.y])}
          stroke="#0b0d12"
          strokeWidth={width}
          lineCap="round"
          lineJoin="round"
          opacity={0.5}
        />
      );
    }

    if (currentTool === "freehand") {
      return (
        <Line
          points={currentDrawing.flatMap((p: { x: number; y: number }) => [p.x, p.y])}
          stroke={color}
          strokeWidth={width}
          lineCap="round"
          lineJoin="round"
          opacity={opacity}
        />
      );
    }

    if (currentTool === "line" && currentDrawing.length >= 2) {
      const start = currentDrawing[0];
      const end = currentDrawing[currentDrawing.length - 1];
      return (
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={color}
          strokeWidth={width}
          lineCap="round"
          opacity={opacity}
        />
      );
    }

    if (currentTool === "rect" && currentDrawing.length >= 2) {
      const start = currentDrawing[0];
      const end = currentDrawing[currentDrawing.length - 1];
      const x1 = Math.min(start.x, end.x);
      const y1 = Math.min(start.y, end.y);
      const x2 = Math.max(start.x, end.x);
      const y2 = Math.max(start.y, end.y);

      return (
        <Rect
          x={x1}
          y={y1}
          width={x2 - x1}
          height={y2 - y1}
          fill={currentFilled ? color : undefined}
          stroke={color}
          strokeWidth={width}
          opacity={opacity}
        />
      );
    }

    if (currentTool === "circle" && currentDrawing.length >= 2) {
      const start = currentDrawing[0];
      const end = currentDrawing[currentDrawing.length - 1];
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) +
        Math.pow(end.y - start.y, 2)
      );

      return (
        <Circle
          x={start.x}
          y={start.y}
          radius={radius}
          fill={currentFilled ? color : undefined}
          stroke={color}
          strokeWidth={width}
          opacity={opacity}
        />
      );
    }

    return null;
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {drawings.map((drawing) => renderDrawing(drawing))}
      {renderCurrentDrawing()}
    </Group>
  );
}

/**
 * MeasureLayer: Renders distance measurement tool
 * Shows line between two points with distance in grid units
 */
function MeasureLayer({
  cam,
  measureStart,
  measureEnd,
  gridSize,
}: {
  cam: Camera;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  gridSize: number;
}) {
  if (!measureStart || !measureEnd) return null;

  const distance = Math.sqrt(
    Math.pow(measureEnd.x - measureStart.x, 2) +
    Math.pow(measureEnd.y - measureStart.y, 2)
  );
  const units = Math.round((distance / gridSize) * 10) / 10;

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <Line
        points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]}
        stroke="#ff0"
        strokeWidth={2 / cam.scale}
        dash={[5 / cam.scale, 5 / cam.scale]}
      />
      <Circle x={measureStart.x} y={measureStart.y} radius={4 / cam.scale} fill="#ff0" />
      <Circle x={measureEnd.x} y={measureEnd.y} radius={4 / cam.scale} fill="#ff0" />
      <Text
        x={(measureStart.x + measureEnd.x) / 2}
        y={(measureStart.y + measureEnd.y) / 2 - 10}
        text={`${units} units`}
        fill="#ff0"
        fontSize={14 / cam.scale}
        fontStyle="bold"
        align="center"
        offsetX={30}
      />
    </Group>
  );
}

// ----------------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------------

interface MapBoardProps {
  snapshot: RoomSnapshot | null;        // Current room state
  sendMessage: (msg: ClientMessage) => void; // Function to send messages to server
  uid: string;                          // Current player's UID
  gridSize: number;                     // Synchronized grid size
  snapToGrid: boolean;                  // Whether to snap tokens to grid
  pointerMode: boolean;                 // Pointer tool active
  measureMode: boolean;                 // Measure tool active
  drawMode: boolean;                    // Draw tool active
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser"; // Active drawing tool
  drawColor: string;                    // Drawing color
  drawWidth: number;                    // Drawing brush size
  drawOpacity: number;                  // Drawing opacity (0-1)
  drawFilled: boolean;                  // Whether shapes are filled
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
    setGrid(prev => ({ ...prev, size: gridSize }));
  }, [gridSize]);

  // -------------------------------------------------------------------------
  // UNIFIED EVENT HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Unified stage click handler (pointer/measure tools)
   */
  const onStageClick = (e: any) => {
    if (!pointerMode && !measureMode && !drawMode) return;
    handlePointerClick(e);
  };

  /**
   * Unified mouse down handler (camera pan or drawing start)
   */
  const onMouseDown = (e: any) => {
    const shouldPan = !pointerMode && !measureMode && !drawMode;
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
    return "default";
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
        <Layer>
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
