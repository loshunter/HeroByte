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
import type { CompiledDoorState, DragPreviewUpdate } from "@herobyte/shared";
import { buildTokenPlates } from "../features/map/tokenPlates";
import { ENABLE_DRAG_PREVIEWS } from "../config.js";
import { usePointerTool } from "../hooks/usePointerTool.js";
import { useDrawingTool } from "../hooks/useDrawingTool.js";
import { useDrawingSelection } from "../hooks/useDrawingSelection.js";
import { useElementSize } from "../hooks/useElementSize.js";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
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
  TerrainLayer,
  MapElementsLayer,
  DoorsLayer,
  FogLayer,
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
  withEmissiveLights,
} from "../features/map/components";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import { useMapEditTool } from "../features/map-edit/useMapEditTool";
import { isTouchTool } from "../features/map-edit/mapEditToolKinds";
import { MapEditPreviewLayer } from "../features/map-edit/MapEditPreviewLayer";
import { MapEditQuickWheel } from "../features/map-edit/MapEditQuickWheel";
import { dmViewActive, fogViewers, visibleDoors } from "../features/map/playerLens";
import { exploredFogKey } from "../features/map/exploredFogStore";
import { currentRoomId } from "../features/rooms/roomDirectory";
import { WallsOverlayLayer } from "../features/map-edit/WallsOverlayLayer";
import { NotesOverlayLayer } from "../features/map-edit/NotesOverlayLayer";
import { MapTransitionOverlay } from "../features/map/MapTransitionOverlay";
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
  remoteMeasurements,
  drawMode,
  transformMode,
  selectMode,
  mapEditMode = false,
  mapEditActiveSubTool = "wall",
  mapEditFloorFamily = "grass",
  mapEditRoomWallFamily = "none",
  mapEditSelectedAssetId = "objects:crate",
  mapEditPlacementDials,
  mapEditHallwayWidth = 2,
  mapEditSplineKind = "rope",
  mapEditPopulateGhosts = null,
  mapEditWheelActions,
  playerLens = false,
  mapEditSelectedElementId = null,
  mapEditController,
  mapEditWallsOverlayPinned = false,
  onMapEditRoomRejected,
  onMapEditGestureDropped,
  onMapEditRegionPlaced,
  onMapEditRegionDragged,
  onMapEditSelectElement,
  onMapEditSampleAsset,
  mapEditCancelSignal,
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
  // Render the stage's backing store at native device resolution (crisp on
  // retina/mobile) — the terrain bake stays document-px, so Konva blits it into
  // this DPR-scaled context without inflating the bake's own memory caps.
  const pixelRatio = useDevicePixelRatio();

  const { sceneObjects, mapObject, drawingObjects, stagingZoneObject, stagingZoneDimensions } =
    useSceneObjectsData(snapshot, gridSize);

  // Where THIS player's memory of THIS map on THIS table is kept (S7). The uid
  // segment is what stops a DM's player-lens session — which sees the party's
  // union, not any one player's — from writing into a player's memory.
  const exploredStorageKey = useMemo(() => {
    const documentId = snapshot?.compiledScene?.sourceDocumentId;
    if (!documentId || !uid) return null;
    return exploredFogKey(currentRoomId(), uid, documentId);
  }, [snapshot?.compiledScene?.sourceDocumentId, uid]);

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

  // Current HP per token, so the tokens layer can mirror the card's damage/heal
  // feedback. Tokens link to entities via character.tokenId, and character HP is
  // authoritative for token-linked entities (see update-character-hp).
  const hpByTokenId = useMemo(() => {
    const result: Record<string, number> = {};
    const lensRedact = Boolean(isDM && playerLens);
    const hpMode = snapshot?.monsterHpDisplay ?? "exact";
    for (const character of snapshot?.characters ?? []) {
      if (!character.tokenId) continue;
      // Redacted NPCs (monsterHpDisplay bloodied/hidden) arrive without hp —
      // no entry means no damage-flash feedback, which is the point. The
      // player lens applies the same rule to the DM's own numbers, so the
      // preview does not flash exact damage a player would never see.
      if (character.hp === undefined) continue;
      if (lensRedact && character.type === "npc" && hpMode !== "exact") continue;
      result[`token:${character.tokenId}`] = character.hp;
    }
    return result;
  }, [snapshot?.characters, snapshot?.monsterHpDisplay, isDM, playerLens]);

  // S4 nameplates: name + HP per token. Characters win (their name is the
  // display name for PC and NPC tokens alike — token.owner would put the DM's
  // name under every monster); unlinked tokens fall back to the owner's player
  // name. The player lens simulates the server's NPC redaction with the SAME
  // shared hpBadgeFor the recipient filter uses, so a DM previews exactly what
  // players receive.
  const platesByTokenId = useMemo(
    () =>
      buildTokenPlates({
        characters: snapshot?.characters ?? [],
        tokens: snapshot?.tokens ?? [],
        players: snapshot?.players ?? [],
        monsterHpDisplay: snapshot?.monsterHpDisplay ?? "exact",
        lensRedact: Boolean(isDM && playerLens),
      }),
    [
      snapshot?.characters,
      snapshot?.tokens,
      snapshot?.players,
      snapshot?.monsterHpDisplay,
      isDM,
      playerLens,
    ],
  );

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
    cancelMarquee: handleMarqueeCancel,
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
    handleTouchStart: handleCameraTouchStart,
    handleTouchMove: handleCameraTouchMove,
    handleTouchEnd: handleCameraTouchEnd,
    toWorld,
    setCam,
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
    currentTemplate,
    onMouseDown: handleDrawMouseDown,
    onMouseMove: handleDrawMouseMove,
    onMouseUp: handleDrawMouseUp,
    cancel: handleDrawCancel,
  } = useDrawingTool({
    drawMode,
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    // The prop, not `grid.size`: useGridConfig mirrors this value through
    // state (so it trails by one render after a resize) and is declared
    // further down the file anyway.
    gridSize,
    gridSquareSize: snapshot?.gridSquareSize ?? 5,
    toWorld,
    sendMessage,
    onDrawingComplete,
    drawingObjects,
  });

  // Live map-edit tool (wall/door/room drag + terrain brush). Self-gates on mode.
  const {
    previewDrag: mapEditPreviewDrag,
    strokeCells: mapEditStrokeCells,
    placementGhost: mapEditPlacementGhost,
    draftGhosts: mapEditDraftGhosts,
    selectionShape: mapEditSelectionRect,
    onMouseDown: handleMapEditMouseDown,
    onMouseMove: handleMapEditMouseMove,
    onMouseUp: handleMapEditMouseUp,
    onCancel: handleMapEditCancel,
  } = useMapEditTool({
    mapEditMode,
    activeSubTool: mapEditActiveSubTool,
    controller: mapEditController,
    liveDocumentId: snapshot?.liveMapDocumentId,
    floorFamily: mapEditFloorFamily,
    roomWallFamily: mapEditRoomWallFamily,
    selectedAssetId: mapEditSelectedAssetId,
    stampMode: mapEditPlacementDials?.stampMode,
    stampRotation: mapEditPlacementDials?.stampRotation,
    onRotateStamp: mapEditPlacementDials?.onRotateStamp,
    hallwayWidth: mapEditHallwayWidth,
    splineKind: mapEditSplineKind,
    selectedElementId: mapEditSelectedElementId,
    onRoomRejected: onMapEditRoomRejected,
    onGestureDropped: onMapEditGestureDropped,
    onRegionPlaced: onMapEditRegionPlaced,
    onRegionDragged: onMapEditRegionDragged,
    onSelectElement: onMapEditSelectElement,
    onSampleAsset: onMapEditSampleAsset,
    cancelSignal: mapEditCancelSignal,
    toWorld,
    mapTransform: mapObject?.transform,
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

  /**
   * Handle double tap to ping
   * Triggered regardless of tool mode to allow quick communication
   */
  const handleDoubleTap = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const world = toWorld(pointer.x, pointer.y);
      sendMessage({ t: "point", x: world.x, y: world.y });
    },
    [toWorld, sendMessage],
  );

  // Event router coordinates all mouse/pointer events across tools
  const {
    onStageClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTap,
  } = useStageEventRouter({
    alignmentMode,
    selectMode,
    pointerMode,
    measureMode,
    drawMode,
    mapEditMode,
    // Drag and brush sub-tools take the finger — useArmedTouchTool explains
    // why the click ones would double-fire through the compat mouse path.
    mapEditTouchMode: mapEditMode && isTouchTool(mapEditActiveSubTool),
    handleAlignmentClick,
    handlePointerClick,
    handleCameraMouseDown,
    handleDrawMouseDown,
    handleMapEditMouseDown,
    handleMarqueePointerDown,
    handleCameraMouseMove,
    handlePointerMouseMove,
    handleDrawMouseMove,
    handleMapEditMouseMove,
    handleMarqueePointerMove,
    handleCameraMouseUp,
    handleDrawMouseUp,
    handleMapEditMouseUp,
    handleMarqueePointerUp,
    handleDrawCancel,
    handleMarqueeCancel,
    handleMapEditCancel,
    handleTouchStart: handleCameraTouchStart,
    handleTouchMove: handleCameraTouchMove,
    handleTouchEnd: handleCameraTouchEnd,
    handleDoubleTap,
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
    mapEditMode,
  });

  const tokenInteractionsEnabled = !drawMode && !mapEditMode;
  // Player lens (P4): a VIEW toggle only — DM chrome and DM-only data render
  // off dmView, while permissions/actions keep using isDM.
  const dmView = dmViewActive(isDM, playerLens);

  // Quick wheel (P5): right-click on the canvas in map-edit mode opens the
  // radial tool/brush menu at the cursor; leaving the mode drops it.
  const [wheelAt, setWheelAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!mapEditMode) setWheelAt(null);
  }, [mapEditMode]);
  const dragPreviewEnabled = ENABLE_DRAG_PREVIEWS;

  const handleDragPreview = useCallback(
    (updates: DragPreviewUpdate[]) => {
      if (!updates || updates.length === 0) {
        return;
      }
      if (!dragPreviewEnabled) {
        return;
      }
      sendMessage({ t: "drag-preview", objects: updates });
    },
    [sendMessage, dragPreviewEnabled],
  );

  const handleRecolorToken = useCallback(
    (sceneId: string, owner?: string | null) => {
      onRecolorToken(sceneId, owner);
    },
    [onRecolorToken],
  );

  // Door interactions route straight to the server; the snapshot broadcast
  // updates every client's door sprites.
  const handleToggleDoor = useCallback(
    (doorId: string) => {
      sendMessage({ t: "toggle-door", doorId });
    },
    [sendMessage],
  );

  const handleSetDoorState = useCallback(
    (doorId: string, state: CompiledDoorState) => {
      sendMessage({ t: "set-door-state", doorId, state });
    },
    [sendMessage],
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
    setCam,
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
      onContextMenu={(event) => {
        // Quick wheel (P5): map-edit only — token context menus and the
        // browser menu keep every other mode.
        if (!mapEditMode || !mapEditWheelActions) return;
        event.preventDefault();
        setWheelAt({ x: event.clientX, y: event.clientY });
      }}
    >
      <AlignmentInstructionOverlay
        alignmentMode={alignmentMode}
        alignmentInstruction={alignmentInstruction}
      />
      {/* The iris on travel — keyed on the PLAYER-visible scene id, never the
          DM-only binding. A DOM overlay above the Stage: no Konva, no pixels
          of the old frame (see the component's header). */}
      <MapTransitionOverlay sourceDocumentId={snapshot?.compiledScene?.sourceDocumentId} />
      {wheelAt && mapEditWheelActions && (
        <MapEditQuickWheel
          x={wheelAt.x}
          y={wheelAt.y}
          activeSubTool={mapEditActiveSubTool}
          floorFamily={mapEditFloorFamily}
          onSelectSubTool={mapEditWheelActions.selectSubTool}
          onSelectFloorFamily={mapEditWheelActions.selectFloorFamily}
          onClose={() => setWheelAt(null)}
        />
      )}

      {/* Stage is the viewport; world content is translated/scaled by cam in child Groups */}
      <Stage
        ref={stageRef}
        width={w}
        height={h}
        pixelRatio={pixelRatio}
        onWheel={(e) => handleWheel(e, stageRef)}
        onClick={onStageClick}
        onTap={onTap}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor }}
      >
        {/* Background Layer: Map image and grid (non-interactive) */}
        <Layer>
          {/* Published painted terrain draws UNDER the elements-only background
              so uploaded/legacy full backgrounds (no mapTerrain) are untouched. */}
          {snapshot?.mapTerrain && (
            <TerrainLayer
              cam={cam}
              mapTerrain={snapshot.mapTerrain}
              lighting={withEmissiveLights(snapshot.mapElements)}
              mapTransform={mapObject?.transform}
            />
          )}
          <MapImageLayer
            cam={cam}
            src={mapObject?.data.imageUrl ?? snapshot?.mapBackground ?? null}
            transform={mapObject?.transform}
            onNodeReady={handleMapNodeReady}
            onClick={transformMode ? handleMapClick : undefined}
          />
          {/* Live-authored scenery (privacy-filtered server-side) draws ABOVE
              terrain + any raster background, UNDER the grid. Inert to input. */}
          {snapshot?.mapElements && (
            <MapElementsLayer
              cam={cam}
              mapElements={snapshot.mapElements}
              mapTransform={mapObject?.transform}
            />
          )}
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
          {snapshot?.compiledScene && snapshot.compiledScene.doors.length > 0 && (
            <DoorsLayer
              cam={cam}
              // Player lens (P4): mirror the server's per-recipient strip —
              // a player snapshot never contains a secret door.
              doors={visibleDoors(snapshot.compiledScene.doors, dmView)}
              mapTransform={mapObject?.transform}
              isDM={dmView}
              onToggleDoor={handleToggleDoor}
              onSetDoorState={handleSetDoorState}
              // Select and Sample resolve on the compat mouse pair, which a
              // LISTENING door hit line preventDefaults away — the door must
              // yield the press to the stage while either is armed.
              selectArmed={
                mapEditMode &&
                (mapEditActiveSubTool === "select" || mapEditActiveSubTool === "eyedropper")
              }
            />
          )}
          {/* DM-only walls overlay: shown while authoring, or pinned to persist. */}
          {dmView && (mapEditMode || mapEditWallsOverlayPinned) && snapshot?.compiledScene && (
            <WallsOverlayLayer
              cam={cam}
              mapTransform={mapObject?.transform}
              walls={snapshot.compiledScene.walls}
            />
          )}
          {/* DM-only GM notes (generated spawn/loot keys). Read from the live
              document — notes are stripped from every snapshot by design. */}
          {dmView && mapEditMode && (
            <NotesOverlayLayer
              cam={cam}
              mapTransform={mapObject?.transform}
              document={mapEditController?.activeDocument ?? null}
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
            currentTemplate={currentTemplate}
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
            interactive={!measureMode && !mapEditMode}
            uid={uid}
            canManageAllProps={isDM}
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
            onDragPreview={dragPreviewEnabled ? handleDragPreview : undefined}
            statusEffectsByTokenId={statusEffectsByTokenId}
            hpByTokenId={hpByTokenId}
            platesByTokenId={platesByTokenId}
            isDM={isDM}
          />
        </Layer>

        {/* Fog of war: players see only what their own tokens can see.
            Token positions are grid cells; vision origins are their world-
            pixel centers, matching the renderer. The player lens (P4) turns
            fog ON for the DM with the party's union vision (fogViewers), and
            each viewer clips to its own sight radius. */}
        {!dmView && snapshot?.fogEnabled && snapshot.compiledScene && (
          <FogLayer
            cam={cam}
            compiledScene={snapshot.compiledScene}
            mapTransform={mapObject?.transform}
            viewers={fogViewers(
              snapshot.tokens ?? [],
              uid,
              isDM && playerLens,
              grid.size,
              snapshot.defaultVisionRadius,
            )}
            gridSize={grid.size}
            gridSquareSize={snapshot?.gridSquareSize ?? 5}
            exploredStorageKey={exploredStorageKey}
          />
        )}

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
            diagonalRule={snapshot?.diagonalRule}
            remoteMeasurements={remoteMeasurements}
          />
          <AlignmentOverlay
            alignmentMode={alignmentMode}
            alignmentPreviewPoints={alignmentPreviewPoints}
            alignmentPreviewLine={alignmentPreviewLine}
            alignmentSuggestionLine={alignmentSuggestionLine}
            cam={cam}
          />
          <MapEditPreviewLayer
            cam={cam}
            mapTransform={mapObject?.transform}
            previewDrag={mapEditPreviewDrag}
            activeSubTool={mapEditActiveSubTool}
            hallwayWidth={mapEditHallwayWidth}
            // The room/brush preview must use the SAME grid the placement uses
            // (the live document's), not the clamped table grid, or they diverge.
            gridSize={mapEditController?.activeDocument?.grid.size ?? grid.size}
            gridOffsetX={mapEditController?.activeDocument?.grid.offsetX ?? 0}
            gridOffsetY={mapEditController?.activeDocument?.grid.offsetY ?? 0}
            strokeCells={mapEditStrokeCells}
            placementGhost={mapEditPlacementGhost}
            // Scatter cluster + armed POPULATE preview — both true-result drafts.
            draftGhosts={[...mapEditDraftGhosts, ...(mapEditPopulateGhosts ?? [])]}
            selectionShape={mapEditSelectionRect}
            splineKind={mapEditSplineKind}
            floorFamily={mapEditFloorFamily}
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
