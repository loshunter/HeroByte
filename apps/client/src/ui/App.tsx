// ============================================================================
// VTT CLIENT APP
// ============================================================================
// Main application component for the Virtual Tabletop client.
// Manages:
// - Network connection and room state
// - Player management and voice chat
// - UI layout (fixed top/bottom bars, center map canvas)
// - Tool modes (pointer, measure, draw)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapBoard from "./MapBoard";
import type { Camera } from "../hooks/useCamera";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import type { RoomSnapshot, ClientMessage, ServerMessage } from "@shared";
import { WS_URL } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDrawingStateManager } from "../hooks/useDrawingStateManager";
import { usePlayerEditing } from "../hooks/usePlayerEditing";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useDMRole } from "../hooks/useDMRole";
import { useToolMode } from "../hooks/useToolMode";
import { useCameraCommands } from "../hooks/useCameraCommands";
import { useSceneObjectActions } from "../hooks/useSceneObjectActions";
import { useSelectionManager } from "../features/selection";
import { DMMenu } from "../features/dm";
import { getSessionUID } from "../utils/session";
import { useSessionManagement } from "../features/session";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { EntitiesPanel } from "../components/layout/EntitiesPanel";
import { VisualEffects } from "../components/effects/VisualEffects";
import { ServerStatus } from "../components/layout/ServerStatus";
import { MultiSelectToolbar } from "../components/layout/MultiSelectToolbar";
import { AuthState } from "../services/websocket";
import { useToast } from "../hooks/useToast";
import { useStatusEffects } from "../hooks/useStatusEffects";
import { ToastContainer } from "../components/ui/Toast";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import { AuthenticationGate } from "../features/auth";
import { ContextMenu } from "../components/ui/ContextMenu";
import { useMapActions } from "../hooks/useMapActions";
import { useMapAlignment } from "../features/map";
import { usePlayerActions } from "../hooks/usePlayerActions";
import { useVoiceChatManager } from "../hooks/useVoiceChatManager";
import { useDiceRolling } from "../hooks/useDiceRolling";
import { useServerEventHandlers } from "../hooks/useServerEventHandlers";
import { useNpcManagement } from "../hooks/useNpcManagement";
import { usePropManagement } from "../hooks/usePropManagement";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useDMManagement } from "../hooks/useDMManagement";

// ----------------------------------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------------------------------

export const App: React.FC = () => {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  // Network and session
  const uid = getSessionUID(); // This player's unique ID
  const {
    snapshot,
    connectionState,
    send: sendMessage,
    authState,
    authError,
    isConnected,
    authenticate,
    connect,
    registerRtcHandler,
    registerServerEventHandler,
  } = useWebSocket({
    url: WS_URL,
    uid,
  });

  return (
    <AuthenticationGate
      url={WS_URL}
      uid={uid}
      onAuthenticate={authenticate}
      onConnect={connect}
      isConnected={isConnected}
      connectionState={connectionState}
      authState={authState}
      authError={authError}
    >
      <AuthenticatedApp
        uid={uid}
        snapshot={snapshot}
        sendMessage={sendMessage}
        registerRtcHandler={registerRtcHandler}
        registerServerEventHandler={registerServerEventHandler}
        isConnected={isConnected}
        authState={authState}
      />
    </AuthenticationGate>
  );
};

interface AuthenticatedAppProps {
  uid: string;
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;
  isConnected: boolean;
  authState: AuthState;
}

