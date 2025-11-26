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
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
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
import { useObjectTransformHandlers } from "../hooks/useObjectTransformHandlers.js";
import { useCameraControl } from "../hooks/useCameraControl.js";
import { useTransformGizmoIntegration } from "../hooks/useTransformGizmoIntegration.js";
import { useStageEventRouter } from "../hooks/useStageEventRouter.js";
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
  AlignmentOverlay,
  AlignmentInstructionOverlay,
  MarqueeOverlay,
} from "../features/map/components";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import type { CameraCommand, MapBoardProps, SelectionRequestOptions } from "./MapBoard.types";
import { STATUS_OPTIONS, type StatusOption } from "../features/players/constants/statusOptions";

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

  // Build statusEffectsByTokenId map from characters array
  // Maps token IDs to their character's status effect details
  const statusEffectsByTokenId = useMemo(() => {
    if (!snapshot?.characters) return {};

    const playerStatusMap = new Map<string, string[]>();
    for (const player of snapshot.players ?? []) {
      if (player.statusEffects && player.statusEffects.length > 0) {
        playerStatusMap.set(player.uid, player.statusEffects);
      }
    }

    const result: Record<string, StatusOption[]> = {};
    for (const character of snapshot.characters) {
      if (!character.tokenId) continue;

      const ownedStatuses =
        character.statusEffects && character.statusEffects.length > 0
          ? character.statusEffects
          : character.ownedByPlayerUID
            ? (playerStatusMap.get(character.ownedByPlayerUID) ?? [])
            : [];

      if (ownedStatuses.length === 0) continue;

      const mapped = ownedStatuses.map((value) => {
        const option = STATUS_OPTIONS.find((opt) => opt.value === value);
        return option ?? { value, label: value, emoji: "?" };
      });

      result[`token:${character.tokenId}`] = mapped;
    }
    return result;
  }, [snapshot?.characters, snapshot?.players]);

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

  // Camera controls (pan/zoom) and command handling
  const {
    cam,
    isPanning,
    handleWheel,
    handleCameraMouseDown,
    handleCameraMouseMove,
    handleCameraMouseUp,
    toWorld,
  } = useCameraControl({
    cameraCommand,
    onCameraCommandHandled,
    snapshot,
    gridSize,
    w,
    h,
    onCameraChange,
  });

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

  // Object transform handlers
  const {
    handleTransformToken,
    handleTransformProp,
    handleTransformDrawing,
    handleGizmoTransform,
  } = useObjectTransformHandlers({
    onTransformObject,
    sceneObjects,
    gridSize: grid.size,
  });

  // Transform gizmo integration
  const { selectedObject, getSelectedNodeRef } = useTransformGizmoIntegration({
    sceneObjects,
    selectedObjectId,
    getSelectedNode,
  });

  // -------------------------------------------------------------------------
  // UNIFIED EVENT HANDLERS
  // -------------------------------------------------------------------------

  // Event router coordinates all mouse/pointer events across tools
  const { onStageClick, onMouseDown, onMouseMove, onMouseUp } = useStageEventRouter({
    alignmentMode,
    selectMode,
    pointerMode,
    measureMode,
    drawMode,
    handleAlignmentClick,
    handlePointerClick,
    handleCameraMouseDown,
    handleDrawMouseDown,
    handleMarqueePointerDown,
    handleCameraMouseMove,
    handlePointerMouseMove,
    handleDrawMouseMove,
    handleMarqueePointerMove,
    handleCameraMouseUp,
    handleDrawMouseUp,
    handleMarqueePointerUp,
    isMarqueeActive,
    onSelectObject,
    deselectIfEmpty,
    stageRef,
  });

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

  const handleRecolorToken = useCallback(
    (sceneId: string, owner?: string | null) => {
      onRecolorToken(sceneId, owner);
    },
    [onRecolorToken],
  );

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
      <AlignmentInstructionOverlay
        alignmentMode={alignmentMode}
        alignmentInstruction={alignmentInstruction}
      />

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
            onClick={transformMode ? handleMapClick : undefined}
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
            registerNode={registerNode as (id: string, node: unknown) => void}
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
            statusEffectsByTokenId={statusEffectsByTokenId}
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
          <AlignmentOverlay
            alignmentMode={alignmentMode}
            alignmentPreviewPoints={alignmentPreviewPoints}
            alignmentPreviewLine={alignmentPreviewLine}
            alignmentSuggestionLine={alignmentSuggestionLine}
            cam={cam}
          />
        </Layer>

        <MarqueeOverlay marqueeRect={marqueeRect} />

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
