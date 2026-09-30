/**
 * MobileLayout Component
 *
 * A streamlined layout for mobile devices, focusing purely on the map interaction.
 * Used when the user is on a small screen or explicitly requests mobile mode.
 *
 * Which surface is open is owned by useMobileSurface — one machine, not a set
 * of callbacks — and the surfaces themselves render in MobileSurfaces.
 */

import React, { useEffect, useMemo, useState, Suspense } from "react";
import type { MainLayoutProps } from "./props/MainLayoutProps";
import { MapLoading } from "../components/ui/MapLoading";
import { MobileResultOverlay } from "../components/dice/MobileResultOverlay";
import { ToastContainer } from "../components/ui/Toast";
import { ServerStatus } from "../components/layout/ServerStatus";
import { PublicTableNotice } from "../features/rooms/PublicTableNotice";
import { MobileFloatingControls } from "../components/layout/MobileFloatingControls";
import { useMobileSurface } from "../hooks/useMobileSurface";
import { MobileDrawingControls } from "./MobileDrawingControls";
import { MobileSelectionSheet } from "./MobileSelectionSheet";
import { useMovePadCameraFollow } from "../features/movement/useMovePadCameraFollow";
import { MobileSurfaces } from "./mobile/MobileSurfaces";
import { CrtOverlay } from "../components/effects/VisualEffects";
import { MobileCombatStrip } from "./mobile/MobileCombatStrip";

// Lazy load MapBoard to reduce initial bundle size
const MapBoard = React.lazy(() => import("../ui/MapBoard"));

