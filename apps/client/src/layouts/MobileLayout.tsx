/**
 * MobileLayout Component
 *
 * A streamlined layout for mobile devices, focusing purely on the map interaction.
 * Used when the user is on a small screen or explicitly requests mobile mode.
 */

import React, { Suspense, useState, useCallback } from "react";
import type { MainLayoutProps } from "./props/MainLayoutProps";
import { MapLoading } from "../components/ui/MapLoading";
import { MobileDiceRoller } from "../components/dice/MobileDiceRoller";
import { RollLog } from "../components/dice/RollLog";
import { ResultPanel } from "../components/dice/ResultPanel";
import { TurnNavigationControls } from "../features/initiative/components/TurnNavigationControls";
import { MobileEntitiesList } from "../components/layout/MobileEntitiesList";
import { MobileFloatingControls } from "../components/layout/MobileFloatingControls";
import { useEntityEditHandlers } from "../hooks/useEntityEditHandlers";
import { MobileDrawingControls } from "./MobileDrawingControls";

// Lazy load MapBoard to reduce initial bundle size
const MapBoard = React.lazy(() => import("../ui/MapBoard"));

/**
 * MobileLayout Component
 *
 * Renders a full-screen map with minimal UI controls and mobile-optimized overlays.
 */
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

    // Dice
    rollHistory,
    viewingRoll,
    handleRoll,
    handleClearLog,
    handleViewRoll,
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,

    // WebSocket
    sendMessage,

    // Entity Data & Actions (Added for Mobile Entities List)
    playerActions,
    editingHpUID,
    editingMaxHpUID,
    editingTempHpUID,
    hpInput,
    updateHpInput,
    maxHpInput,
    updateMaxHpInput,
    startHpEdit,
    startMaxHpEdit,
    submitHpEdit,
    submitMaxHpEdit,
    submitTempHpEdit,
    submitNameEdit,
  } = props;

  // Mobile specific UI state
  const [showEntities, setShowEntities] = useState(false);

  const selectedObjectCount = selectedObjectIds.length || (selectedObjectId ? 1 : 0);

  // Extract entity editing handlers
  const { handleCharacterHpSubmit, handleCharacterMaxHpSubmit } = useEntityEditHandlers({
    editingHpUID,
    editingMaxHpUID,
    editingTempHpUID,
    snapshot,
    submitHpEdit,
    submitMaxHpEdit,
    submitTempHpEdit,
    submitNameEdit,
    playerActions,
  });

  // Turn navigation handlers
  const handleNextTurn = useCallback(() => {
    sendMessage({ t: "next-turn" });
  }, [sendMessage]);

  const handlePreviousTurn = useCallback(() => {
    sendMessage({ t: "previous-turn" });
  }, [sendMessage]);

  // Single-sheet arbitration: opening any of Party/Tools/Dice/Log closes the rest.
  const [showTools, setShowTools] = useState(false);
  const closeAllSheets = useCallback(() => {
    setShowEntities(false);
    setShowTools(false);
    if (diceRollerOpen) toggleDiceRoller(false);
    if (rollLogOpen) toggleRollLog(false);
  }, [diceRollerOpen, rollLogOpen, toggleDiceRoller, toggleRollLog]);
  const toggleParty = useCallback(() => {
    const willOpen = !showEntities;
    closeAllSheets();
    setShowEntities(willOpen);
  }, [showEntities, closeAllSheets]);
  const toggleTools = useCallback(() => {
    const willOpen = !showTools;
    closeAllSheets();
    setShowTools(willOpen);
  }, [showTools, closeAllSheets]);
  const toggleDice = useCallback(() => {
    const willOpen = !diceRollerOpen;
    closeAllSheets();
    toggleDiceRoller(willOpen);
  }, [diceRollerOpen, closeAllSheets, toggleDiceRoller]);
  const toggleLog = useCallback(() => {
    const willOpen = !rollLogOpen;
    closeAllSheets();
    toggleRollLog(willOpen);
  }, [rollLogOpen, closeAllSheets, toggleRollLog]);

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
        onShowEntities={toggleParty}
        onToggleDiceRoller={toggleDice}
        onToggleRollLog={toggleLog}
        onToolSelect={setActiveTool}
        onSnapToGridChange={setSnapToGrid}
        onResetCamera={handleResetCamera}
        activeTool={activeTool}
        snapToGrid={snapToGrid}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        toolsOpen={showTools}
        onToggleTools={toggleTools}
      />

      {selectedObjectCount > 0 && (transformMode || selectMode) && (
        <div className="mobile-selection-sheet" role="region" aria-label="Selected object actions">
          <strong>{selectedObjectCount} selected</strong>
          <button
            type="button"
            className={transformMode ? "mobile-chip mobile-chip--active" : "mobile-chip"}
            onClick={() => setActiveTool("transform")}
          >
            Transform
          </button>
          {isDM && (
            <>
              <button type="button" className="mobile-chip" onClick={lockSelected}>
                Lock
              </button>
              <button type="button" className="mobile-chip" onClick={unlockSelected}>
                Unlock
              </button>
            </>
          )}
          <button
            type="button"
            className="mobile-chip"
            onClick={() => {
              handleObjectSelection(null);
              handleObjectSelectionBatch([]);
            }}
          >
            Clear
          </button>
        </div>
      )}

      {drawMode && (
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

      {/* Mobile Dice Roller Overlay */}
      {diceRollerOpen && (
        <MobileDiceRoller onRoll={handleRoll} onClose={() => toggleDiceRoller(false)} />
      )}

      {/* Mobile Entities List Overlay */}
      <div
        className="mobile-entities-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000,
          pointerEvents: showEntities ? "auto" : "none",
          transform: showEntities ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
        }}
      >
        {showEntities && (
          <MobileEntitiesList
            players={snapshot?.players || []}
            characters={snapshot?.characters || []}
            uid={uid}
            isDM={isDM}
            onClose={() => setShowEntities(false)}
            editingHpUID={editingHpUID}
            hpInput={hpInput}
            onHpInputChange={updateHpInput}
            onHpEdit={startHpEdit}
            onHpSubmit={handleCharacterHpSubmit}
            editingMaxHpUID={editingMaxHpUID}
            maxHpInput={maxHpInput}
            onMaxHpInputChange={updateMaxHpInput}
            onMaxHpEdit={startMaxHpEdit}
            onMaxHpSubmit={handleCharacterMaxHpSubmit}
            onCharacterHpChange={playerActions.updateCharacterHP}
            onCharacterStatusEffectsChange={playerActions.setCharacterStatusEffects}
            onCharacterNameUpdate={playerActions.updateCharacterName}
            onCharacterPortraitUpdate={playerActions.setCharacterPortrait}
          />
        )}
      </div>

      {/* Roll Log Overlay */}
      {rollLogOpen && (
        <div className="mobile-roll-log-panel">
          <RollLog
            rolls={rollHistory}
            onClearLog={handleClearLog}
            onClose={() => toggleRollLog(false)}
            onViewRoll={handleViewRoll}
          />
        </div>
      )}

      {/* Viewing Roll Result */}
      {viewingRoll && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "auto",
            zIndex: 2100, // Topmost
            width: "90%",
            maxWidth: "400px",
          }}
        >
          <ResultPanel result={viewingRoll} onClose={() => handleViewRoll(null)} />
        </div>
      )}
    </div>
  );
});
