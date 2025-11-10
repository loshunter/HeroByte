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
import { Stage, Layer, Circle, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCamera } from "../hooks/useCamera.js";
import { usePointerTool } from "../hooks/usePointerTool.js";
import { useDrawingTool } from "../hooks/useDrawingTool.js";
import { useDrawingSelection } from "../hooks/useDrawingSelection.js";
import { useElementSize } from "../hooks/useElementSize.js";
import { useGridConfig } from "../hooks/useGridConfig.js";
import { useCursorStyle } from "../hooks/useCursorStyle.js";
import { useSceneObjectsData } from "../hooks/useSceneObjectsData.js";
import { useKonvaNodeRefs } from "../hooks/useKonvaNodeRefs.js";
import { useMarqueeSelection } from "../hooks/useMarqueeSelection.js";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.js";
import { useAlignmentVisualization } from "../hooks/useAlignmentVisualization.js";
import {
  GridLayer,
  MapImageLayer,
  TokensLayer,
  PointersLayer,
  DrawingsLayer,
  MeasureLayer,
  TransformGizmo,
  PropsLayer,
  StagingZoneLayer,
} from "../features/map/components";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import type { CameraCommand, MapBoardProps, SelectionRequestOptions } from "./MapBoard.types";
import { STATUS_OPTIONS } from "../features/players/components/PlayerSettingsMenu";

// Re-export types for backward compatibility
export type { CameraCommand, MapBoardProps, SelectionRequestOptions };

// ----------------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------------

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

  const { sceneObjects, mapObject, drawingObjects, stagingZoneObject, stagingZoneDimensions } =
    useSceneObjectsData(snapshot, gridSize);

  const selectedObject = useMemo(
    () => sceneObjects.find((obj) => obj.id === selectedObjectId) || null,
    [sceneObjects, selectedObjectId],
  );

  // Build statusEffectsByOwner map from players array
  const statusEffectsByOwner = useMemo(() => {
    if (!snapshot?.players) return {};

    const result: Record<string, string> = {};
    for (const player of snapshot.players) {
      const statusEffects = player.statusEffects;
      if (!statusEffects || statusEffects.length === 0) continue;

      const activeEffect = statusEffects[0];
      if (!activeEffect) continue;

      // Find the emoji for this status effect
      const statusOption = STATUS_OPTIONS.find((opt) => opt.value === activeEffect);
      if (statusOption?.emoji) {
        result[player.uid] = statusOption.emoji;
      }
    }
    return result;
  }, [snapshot?.players]);

  const { registerNode, getSelectedNode, getAllNodes } = useKonvaNodeRefs(
    selectedObjectId,
    mapObject,
  );

  // Drawing selection
  const {
    selectedDrawingId,
    selectDrawing: handleSelectDrawing,
    deselectIfEmpty,
  } = useDrawingSelection({ selectMode, sendMessage, drawingObjects });

  const {
    isActive: isMarqueeActive,
    marqueeRect,
    handlePointerDown: handleMarqueePointerDown,
    handlePointerMove: handleMarqueePointerMove,
    handlePointerUp: handleMarqueePointerUp,
  } = useMarqueeSelection({
    stageRef,
    selectMode,
    pointerMode,
    measureMode,
    drawMode,
    getAllNodes,
    onSelectObject,
    onSelectObjects,
  });

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

  const {
    instruction: alignmentInstruction,
    previewPoints: alignmentPreviewPoints,
    previewLine: alignmentPreviewLine,
    suggestionLine: alignmentSuggestionLine,
    handleAlignmentClick,
  } = useAlignmentVisualization({
    alignmentMode,
    alignmentPoints,
    alignmentSuggestion,
    mapObject,
    toWorld,
    onAlignmentPointCapture,
  });

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
  const grid = useGridConfig(gridSize);

  useKeyboardNavigation({
    selectedDrawingId,
    selectMode,
    sendMessage,
    handleSelectDrawing,
    selectedObjectId,
    onSelectObject,
  });

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
    handleMarqueePointerDown(event);
  };

  /**
   * Unified mouse move handler (camera, drawing, measure)
   */
  const onMouseMove = () => {
    handleCameraMouseMove(stageRef);
    handlePointerMouseMove(stageRef);
    handleDrawMouseMove(stageRef);
    handleMarqueePointerMove();
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
  const cursor = useCursorStyle({
    isPanning,
    pointerMode,
    measureMode,
    drawMode,
    selectMode,
  });

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
      } else if (obj.type === "prop") {
        // For props, convert position from pixels to grid units (same as staging-zone)
        // Props are rendered with transform.x * gridSize, so position must be in grid units
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
    return getSelectedNode();
  }, [getSelectedNode]);

  // Callback to receive node reference from MapImageLayer
  const handleMapNodeReady = useCallback(
    (node: Konva.Node | null) => {
      if (mapObject) {
        registerNode(mapObject.id, node);
      }
    },
    [mapObject, registerNode],
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

  // Callback to receive node reference from TokensLayer
  const handleTokenNodeReady = useCallback(
    (tokenId: string, node: Konva.Node | null) => {
      registerNode(tokenId, node);
    },
    [registerNode],
  );

  // Callback to receive node reference from DrawingsLayer
  const handleDrawingNodeReady = useCallback(
    (drawingId: string, node: Konva.Node | null) => {
      registerNode(drawingId, node);
    },
    [registerNode],
  );

  // Callback to receive node reference from PropsLayer
  const handlePropNodeReady = useCallback(
    (propId: string, node: Konva.Node | null) => {
      registerNode(propId, node);
    },
    [registerNode],
  );

  const onMouseUp = () => {
    handleCameraMouseUp();
    handleDrawMouseUp();

    if (isMarqueeActive) {
      handleMarqueePointerUp();
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
      {alignmentMode && alignmentInstruction && (
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
          <div style={{ marginTop: "4px" }}>{alignmentInstruction}</div>
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
        style={{ cursor }}
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
          <StagingZoneLayer
            cam={cam}
            stagingZoneDimensions={stagingZoneDimensions}
            stagingZoneObject={stagingZoneObject}
            isDM={isDM}
            selectMode={selectMode}
            transformMode={transformMode}
            onSelectObject={onSelectObject}
            registerNode={registerNode}
          />
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
            statusEffectsByOwner={statusEffectsByOwner}
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
          {alignmentMode && alignmentPreviewPoints.length > 0 && (
            <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
              {alignmentPreviewPoints.map((point, index) => (
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
              {alignmentPreviewLine && (
                <Line
                  points={alignmentPreviewLine}
                  stroke="#facc15"
                  strokeWidth={2 / cam.scale}
                  dash={[8 / cam.scale, 6 / cam.scale]}
                  listening={false}
                />
              )}
              {alignmentSuggestionLine && (
                <Line
                  points={alignmentSuggestionLine}
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
