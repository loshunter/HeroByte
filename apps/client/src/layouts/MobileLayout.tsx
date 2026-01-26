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
    drawMode,
    pointerMode: _pointerMode,
    measureMode,
    transformMode,
    selectMode,
    alignmentMode,

    // Camera
    cameraCommand,
    handleCameraCommandHandled,
    setCameraState,

    // Drawing
    drawingProps,

    // Selection
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,

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

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", position: "relative" }}>
      {/* Full screen map */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Suspense fallback={<MapLoading />}>
          <MapBoard
            snapshot={snapshot}
            sendMessage={sendMessage}
            uid={uid}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            pointerMode={false} // Force false to enable "drag background to pan" behavior
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
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            zIndex: 100,
          }}
        >
          <TurnNavigationControls
            combatActive={true}
            onNextTurn={handleNextTurn}
            onPreviousTurn={handlePreviousTurn}
          />
        </div>
      )}

      {/* Mobile Floating Controls */}
      <MobileFloatingControls
        onShowEntities={() => setShowEntities(true)}
        onToggleDiceRoller={() => toggleDiceRoller(!diceRollerOpen)}
        onToggleRollLog={() => toggleRollLog(!rollLogOpen)}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
      />

      {/* Mobile Dice Roller Overlay */}
      {diceRollerOpen && (
        <MobileDiceRoller onRoll={handleRoll} onClose={() => toggleDiceRoller(false)} />
      )}

      {/* Mobile Entities List Overlay */}
      <div
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
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            maxHeight: "50vh",
            pointerEvents: "auto",
            zIndex: 1600,
          }}
        >
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