export const MobileLayout = React.memo(function MobileLayout(props: MainLayoutProps): JSX.Element {
  const {
    // Data
    snapshot,
    uid,
    gridSize,
    snapToGrid,
    isDM,

    // Tool state (simplified for mobile)
    activeTool,
    setActiveTool,
    setSnapToGrid,
    drawMode,
    pointerMode,
    measureMode,
    remoteMeasurements,
    transformMode,
    selectMode,
    alignmentMode,

    // Camera
    cameraCommand,
    handleCameraCommandHandled,
    setCameraState,
    handleResetCamera,

    // Drawing
    drawingToolbarProps,
    drawingProps,

    // Selection
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,
    lockSelected,
    unlockSelected,

    // Scene objects
    recolorToken,
    transformSceneObject,

    // Alignment
    alignmentPoints,
    alignmentSuggestion,
    handleAlignmentPointCapture,

    // Dice/log open state lives at the App level; the machine drives it
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    viewingRoll,
    handleViewRoll,

    // Map-edit (the machine's orthogonal axis). Every one of these was already
    // computed on every mobile render and dropped on the floor — the gap was
    // plumbing, not data. mapEditToolbarProps is deliberately NOT here: it
    // feeds the palette, not the canvas.
    mapEditMode,
    mapEditActiveSubTool,
    mapEditFloorFamily,
    mapEditRoomWallFamily,
    mapEditSelectedAssetId,
    mapEditHallwayWidth,
    mapEditTerrainBrushSize,
    mapEditSplineKind,
    mapEditPersistentPreview,
    mapEditWheelActions,
    mapEditSelectedElementId,
    mapEditWallsOverlayPinned,
    onMapEditRoomRejected,
    onMapEditGestureDropped,
    onMapEditRegionPlaced,
    onMapEditRegionDragged,
    onMapEditSelectElement,
    onMapEditSampleAsset,
    mapEditToolbarProps,
    // The controller itself. Desktop passes it un-gated on isDM
    // (CenterCanvasLayout) because the SERVER gates the commands; matching
    // that here keeps one authorization story rather than two.
    mapStudio,

    // WebSocket
    sendMessage,
  } = props;

  // Tools/Help temporarily unmount the drawing sheet without ending draw mode.
  const [drawingControlsCollapsed, setDrawingControlsCollapsed] = useState(false);
  useEffect(() => {
    if (!drawMode) setDrawingControlsCollapsed(false);
  }, [drawMode]);

  const machine = useMobileSurface({
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    kick: props.kick,
    mapEditMode,
    alignmentMode,
    // The atlas-link aim is alignment's species exactly (A6): not a Mode,
    // armed from a full-height screen, and capturing needs the MAP — so
    // arming it must clear the surface the same way. Its own input, so the
    // machine sees its edge even when alignment was already armed.
    linkAimMode: props.linkAimActive ?? false,
    isDM,
    playerPropsEnabled: snapshot?.playerPropsEnabled ?? false,
  });
  const { surface, toggleSurface } = machine;
  // Phone launchers use the machine's transition, which opens the shared App
  // session. Draft, Cancel and ROLL use that same session across both layouts.
  const kick = props.kick;
  const openKick = machine.openSurface;
  const surfaceProps = useMemo<MainLayoutProps>(
    () =>
      kick
        ? {
            ...props,
            kick: {
              ...kick,
              openKick: () => openKick("kick"),
            },
          }
        : props,
    [props, kick, openKick],
  );
  // The two tool-derived sheets share the bottom-sheet slot with these
  // surfaces, so they yield while either occupies it: same anchor, same
  // z-index, and stacking them is the bug S8 shipped.
  const sheetSlotOccupied = surface === "tools" || surface === "help";

  const selectedObjectCount = selectedObjectIds.length || (selectedObjectId ? 1 : 0);
  const selectionSheetMounted =
    selectedObjectCount > 0 && (transformMode || selectMode) && !sheetSlotOccupied;
  // The d-pad covers the piece it moves; the follow recentres it above the
  // sheet on the step that would hide it — only while the map is what is
  // showing (a Screen at z 1700 covers the sheet without unmounting it).
  const follow = useMovePadCameraFollow({
    active: selectionSheetMounted && surface === "none" && (props.movement?.movableCount ?? 0) > 0,
    snapshot,
    gridSize,
    camera: props.cameraState,
    selectedObjectIds,
    uid,
    isDM,
    mapEditMode,
    appCommand: cameraCommand,
    onAppCommandHandled: handleCameraCommandHandled,
  });

  return (
    <div className="mobile-layout-root">
      {props.crtFilter && <CrtOverlay mobile />}
      {/* Full screen map */}
      <div className="mobile-map-surface">
        <Suspense fallback={<MapLoading />}>
          <MapBoard
            snapshot={snapshot}
            sendMessage={sendMessage}
            uid={uid}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            pointerMode={pointerMode}
            measureMode={measureMode}
            remoteMeasurements={remoteMeasurements}
            drawMode={drawMode}
            transformMode={transformMode}
            selectMode={selectMode}
            mapEditMode={mapEditMode}
            mapEditActiveSubTool={mapEditActiveSubTool}
            mapEditFloorFamily={mapEditFloorFamily}
            mapEditRoomWallFamily={mapEditRoomWallFamily}
            mapEditSelectedAssetId={mapEditSelectedAssetId}
            mapEditPlacementDials={mapEditToolbarProps}
            mapEditHallwayWidth={mapEditHallwayWidth}
            mapEditTerrainBrushSize={mapEditTerrainBrushSize}
            mapEditSplineKind={mapEditSplineKind}
            mapEditPersistentPreview={mapEditPersistentPreview}
            mapEditWheelActions={mapEditWheelActions}
            mapEditSelectedElementId={mapEditSelectedElementId}
            mapEditController={mapStudio}
            mapEditWallsOverlayPinned={mapEditWallsOverlayPinned}
            onMapEditRoomRejected={onMapEditRoomRejected}
            onMapEditGestureDropped={onMapEditGestureDropped}
            onMapEditRegionPlaced={onMapEditRegionPlaced}
            onMapEditRegionDragged={onMapEditRegionDragged}
            onMapEditSelectElement={onMapEditSelectElement}
            onMapEditSampleAsset={onMapEditSampleAsset}
            isDM={isDM}
            alignmentMode={alignmentMode}
            alignmentPoints={alignmentPoints}
            alignmentSuggestion={alignmentSuggestion}
            onAlignmentPointCapture={handleAlignmentPointCapture}
            linkAimMode={props.linkAimActive ?? false}
            onLinkAnchorCapture={props.captureLinkAnchor}
            {...drawingProps}
            onRecolorToken={recolorToken}
            onTransformObject={transformSceneObject}
            cameraCommand={follow.cameraCommand}
            onCameraCommandHandled={follow.onCameraCommandHandled}
            onCameraChange={setCameraState}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={handleObjectSelection}
            onSelectObjects={handleObjectSelectionBatch}
          />
        </Suspense>
      </div>

      {/* Turn Controls */}
      <MobileCombatStrip
        combatActive={snapshot?.combatActive ?? false}
        sendMessage={sendMessage}
        characters={snapshot?.characters ?? []}
        currentTurnCharacterId={snapshot?.currentTurnCharacterId}
      />

      {/* Mobile Floating Controls */}
      <MobileFloatingControls
        worldReturn={machine.worldReturn}
        kickPending={Boolean(kick?.pending && !kick.pending.expired)}
        surface={surface}
        onToggleSurface={toggleSurface}
        onToolSelect={setActiveTool}
        onSnapToGridChange={setSnapToGrid}
        onResetCamera={handleResetCamera}
        crtFilter={props.crtFilter}
        onCrtFilterChange={props.setCrtFilter}
        activeTool={activeTool}
        snapToGrid={snapToGrid}
        isDM={isDM}
        playerPropsEnabled={snapshot?.playerPropsEnabled ?? false}
        mode={machine.mode}
        mapEditToolbarProps={mapEditToolbarProps}
      />

      {selectionSheetMounted && (
        <MobileSelectionSheet
          selectedCount={selectedObjectCount}
          movement={props.movement}
          transformMode={transformMode}
          isDM={isDM}
          onTransform={() => setActiveTool("transform")}
          onLock={lockSelected}
          onUnlock={unlockSelected}
          onClear={() => {
            handleObjectSelection(null);
            handleObjectSelectionBatch([]);
          }}
        />
      )}

      {drawMode && !sheetSlotOccupied && (
        <MobileDrawingControls
          collapsed={drawingControlsCollapsed}
          onCollapsedChange={setDrawingControlsCollapsed}
          drawTool={drawingToolbarProps.drawTool}
          drawColor={drawingToolbarProps.drawColor}
          drawWidth={drawingToolbarProps.drawWidth}
          drawOpacity={drawingToolbarProps.drawOpacity}
          drawFilled={drawingToolbarProps.drawFilled}
          canUndo={drawingToolbarProps.canUndo}
          canRedo={drawingToolbarProps.canRedo}
          onToolChange={drawingToolbarProps.onToolChange}
          onColorChange={drawingToolbarProps.onColorChange}
          onWidthChange={drawingToolbarProps.onWidthChange}
          onOpacityChange={drawingToolbarProps.onOpacityChange}
          onFilledChange={drawingToolbarProps.onFilledChange}
          onUndo={drawingToolbarProps.onUndo}
          onRedo={drawingToolbarProps.onRedo}
          onClose={() => setActiveTool(null)}
        />
      )}

      {/* Party, dice, log and help all render (one at a time) in here */}
      <MobileSurfaces props={surfaceProps} machine={machine} />

      {/* Viewing Roll Result */}
      <MobileResultOverlay result={viewingRoll} onClose={() => handleViewRoll(null)} />

      {/* Mobile rendered neither of these, so a phone user got no non-blocking
          feedback ever — no save confirmation, no dropped-command warning, no
          sign the server had gone. Both props were already being passed in. */}
      {/* The banner is the only place the table reports a lost server, and an
          open Screen is an opaque full-viewport cover at z-index 1700 — so the
          banner rides a stacking context above the screens (and below the dice
          overlay at 2000). position:relative does not move a fixed descendant;
          it only lifts its paint. */}
      {/* No controls, floats over the map's top band: taps go through. */}
      <div style={{ position: "relative", zIndex: 1800, pointerEvents: "none" }}>
        <ServerStatus isConnected={props.isConnected} />
      </div>
      {props.snapshot?.isPublicTable ? <PublicTableNotice variant="chip" /> : null}
      <ToastContainer messages={props.toast.messages} onDismiss={props.toast.dismiss} />
    </div>
  );
});
