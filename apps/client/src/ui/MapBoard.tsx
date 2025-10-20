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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Circle, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { RoomSnapshot, ClientMessage, SceneObject } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import { useCamera, type Camera } from "../hooks/useCamera.js";
import { usePointerTool } from "../hooks/usePointerTool.js";
import { useDrawingTool } from "../hooks/useDrawingTool.js";
import { useDrawingSelection } from "../hooks/useDrawingSelection.js";
import { useSceneObjects } from "../hooks/useSceneObjects.js";
import {
  GridLayer,
  MapImageLayer,
  TokensLayer,
  PointersLayer,
  DrawingsLayer,
  MeasureLayer,
  TransformGizmo,
  PropsLayer,
} from "../features/map/components";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";

export type CameraCommand = { type: "focus-token"; tokenId: string } | { type: "reset" };

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

function worldToMapLocal(
  world: { x: number; y: number },
  transform: SceneObject["transform"],
): { x: number; y: number } {
  const { x, y, scaleX, scaleY, rotation } = transform;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = world.x - x;
  const dy = world.y - y;

  const localX = (cos * dx + sin * dy) / (Math.abs(scaleX) < 1e-6 ? 1 : scaleX);
  const localY = (-sin * dx + cos * dy) / (Math.abs(scaleY) < 1e-6 ? 1 : scaleY);

  return { x: localX, y: localY };
}

// ----------------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------------

type SelectionRequestOptions = {
  mode?: "replace" | "append" | "toggle" | "subtract";
};

