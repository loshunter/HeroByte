/**
 * MobileLayout Component
 *
 * A streamlined layout for mobile devices, focusing purely on the map interaction.
 * Used when the user is on a small screen or explicitly requests mobile mode.
 */

import React, { Suspense, useState, useCallback } from "react";
import type { MainLayoutProps } from "./props/MainLayoutProps";
import { MapLoading } from "../components/ui/MapLoading";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import { ResultPanel } from "../components/dice/ResultPanel";
import { TurnNavigationControls } from "../features/initiative/components/TurnNavigationControls";

// Lazy load MapBoard to reduce initial bundle size
const MapBoard = React.lazy(() => import("../ui/MapBoard"));

/**
 * MobileLayout Component
 *
 * Renders a full-screen map with minimal UI controls.
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
    pointerMode,
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
  } = props;

  // Mobile specific UI state
  const [showControls, setShowControls] = useState(false);

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
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none", // Allow clicks to pass through container
        }}
      >
        {/* Toggle Controls Button */}
        <button
          onClick={() => setShowControls(!showControls)}
          style={{
            pointerEvents: "auto",
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {showControls ? "✕" : "☰"}
        </button>

        {/* Expanded Controls */}
        {showControls && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, pointerEvents: "auto" }}>
            <button
              onClick={() => toggleDiceRoller(!diceRollerOpen)}
              style={{
                background: diceRollerOpen ? "#4a9eff" : "rgba(0, 0, 0, 0.7)",
                color: "white",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                cursor: "pointer",
              }}
            >
              🎲 Dice
            </button>
            <button
              onClick={() => toggleRollLog(!rollLogOpen)}
              style={{
                background: rollLogOpen ? "#4a9eff" : "rgba(0, 0, 0, 0.7)",
                color: "white",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                cursor: "pointer",
              }}
            >
              📜 Log
            </button>
          </div>
        )}
      </div>

      {/* Dice Roller Overlay */}
      {diceRollerOpen && (
        <div style={{ position: "absolute", bottom: 80, right: 20, pointerEvents: "auto" }}>
          <DiceRoller onRoll={handleRoll} onClose={() => toggleDiceRoller(false)} />
        </div>
      )}

      {/* Roll Log Overlay */}
      {rollLogOpen && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            maxHeight: "50vh",
            pointerEvents: "auto",
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
            zIndex: 1000,
          }}
        >
          <ResultPanel result={viewingRoll} onClose={() => handleViewRoll(null)} />
        </div>
      )}
    </div>
  );
});
