/**
 * MobileLayout Component
 *
 * A streamlined layout for mobile devices, focusing purely on the map interaction.
 * Used when the user is on a small screen or explicitly requests mobile mode.
 *
 * Which surface is open is owned by useMobileSurface — one machine, not a set
 * of callbacks — and the surfaces themselves render in MobileSurfaces.
 */

import React, { Suspense, useCallback } from "react";
import type { MainLayoutProps } from "./props/MainLayoutProps";
import { MapLoading } from "../components/ui/MapLoading";
import { MobileResultOverlay } from "../components/dice/MobileResultOverlay";
import { TurnNavigationControls } from "../features/initiative/components/TurnNavigationControls";
import { ToastContainer } from "../components/ui/Toast";
import { ServerStatus } from "../components/layout/ServerStatus";
import { PublicTableNotice } from "../features/rooms/PublicTableNotice";
import { MobileFloatingControls } from "../components/layout/MobileFloatingControls";
import { useMobileSurface } from "../hooks/useMobileSurface";
import { MobileDrawingControls } from "./MobileDrawingControls";
import { MobileSelectionSheet } from "./MobileSelectionSheet";
import { MobileSurfaces } from "./mobile/MobileSurfaces";

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

    // Map-edit (the machine's orthogonal axis)
    mapEditMode,

    // WebSocket
    sendMessage,
  } = props;

  const machine = useMobileSurface({
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    mapEditMode,
  });
  const { surface, toggleSurface } = machine;
  // The two tool-derived sheets share the bottom-sheet slot with these
  // surfaces, so they yield while either occupies it: same anchor, same
  // z-index, and stacking them is the bug S8 shipped.
  const sheetSlotOccupied = surface === "tools" || surface === "help";

  const selectedObjectCount = selectedObjectIds.length || (selectedObjectId ? 1 : 0);

  // Turn navigation handlers
  const handleNextTurn = useCallback(() => {
    sendMessage({ t: "next-turn" });
  }, [sendMessage]);

  const handlePreviousTurn = useCallback(() => {
    sendMessage({ t: "previous-turn" });
  }, [sendMessage]);

  return (
    <div className="mobile-layout-root">
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
            isDM={isDM}
            alignmentMode={alignmentMode}
            alignmentPoints={alignmentPoints}
            alignmentSuggestion={alignmentSuggestion}
            onAlignmentPointCapture={handleAlignmentPointCapture}
            {...drawingProps}
            onRecolorToken={recolorToken}
            onTransformObject={transformSceneObject}
            cameraCommand={cameraCommand}
            onCameraCommandHandled={handleCameraCommandHandled}
            onCameraChange={setCameraState}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            onSelectObject={handleObjectSelection}
            onSelectObjects={handleObjectSelectionBatch}
          />
        </Suspense>
      </div>

      {/* Turn Controls */}
      {snapshot?.combatActive && (
        <div className="mobile-combat-strip">
          <TurnNavigationControls
            combatActive={true}
            onNextTurn={handleNextTurn}
            onPreviousTurn={handlePreviousTurn}
          />
        </div>
      )}

      {/* Mobile Floating Controls */}
      <MobileFloatingControls
        surface={surface}
        onToggleSurface={toggleSurface}
        onToolSelect={setActiveTool}
        onSnapToGridChange={setSnapToGrid}
        onResetCamera={handleResetCamera}
        activeTool={activeTool}
        snapToGrid={snapToGrid}
        isDM={isDM}
      />

      {selectedObjectCount > 0 && (transformMode || selectMode) && !sheetSlotOccupied && (
        <MobileSelectionSheet
          selectedCount={selectedObjectCount}
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
          drawTool={drawingToolbarProps.drawTool}
          drawColor={drawingToolbarProps.drawColor}
          drawWidth={drawingToolbarProps.drawWidth}
          canUndo={drawingToolbarProps.canUndo}
          canRedo={drawingToolbarProps.canRedo}
          onToolChange={drawingToolbarProps.onToolChange}
          onColorChange={drawingToolbarProps.onColorChange}
          onWidthChange={drawingToolbarProps.onWidthChange}
          onUndo={drawingToolbarProps.onUndo}
          onRedo={drawingToolbarProps.onRedo}
          onClose={() => setActiveTool(null)}
        />
      )}

      {/* Party, dice, log and help all render (one at a time) in here */}
      <MobileSurfaces props={props} machine={machine} />

      {/* Viewing Roll Result */}
      <MobileResultOverlay result={viewingRoll} onClose={() => handleViewRoll(null)} />

      {/* Mobile rendered neither of these, so a phone user got no non-blocking
          feedback ever — no save confirmation, no dropped-command warning, no
          sign the server had gone. Both props were already being passed in. */}
      <ServerStatus isConnected={props.isConnected} />
      {props.snapshot?.isPublicTable ? <PublicTableNotice variant="chip" /> : null}
      <ToastContainer messages={props.toast.messages} onDismiss={props.toast.dismiss} />
    </div>
  );
});