function AuthenticatedApp({
  uid,
  snapshot,
  sendMessage,
  registerRtcHandler,
  registerServerEventHandler,
  isConnected,
  authState: _authState,
}: AuthenticatedAppProps): JSX.Element {
  // Tool modes
  const {
    activeTool,
    setActiveTool,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
  } = useToolMode();

  // Custom hooks for state management
  const { micEnabled, toggleMic } = useVoiceChatManager({
    uid,
    snapshot,
    sendMessage,
    registerRtcHandler,
  });

  // Drawing state manager
  const drawingManager = useDrawingStateManager({
    sendMessage,
    drawMode,
    setActiveTool,
  });

  // Heartbeat to prevent timeout (only after authentication)
  useHeartbeat({ sendMessage });
  const {
    editingPlayerUID,
    nameInput,
    editingMaxHpUID,
    maxHpInput,
    startNameEdit,
    updateNameInput,
    submitNameEdit,
    startMaxHpEdit,
    updateMaxHpInput,
    submitMaxHpEdit,
  } = usePlayerEditing();

  // Toast notifications
  const toast = useToast();

  // Map controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridLocked, setGridLocked] = useState(false);

  // Camera state (for viewport-based prop placement)
  const [cameraState, setCameraState] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });

  // Server-synced object selection state
  const {
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,
    clearSelection,
    lockSelected,
    unlockSelected,
  } = useSelectionManager({
    uid,
    snapshot,
    sendMessage,
    transformMode,
    selectMode,
  });

  // UI layout (fixed panels)
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const [topHeight, setTopHeight] = useState(180);
  const [bottomHeight, setBottomHeight] = useState(210);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(
    null,
  );

  // CRT filter toggle
  const [crtFilter, setCrtFilter] = useState(false);

  // Camera commands
  const { cameraCommand, handleFocusSelf, handleResetCamera, handleCameraCommandHandled } =
    useCameraCommands({ snapshot, uid });

  // Camera state (from MapBoard)
  const [camera, _setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });

  // Dice rolling state and handlers
  const {
    diceRollerOpen,
    rollLogOpen,
    viewingRoll,
    rollHistory,
    toggleDiceRoller,
    toggleRollLog,
    handleRoll,
    handleClearLog,
    handleViewRoll,
  } = useDiceRolling({ snapshot, sendMessage, uid });

  // Server event handlers (room password, DM elevation)
  const {
    roomPasswordStatus,
    roomPasswordPending,
    dismissRoomPasswordStatus,
    handleSetRoomPassword,
  } = useServerEventHandlers({
    registerServerEventHandler,
    toast,
    sendMessage,
  });

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------

  // Network connection is now handled by useWebSocket hook

  /**
   * Measure top and bottom panel heights for layout calculations
   * Re-measures on window resize and when player list changes
   */
  useEffect(() => {
    const measureHeights = () => {
      if (topPanelRef.current) {
        setTopHeight(topPanelRef.current.offsetHeight);
      }
      if (bottomPanelRef.current) {
        setBottomHeight(bottomPanelRef.current.offsetHeight);
      }
    };

    measureHeights();
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, [snapshot?.players]);

  /**
   * Keyboard shortcuts
   * Ctrl+Z / Cmd+Z: Undo last drawing
   * Delete/Backspace: Delete selected object (moved after isDM declaration)
   */

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Scene object actions (tokens, map, props, staging zone)
   */
  const {
    recolorToken,
    transformSceneObject,
    toggleSceneObjectLock,
    deleteToken,
    updateTokenImage,
    updateTokenSize,
  } = useSceneObjectActions({ sendMessage });

  /**
   * Status effects management
   */
  const { setStatusEffects: _setStatusEffects } = useStatusEffects({ sendMessage });

  /**
   * Map actions
   */
  const {
    setMapBackground: setMapBackgroundURL,
    setGridSize,
    setGridSquareSize,
  } = useMapActions({ sendMessage });

  /**
   * Player actions
   */
  const playerActions = usePlayerActions({
    sendMessage,
    snapshot,
    uid,
  });

  const gridSize = snapshot?.gridSize || 50;
  const gridSquareSize = snapshot?.gridSquareSize ?? 5;

  // E2E testing support (dev-only)
  useE2ETestingSupport({
    snapshot,
    uid,
    gridSize,
  });

  const mapSceneObject = useMemo(
    () => snapshot?.sceneObjects?.find((obj) => obj.type === "map") ?? null,
    [snapshot?.sceneObjects],
  );

  const stagingZoneSceneObject = useMemo(
    () => snapshot?.sceneObjects?.find((obj) => obj.type === "staging-zone") ?? null,
    [snapshot?.sceneObjects],
  );

  // NPC Management Hook
  const { handleCreateNPC, handleUpdateNPC, handleDeleteNPC, handlePlaceNPCToken } =
    useNpcManagement({
      sendMessage,
      snapshot,
    });

  const handleDeletePlayerToken = useCallback(
    (tokenId: string) => {
      sendMessage({ t: "delete-token", id: tokenId });
    },
    [sendMessage],
  );

  // Prop Management Hook
  const { handleCreateProp, handleUpdateProp, handleDeleteProp } = usePropManagement({
    sendMessage,
    cameraState,
  });

  // Session Management Hook
  const { handleSaveSession, handleLoadSession } = useSessionManagement({
    snapshot,
    sendMessage,
    toast,
  });

  // DM role detection
  const { isDM, elevateToDM } = useDMRole({ snapshot, uid, send: sendMessage });

  // DM management (elevation and revocation)
  const { handleToggleDM } = useDMManagement({
    isDM,
    elevateToDM,
    sendMessage,
    toast,
  });

  // Map alignment
  const {
    alignmentPoints,
    alignmentSuggestion,
    alignmentError,
    handleAlignmentStart,
    handleAlignmentCancel,
    handleAlignmentPointCapture,
    handleAlignmentReset,
    handleAlignmentApply,
  } = useMapAlignment({
    activeTool,
    setActiveTool,
    gridSize,
    mapSceneObject: snapshot?.sceneObjects?.find((obj) => obj.type === "map"),
    transformSceneObject,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    selectedObjectIds,
    isDM,
    snapshot,
    uid,
    sendMessage,
    clearSelection,
    drawMode,
    drawingManager,
  });

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Server Status Banner */}
      <ServerStatus isConnected={isConnected} />

      {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
      {drawMode && <DrawingToolbar {...drawingManager.toolbarProps} />}

      {/* Header - Fixed at top */}
      <Header
        uid={uid}
        snapToGrid={snapToGrid}
        activeTool={activeTool}
        crtFilter={crtFilter}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        onSnapToGridChange={setSnapToGrid}
        onToolSelect={setActiveTool}
        onCrtFilterChange={setCrtFilter}
        onDiceRollerToggle={toggleDiceRoller}
        onRollLogToggle={toggleRollLog}
        topPanelRef={topPanelRef}
        onFocusSelf={handleFocusSelf}
        onResetCamera={handleResetCamera}
      />

      {/* Multi-select toolbar - shows when multiple objects are selected and user is DM */}
      <MultiSelectToolbar
        selectedObjectIds={selectedObjectIds}
        isDM={isDM}
        topHeight={topHeight}
        onLock={lockSelected}
        onUnlock={unlockSelected}
      />

      {/* Main Whiteboard Panel - fills space between fixed top and bottom */}
      <div
        style={{
          position: "fixed",
          top: `${topHeight}px`,
          bottom: `${bottomHeight}px`,
          left: 0,
          right: 0,
          overflow: "hidden",
        }}
      >
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
          {...drawingManager.drawingProps}
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
      </div>

      {/* Entities HUD - Fixed at bottom */}
      <EntitiesPanel
        players={snapshot?.players || []}
        characters={snapshot?.characters || []}
        tokens={snapshot?.tokens || []}
        sceneObjects={snapshot?.sceneObjects || []}
        drawings={snapshot?.drawings || []}
        uid={uid}
        micEnabled={micEnabled}
        editingPlayerUID={editingPlayerUID}
        nameInput={nameInput}
        editingMaxHpUID={editingMaxHpUID}
        maxHpInput={maxHpInput}
        onNameInputChange={updateNameInput}
        onNameEdit={startNameEdit}
        onNameSubmit={() => submitNameEdit(playerActions.renamePlayer)}
        onPortraitLoad={() => {
          const url = prompt("Enter image URL:");
          if (url && url.trim()) {
            playerActions.setPortrait(url.trim());
          }
        }}
        onToggleMic={toggleMic}
        onHpChange={(hp, maxHp) => playerActions.setHP(hp, maxHp)}
        onMaxHpInputChange={updateMaxHpInput}
        onMaxHpEdit={startMaxHpEdit}
        onMaxHpSubmit={() =>
          submitMaxHpEdit((maxHp) =>
            playerActions.setHP(snapshot?.players?.find((p) => p.uid === uid)?.hp ?? 100, maxHp),
          )
        }
        currentIsDM={isDM}
        onToggleDMMode={handleToggleDM}
        onTokenImageChange={updateTokenImage}
        onApplyPlayerState={playerActions.applyPlayerState}
        onStatusEffectsChange={playerActions.setStatusEffects}
        onNpcUpdate={handleUpdateNPC}
        onNpcDelete={handleDeleteNPC}
        onNpcPlaceToken={handlePlaceNPCToken}
        onPlayerTokenDelete={handleDeletePlayerToken}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        onAddCharacter={playerActions.addCharacter}
        onDeleteCharacter={playerActions.deleteCharacter}
        onCharacterNameUpdate={playerActions.updateCharacterName}
        bottomPanelRef={bottomPanelRef}
      />

      <DMMenu
        isDM={isDM}
        onToggleDM={handleToggleDM}
        gridSize={gridSize}
        gridSquareSize={gridSquareSize}
        gridLocked={gridLocked}
        onGridLockToggle={() => setGridLocked((prev) => !prev)}
        onGridSizeChange={setGridSize}
        onGridSquareSizeChange={setGridSquareSize}
        onClearDrawings={drawingManager.handleClearDrawings}
        onSetMapBackground={setMapBackgroundURL}
        mapBackground={snapshot?.mapBackground}
        playerStagingZone={snapshot?.playerStagingZone}
        onSetPlayerStagingZone={playerActions.setPlayerStagingZone}
        camera={camera}
        playerCount={snapshot?.players?.length ?? 0}
        characters={snapshot?.characters || []}
        onRequestSaveSession={snapshot ? handleSaveSession : undefined}
        onRequestLoadSession={handleLoadSession}
        onCreateNPC={handleCreateNPC}
        onUpdateNPC={handleUpdateNPC}
        onDeleteNPC={handleDeleteNPC}
        onPlaceNPCToken={handlePlaceNPCToken}
        props={snapshot?.props || []}
        players={snapshot?.players || []}
        onCreateProp={handleCreateProp}
        onUpdateProp={handleUpdateProp}
        onDeleteProp={handleDeleteProp}
        mapLocked={mapSceneObject?.locked ?? true}
        onMapLockToggle={() => {
          if (mapSceneObject) {
            toggleSceneObjectLock(mapSceneObject.id, !mapSceneObject.locked);
          }
        }}
        stagingZoneLocked={stagingZoneSceneObject?.locked ?? false}
        onStagingZoneLockToggle={() => {
          if (stagingZoneSceneObject) {
            toggleSceneObjectLock(stagingZoneSceneObject.id, !stagingZoneSceneObject.locked);
          }
        }}
        mapTransform={
          mapSceneObject?.transform ?? {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          }
        }
        onMapTransformChange={(transform) => {
          if (mapSceneObject) {
            transformSceneObject({
              id: mapSceneObject.id,
              position: { x: transform.x, y: transform.y },
              scale: { x: transform.scaleX, y: transform.scaleY },
              rotation: transform.rotation,
            });
          }
        }}
        alignmentModeActive={alignmentMode}
        alignmentPoints={alignmentPoints}
        alignmentSuggestion={alignmentSuggestion}
        alignmentError={alignmentError}
        onAlignmentStart={handleAlignmentStart}
        onAlignmentReset={handleAlignmentReset}
        onAlignmentCancel={handleAlignmentCancel}
        onAlignmentApply={handleAlignmentApply}
        onSetRoomPassword={handleSetRoomPassword}
        roomPasswordStatus={roomPasswordStatus}
        roomPasswordPending={roomPasswordPending}
        onDismissRoomPasswordStatus={dismissRoomPasswordStatus}
      />

      {/* Context Menu */}
      <ContextMenu menu={contextMenu} onDelete={deleteToken} onClose={() => setContextMenu(null)} />

      {/* Visual Effects (CRT Filter + Ambient Sparkles) */}
      <VisualEffects crtFilter={crtFilter} />

      {/* Dice Roller Panel */}
      {diceRollerOpen && <DiceRoller onRoll={handleRoll} onClose={() => toggleDiceRoller(false)} />}

      {/* Roll Log Panel */}
      {rollLogOpen && (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 200,
            width: 350,
            height: 500,
            zIndex: 1000,
          }}
        >
          <RollLog
            rolls={rollHistory}
            onClearLog={handleClearLog}
            onViewRoll={handleViewRoll}
            onClose={() => toggleRollLog(false)}
          />
        </div>
      )}

      {/* Viewing roll from log */}
      {viewingRoll && (
        <div style={{ position: "fixed", zIndex: 2000 }}>
          <DiceRoller onRoll={() => {}} onClose={() => handleViewRoll(null)} />
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer messages={toast.messages} onDismiss={toast.dismiss} />
    </div>
  );
}