interface MapBoardProps {
  snapshot: RoomSnapshot | null; // Current room state
  sendMessage: (msg: ClientMessage) => void; // Function to send messages to server
  uid: string; // Current player's UID
  gridSize: number; // Synchronized grid size
  snapToGrid: boolean; // Whether to snap tokens to grid
  pointerMode: boolean; // Pointer tool active
  measureMode: boolean; // Measure tool active
  drawMode: boolean; // Draw tool active
  transformMode: boolean; // Transform tool active (gizmo mode)
  selectMode: boolean; // Selection tool active
  isDM: boolean; // Whether the current user can manage all objects
  alignmentMode: boolean; // Alignment tool active
  alignmentPoints?: AlignmentPoint[]; // Captured alignment points
  alignmentSuggestion?: AlignmentSuggestion | null; // Preview transform for alignment
  onAlignmentPointCapture?: (point: AlignmentPoint) => void;
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser"; // Active drawing tool
  drawColor: string; // Drawing color
  drawWidth: number; // Drawing brush size
  drawOpacity: number; // Drawing opacity (0-1)
  drawFilled: boolean; // Whether shapes are filled
  onRecolorToken: (sceneId: string, owner?: string | null) => void;
  onTransformObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  onDrawingComplete?: (drawingId: string) => void; // Called when a drawing is completed
  cameraCommand: CameraCommand | null;
  onCameraCommandHandled: () => void;
  selectedObjectId?: string | null; // Currently selected object for transform gizmo
  selectedObjectIds?: string[];
  onSelectObject?: (objectId: string | null, options?: SelectionRequestOptions) => void; // Selection handler
  onSelectObjects?: (objectIds: string[]) => void; // Batch selection handler
  onCameraChange?: (camera: Camera) => void; // Called when camera changes
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
  transformMode,
  selectMode,
  isDM,
  alignmentMode,
  alignmentPoints = [],
  alignmentSuggestion = null,
  onAlignmentPointCapture,
  drawTool,
  drawColor,
  drawWidth,
  drawOpacity,
  drawFilled,
  onRecolorToken,
  onTransformObject,
  onDrawingComplete,
  cameraCommand,
  onCameraCommandHandled,
  selectedObjectId = null,
  selectedObjectIds = [],
  onSelectObject,
  onCameraChange,
  onSelectObjects,
}: MapBoardProps) {
  // -------------------------------------------------------------------------
  // STATE & HOOKS
  // -------------------------------------------------------------------------

  const { ref, w, h } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);

  const sceneObjects = useSceneObjects(snapshot);
  const mapObject = useMemo(
    () => sceneObjects.find((object) => object.type === "map"),
    [sceneObjects],
  );
  const drawingObjects = useMemo(
    () =>
      sceneObjects.filter(
        (object): object is SceneObject & { type: "drawing" } => object.type === "drawing",
      ),
    [sceneObjects],
  );

  const stagingZoneObject = useMemo(
    () =>
      sceneObjects.find(
        (object): object is SceneObject & { type: "staging-zone" } =>
          object.type === "staging-zone",
      ) ?? null,
    [sceneObjects],
  );

  const stagingZoneDimensions = useMemo(() => {
    if (!stagingZoneObject) {
      console.log("[MapBoard] No staging zone object");
      return null;
    }

    console.log("[MapBoard] Staging zone:", {
      id: stagingZoneObject.id,
      x: stagingZoneObject.transform.x,
      y: stagingZoneObject.transform.y,
      scaleX: stagingZoneObject.transform.scaleX,
      scaleY: stagingZoneObject.transform.scaleY,
      rotation: stagingZoneObject.transform.rotation,
      width: stagingZoneObject.data.width,
      height: stagingZoneObject.data.height,
    });

    return {
      centerX: (stagingZoneObject.transform.x + 0.5) * gridSize,
      centerY: (stagingZoneObject.transform.y + 0.5) * gridSize,
      widthPx: stagingZoneObject.data.width * gridSize,
      heightPx: stagingZoneObject.data.height * gridSize,
      rotation: stagingZoneObject.transform.rotation,
      label: stagingZoneObject.data.label ?? "Player Staging Zone",
    };
  }, [gridSize, stagingZoneObject]);

  // Transform gizmo state
  const selectedObjectNodeRef = useRef<Konva.Node | null>(null);
  const selectedObject = useMemo(
    () => sceneObjects.find((obj) => obj.id === selectedObjectId) || null,
    [sceneObjects, selectedObjectId],
  );

  // Drawing selection
  const {
    selectedDrawingId,
    selectDrawing: handleSelectDrawing,
    deselectIfEmpty,
  } = useDrawingSelection({ selectMode, sendMessage, drawingObjects });

  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!selectMode) {
      setMarquee(null);
    }
  }, [selectMode]);

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

  // Notify parent when camera changes
  useEffect(() => {
    onCameraChange?.(cam);
  }, [cam, onCameraChange]);

  // Pointer and measure tool
  const {
    measureStart,
    measureEnd,
    onStageClick: handlePointerClick,
    onMouseMove: handlePointerMouseMove,
    pointerPreview,
  } = usePointerTool({
    pointerMode,
    measureMode,
    toWorld,
    sendMessage,
  });

  const handleAlignmentClick = useCallback(
    (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
      if (!alignmentMode || !onAlignmentPointCapture || !mapObject) {
        return;
      }

      const stage = event.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const world = toWorld(pointer.x, pointer.y);
      const local = worldToMapLocal(world, mapObject.transform);

      onAlignmentPointCapture({ world, local });
    },
    [alignmentMode, onAlignmentPointCapture, mapObject, toWorld],
  );

  // Drawing tool
  const {
    currentDrawing,
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
    drawingObjects,
  });

  // Token interaction
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  useEffect(() => {
    if (drawMode) {
      setHoveredTokenId(null);
    }
  }, [drawMode]);

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

  // Delete key handler for selected objects (drawings via select tool, or any object via transform gizmo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Delete") {
        // Priority 1: Delete selected drawing (via select tool)
        if (selectedDrawingId && selectMode) {
          sendMessage({ t: "delete-drawing", id: selectedDrawingId });
          handleSelectDrawing(null);
          return;
        }

        // Priority 2: Delete selected object now handled in App.tsx
        // (App.tsx has DM check and proper permission handling)
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedDrawingId,
    selectMode,
    sendMessage,
    handleSelectDrawing,
    selectedObjectId,
    onSelectObject,
    sceneObjects,
  ]);

  // ESC key handler to deselect transform gizmo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedObjectId && onSelectObject) {
        onSelectObject(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, onSelectObject]);

  // -------------------------------------------------------------------------
  // UNIFIED EVENT HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Unified stage click handler (pointer/measure tools)
   */
  const onStageClick = (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
    if (alignmentMode) {
      handleAlignmentClick(event);
      return;
    }

    // In select mode, marquee selection handles everything - don't process stage clicks
    if (selectMode) {
      return;
    }

    if (!pointerMode && !measureMode && !drawMode) {
      if (onSelectObject) {
        const stage = event.target.getStage();
        if (stage && event.target === stage) {
          onSelectObject(null);
        }
      }
      deselectIfEmpty(event);
      return;
    }
    handlePointerClick(event);
  };

  /**
   * Unified mouse down handler (camera pan, drawing)
   */
  const onMouseDown = (event: KonvaEventObject<PointerEvent>) => {
    const shouldPan = !alignmentMode && !pointerMode && !measureMode && !drawMode && !selectMode;
    handleCameraMouseDown(event, stageRef, shouldPan);
    handleDrawMouseDown(stageRef);

    if (
      selectMode &&
      !pointerMode &&
      !measureMode &&
      !drawMode &&
      event.evt.button === 0 &&
      stageRef.current
    ) {
      const pointer = stageRef.current.getPointerPosition();
      if (pointer && event.target === stageRef.current) {
        setMarquee({ start: pointer, current: pointer });
      }
    }
  };

  /**
   * Unified mouse move handler (camera, drawing, measure)
   */
  const onMouseMove = () => {
    handleCameraMouseMove(stageRef);
    handlePointerMouseMove(stageRef);
    handleDrawMouseMove(stageRef);

    if (marquee && stageRef.current) {
      const pointer = stageRef.current.getPointerPosition();
      if (pointer) {
        setMarquee((prev) => (prev ? { ...prev, current: pointer } : prev));
      }
    }
  };

  /**
   * Unified mouse up handler (camera, drawing)
   */
  // Camera command handler
  useEffect(() => {
    if (!cameraCommand) return;

    if (cameraCommand.type === "reset") {
      setCam((prev) => ({ ...prev, x: 0, y: 0, scale: 1 }));
      onCameraCommandHandled();
      return;
    }

    if (cameraCommand.type === "focus-token") {
      const token = snapshot?.tokens?.find((t) => t.id === cameraCommand.tokenId);
      if (!token) {
        window.alert("Token not found.");
        onCameraCommandHandled();
        return;
      }

      setCam((prevCam) => {
        const scale = prevCam.scale;
        const centerX = token.x * gridSize + gridSize / 2;
        const centerY = token.y * gridSize + gridSize / 2;
        const newX = w / 2 - centerX * scale;
        const newY = h / 2 - centerY * scale;
        return { ...prevCam, x: newX, y: newY };
      });

      onCameraCommandHandled();
    }
  }, [cameraCommand, gridSize, onCameraCommandHandled, setCam, snapshot?.tokens, w, h]);

  /**
   * Determine cursor style based on active mode
   */
  const getCursor = () => {
    if (isPanning) return "grabbing";
    if (pointerMode) return "none";
    if (measureMode) return "crosshair";
    if (drawMode) return "crosshair";
    if (selectMode) return "default";
    return "grab";
  };

  const tokenInteractionsEnabled = !drawMode;

  const handleTransformToken = useCallback(
    (sceneId: string, position: { x: number; y: number }) => {
      onTransformObject({ id: sceneId, position });
    },
    [onTransformObject],
  );

  const handleTransformProp = useCallback(
    (sceneId: string, position: { x: number; y: number }) => {
      onTransformObject({ id: sceneId, position });
    },
    [onTransformObject],
  );

  const handleTransformDrawing = useCallback(
    (sceneId: string, transform: { position?: { x: number; y: number } }) => {
      onTransformObject({ id: sceneId, ...transform });
    },
    [onTransformObject],
  );

  const handleRecolorToken = useCallback(
    (sceneId: string, owner?: string | null) => {
      onRecolorToken(sceneId, owner);
    },
    [onRecolorToken],
  );

  // Transform gizmo handlers
  const handleGizmoTransform = useCallback(
    (transform: {
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
    }) => {
      // Find the object to determine its type
      const obj = sceneObjects.find((o) => o.id === transform.id);

      if (!obj) {
        console.warn(`Object ${transform.id} not found`);
        return;
      }

      // For tokens, don't send position (it's in grid coords, not pixels)
      // Only send scale and rotation
      if (obj.type === "token") {
        onTransformObject({
          id: transform.id,
          scale: transform.scale,
          rotation: transform.rotation,
          // Position should only be updated via dragging (which handles grid snapping)
        });
      } else if (obj.type === "staging-zone") {
        // For staging zone, convert position from pixels to grid units
        onTransformObject({
          id: transform.id,
          position: transform.position
            ? { x: transform.position.x / gridSize, y: transform.position.y / gridSize }
            : undefined,
          scale: transform.scale,
          rotation: transform.rotation,
        });
      } else {
        // For map and drawings, send full transform
        onTransformObject(transform);
      }
    },
    [onTransformObject, sceneObjects],
  );

  const getSelectedNodeRef = useCallback(() => {
    return selectedObjectNodeRef.current;
  }, []);

  // Callback to receive node reference from MapImageLayer
  const handleMapNodeReady = useCallback(
    (node: Konva.Node | null) => {
      if (mapObject) {
        if (node) {
          nodeRefsMap.current.set(mapObject.id, node);
        } else {
          nodeRefsMap.current.delete(mapObject.id);
        }
      }
    },
    [mapObject],
  );

  // Click handler to select the map (only in transform mode)
  const handleMapClick = useCallback(() => {
    // Only allow selection when transform mode is active
    if (!transformMode) {
      return;
    }
    // Don't select if other tools are active
    if (pointerMode || measureMode || drawMode || selectMode) {
      return;
    }
    if (mapObject && onSelectObject) {
      onSelectObject(mapObject.id);
    }
  }, [mapObject, onSelectObject, transformMode, pointerMode, measureMode, drawMode, selectMode]);

  // Store all node refs (keyed by object ID)
  const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());

  // Clear the selected node ref when selection changes
  useEffect(() => {
    if (selectedObjectId) {
      const node = nodeRefsMap.current.get(selectedObjectId);
      selectedObjectNodeRef.current = node || null;
    } else {
      selectedObjectNodeRef.current = null;
    }
  }, [selectedObjectId]);

  // Callback to receive node reference from TokensLayer
  const handleTokenNodeReady = useCallback((tokenId: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefsMap.current.set(tokenId, node);
    } else {
      nodeRefsMap.current.delete(tokenId);
    }
  }, []);

  // Callback to receive node reference from DrawingsLayer
  const handleDrawingNodeReady = useCallback((drawingId: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefsMap.current.set(drawingId, node);
    } else {
      nodeRefsMap.current.delete(drawingId);
    }
  }, []);

  // Callback to receive node reference from PropsLayer
  const handlePropNodeReady = useCallback((propId: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefsMap.current.set(propId, node);
    } else {
      nodeRefsMap.current.delete(propId);
    }
  }, []);

  const applyMarqueeSelection = useCallback(() => {
    if (!marquee || !stageRef.current) {
      return;
    }

    const { start, current } = marquee;
    const minX = Math.min(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const maxX = Math.max(start.x, current.x);
    const maxY = Math.max(start.y, current.y);

    const width = maxX - minX;
    const height = maxY - minY;

    const matches: string[] = [];

    nodeRefsMap.current.forEach((node, id) => {
      if (
        !node ||
        (!id.startsWith("token:") && !id.startsWith("drawing:") && !id.startsWith("prop:"))
      ) {
        return;
      }

      const rect = node.getClientRect({ relativeTo: stageRef.current! });
      const nodeMinX = rect.x;
      const nodeMinY = rect.y;
      const nodeMaxX = rect.x + rect.width;
      const nodeMaxY = rect.y + rect.height;

      const intersects =
        nodeMinX <= maxX && nodeMaxX >= minX && nodeMinY <= maxY && nodeMaxY >= minY;

      if (intersects) {
        matches.push(id);
      }
    });

    // If the marquee is very small (likely a click) and no objects were found, deselect
    if (width < 4 && height < 4 && matches.length === 0) {
      console.log("[Marquee] Small marquee, no matches - deselecting");
      onSelectObject?.(null);
      return;
    }

    // If no objects were found in a larger marquee, also deselect
    if (matches.length === 0) {
      console.log("[Marquee] No matches found - deselecting");
      onSelectObject?.(null);
      return;
    }

    console.log("[Marquee] Selecting", matches.length, "objects:", matches);
    if (onSelectObjects) {
      onSelectObjects(matches);
    } else if (onSelectObject) {
      matches.forEach((id, index) => {
        onSelectObject(id, { mode: index === 0 ? "replace" : "append" });
      });
    }
  }, [marquee, onSelectObject, onSelectObjects]);

  const marqueeRect = useMemo(() => {
    if (!marquee) {
      return null;
    }
    const { start, current } = marquee;
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(start.x - current.x),
      height: Math.abs(start.y - current.y),
    };
  }, [marquee]);

  const onMouseUp = () => {
    handleCameraMouseUp();
    handleDrawMouseUp();

    if (marquee) {
      applyMarqueeSelection();
      setMarquee(null);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  // E2E testing support (dev-only) - enriched with camera/viewport
  useE2ETestingSupport({
    snapshot,
    uid,
    gridSize,
    cam,
    viewport: { width: w, height: h },
  });

  return (
    <div
      ref={ref}
      className="map-canvas-wrapper"
      data-testid="map-board"
      style={{
        width: "100%",
        height: "100%",
        color: "#dbe1ff",
        position: "relative",
      }}
    >
      {alignmentMode && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "rgba(12, 18, 38, 0.9)",
            border: "1px solid var(--jrpg-border-gold)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "10px",
            lineHeight: 1.4,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <strong style={{ color: "var(--jrpg-gold)" }}>Alignment Mode</strong>
          <div style={{ marginTop: "4px" }}>
            {alignmentPoints.length === 0 && "Click the first corner of a map square."}
            {alignmentPoints.length === 1 && "Click the opposite corner of the same square."}
            {alignmentPoints.length >= 2 && "Review the preview and apply when ready."}
          </div>
        </div>
      )}

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
        <Layer>
          <MapImageLayer
            cam={cam}
            src={mapObject?.data.imageUrl ?? snapshot?.mapBackground ?? null}
            transform={mapObject?.transform}
            onNodeReady={handleMapNodeReady}
            onClick={handleMapClick}
          />
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
          {stagingZoneDimensions && stagingZoneObject ? (
            <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
              <Group
                x={stagingZoneDimensions.centerX}
                y={stagingZoneDimensions.centerY}
                rotation={stagingZoneDimensions.rotation}
                scaleX={stagingZoneObject.transform.scaleX || 1}
                scaleY={stagingZoneObject.transform.scaleY || 1}
                ref={(node) => {
                  if (node && stagingZoneObject && selectedObjectId === stagingZoneObject.id) {
                    selectedObjectNodeRef.current = node;
                  }
                }}
              >
                <Rect
                  x={-stagingZoneDimensions.widthPx / 2}
                  y={-stagingZoneDimensions.heightPx / 2}
                  width={stagingZoneDimensions.widthPx}
                  height={stagingZoneDimensions.heightPx}
                  stroke="rgba(77, 229, 192, 0.75)"
                  strokeWidth={2 / cam.scale}
                  dash={[8 / cam.scale, 6 / cam.scale]}
                  fill="rgba(77, 229, 192, 0.12)"
                  cornerRadius={8 / cam.scale}
                  listening={isDM && (selectMode || transformMode)}
                  onClick={(e) => {
                    if (isDM && (selectMode || transformMode)) {
                      e.cancelBubble = true;
                      onSelectObject?.(stagingZoneObject.id);
                    }
                  }}
                  onTap={(e) => {
                    if (isDM && (selectMode || transformMode)) {
                      e.cancelBubble = true;
                      onSelectObject?.(stagingZoneObject.id);
                    }
                  }}
                />
                <Text
                  text={stagingZoneDimensions.label}
                  fontSize={14 / cam.scale}
                  fill="#4de5c0"
                  align="center"
                  width={stagingZoneDimensions.widthPx}
                  x={-stagingZoneDimensions.widthPx / 2}
                  y={-stagingZoneDimensions.heightPx / 2 - 18 / cam.scale}
                  listening={false}
                />
              </Group>
            </Group>
          ) : null}
          <DrawingsLayer
            cam={cam}
            drawingObjects={drawingObjects}
            currentDrawing={currentDrawing}
            currentTool={drawTool}
            currentColor={drawColor}
            currentWidth={drawWidth}
            currentOpacity={drawOpacity}
            currentFilled={drawFilled}
            uid={uid}
            selectMode={selectMode}
            transformMode={transformMode}
            canManageAllDrawings={isDM}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={handleSelectDrawing}
            onTransformDrawing={handleTransformDrawing}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={onSelectObject}
            onDrawingNodeReady={handleDrawingNodeReady}
          />
          <PropsLayer
            cam={cam}
            sceneObjects={sceneObjects}
            gridSize={grid.size}
            interactive={!measureMode}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={onSelectObject}
            onPropNodeReady={handlePropNodeReady}
            onTransformProp={handleTransformProp}
          />
          <TokensLayer
            cam={cam}
            sceneObjects={sceneObjects}
            uid={uid}
            gridSize={grid.size}
            hoveredTokenId={hoveredTokenId}
            onHover={setHoveredTokenId}
            onTransformToken={handleTransformToken}
            onRecolorToken={handleRecolorToken}
            snapToGrid={snapToGrid}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={onSelectObject}
            onTokenNodeReady={handleTokenNodeReady}
            interactionsEnabled={tokenInteractionsEnabled}
          />
        </Layer>

        {/* Overlay Layer: Pointers and measure tool (top-most) */}
        <Layer listening={false}>
          <PointersLayer
            cam={cam}
            pointers={snapshot?.pointers || []}
            players={snapshot?.players || []}
            tokens={snapshot?.tokens || []}
            preview={pointerPreview}
            previewUid={uid}
            pointerMode={pointerMode}
          />
          <MeasureLayer
            cam={cam}
            measureStart={measureStart}
            measureEnd={measureEnd}
            gridSize={grid.size}
            gridSquareSize={snapshot?.gridSquareSize}
          />
          {alignmentMode && alignmentPoints.length > 0 && (
            <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
              {alignmentPoints.slice(0, 2).map((point, index) => (
                <Group key={`align-point-${index}`}>
                  <Circle
                    x={point.world.x}
                    y={point.world.y}
                    radius={8 / cam.scale}
                    stroke="#facc15"
                    strokeWidth={2 / cam.scale}
                    fill="rgba(250, 204, 21, 0.2)"
                  />
                  <Text
                    text={`${index + 1}`}
                    x={point.world.x + 6 / cam.scale}
                    y={point.world.y - 18 / cam.scale}
                    fontSize={12 / cam.scale}
                    fill="#facc15"
                    listening={false}
                  />
                </Group>
              ))}
              {alignmentPoints.length === 2 && (
                <Line
                  points={[
                    alignmentPoints[0].world.x,
                    alignmentPoints[0].world.y,
                    alignmentPoints[1].world.x,
                    alignmentPoints[1].world.y,
                  ]}
                  stroke="#facc15"
                  strokeWidth={2 / cam.scale}
                  dash={[8 / cam.scale, 6 / cam.scale]}
                  listening={false}
                />
              )}
              {alignmentSuggestion && (
                <Line
                  points={[
                    alignmentSuggestion.targetA.x,
                    alignmentSuggestion.targetA.y,
                    alignmentSuggestion.targetB.x,
                    alignmentSuggestion.targetB.y,
                  ]}
                  stroke="#4de5c0"
                  strokeWidth={2 / cam.scale}
                  dash={[4 / cam.scale, 6 / cam.scale]}
                  listening={false}
                />
              )}
            </Group>
          )}
        </Layer>

        {marqueeRect && (
          <Layer listening={false}>
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              stroke="#4de5c0"
              dash={[8, 4]}
              strokeWidth={1.5}
              fill="rgba(77, 229, 192, 0.15)"
            />
          </Layer>
        )}

        {/* Transform Gizmo Layer: Visual handles for selected objects (only in transform mode) */}
        {transformMode && (
          <Layer>
            <TransformGizmo
              selectedObject={selectedObject}
              onTransform={handleGizmoTransform}
              getNodeRef={getSelectedNodeRef}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
}
