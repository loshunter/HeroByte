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
import type { Camera } from "../hooks/useCamera";
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
import { getSessionUID } from "../utils/session";
import { useSessionManagement } from "../features/session";
import { AuthState } from "../services/websocket";
import { useToast } from "../hooks/useToast";
import { useStatusEffects } from "../hooks/useStatusEffects";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import { AuthenticationGate } from "../features/auth";
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
import { usePlayerTokenSelection } from "../hooks/usePlayerTokenSelection";
import { MainLayout } from "../layouts/MainLayout";

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
    editingHpUID,
    hpInput,
    editingMaxHpUID,
    maxHpInput,
    startNameEdit,
    updateNameInput,
    submitNameEdit,
    startHpEdit,
    updateHpInput,
    submitHpEdit,
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

  // Memoize camera state setter to prevent unnecessary re-renders
  const handleCameraChange = useCallback((camera: Camera) => {
    setCameraState(camera);
  }, []);

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

  // Player token selection shortcuts for DM
  const { selectPlayerTokens, undoSelection, canUndo } = usePlayerTokenSelection({
    sceneObjects: snapshot?.sceneObjects || [],
    selectedObjectIds,
    selectMultiple: handleObjectSelectionBatch,
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

  // Memoize context menu setter to prevent unnecessary re-renders
  const handleContextMenuChange = useCallback(
    (menu: { x: number; y: number; tokenId: string } | null) => {
      setContextMenu(menu);
    },
    [],
  );

  // CRT filter toggle
  const [crtFilter, setCrtFilter] = useState(false);

  // Camera commands
  const { cameraCommand, handleFocusToken, handleResetCamera, handleCameraCommandHandled } =
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
    undoSelection,
    canUndoSelection: canUndo,
  });

  // -------------------------------------------------------------------------
  // MEMOIZED ARRAY PROPS (Performance optimization)
  // -------------------------------------------------------------------------
  // NOTE: Previously memoized snapshot array props here, but they were unused.
  // MainLayout receives snapshot directly and components extract what they need.

  // -------------------------------------------------------------------------
  // PROP ADAPTERS (Type compatibility wrappers for MainLayout)
  // -------------------------------------------------------------------------
  // These wrappers adapt hook return values to match MainLayout's expected prop types

  // Wrap startNameEdit to match MainLayout's signature (uid only, no currentName)
  const handleStartNameEdit = useCallback(
    (uid: string) => {
      const player = snapshot?.players?.find((p) => p.uid === uid);
      const currentName = player?.name || "";
      startNameEdit(uid, currentName);
    },
    [snapshot?.players, startNameEdit],
  );

  // Wrap startHpEdit to match MainLayout's signature (uid only, no currentHp)
  const handleStartHpEdit = useCallback(
    (uid: string) => {
      const character = snapshot?.characters?.find((c) => c.id === uid);
      const currentHp = character?.hp || 0;
      startHpEdit(uid, currentHp);
    },
    [snapshot?.characters, startHpEdit],
  );

  // Wrap startMaxHpEdit to match MainLayout's signature (uid only, no currentMaxHp)
  const handleStartMaxHpEdit = useCallback(
    (uid: string) => {
      const character = snapshot?.characters?.find((c) => c.id === uid);
      const currentMaxHp = character?.maxHp || 0;
      startMaxHpEdit(uid, currentMaxHp);
    },
    [snapshot?.characters, startMaxHpEdit],
  );

  // Transform mapSceneObject to extract only needed properties
  const mapSceneObjectForLayout = useMemo(() => {
    if (!mapSceneObject) return null;
    return {
      id: mapSceneObject.id,
      locked: mapSceneObject.locked ?? false,
      transform: mapSceneObject.transform,
    };
  }, [mapSceneObject]);

  // Transform stagingZoneSceneObject to extract only needed properties
  const stagingZoneSceneObjectForLayout = useMemo(() => {
    if (!stagingZoneSceneObject) return null;
    return {
      id: stagingZoneSceneObject.id,
      locked: stagingZoneSceneObject.locked ?? false,
    };
  }, [stagingZoneSceneObject]);

  // Transform viewingRoll from RollResult to RollLogEntry by adding playerName
  const viewingRollForLayout = useMemo(() => {
    if (!viewingRoll) return null;
    // Find the matching roll in rollHistory which already has playerName
    const matchingHistoryEntry = rollHistory.find((r) => r.id === viewingRoll.id);
    if (matchingHistoryEntry) {
      return matchingHistoryEntry;
    }
    // Fallback: create entry with "Unknown" player name
    return {
      ...viewingRoll,
      playerName: "Unknown",
    };
  }, [viewingRoll, rollHistory]);

  // Note: No wrapper needed - SessionPersistenceControl has its own file input

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <MainLayout
      // Layout state
      topHeight={topHeight}
      bottomHeight={bottomHeight}
      topPanelRef={topPanelRef}
      bottomPanelRef={bottomPanelRef}
      contextMenu={contextMenu}
      setContextMenu={handleContextMenuChange}
      // Connection state
      isConnected={isConnected}
      // Tool state
      activeTool={activeTool}
      setActiveTool={setActiveTool}
      drawMode={drawMode}
      pointerMode={pointerMode}
      measureMode={measureMode}
      transformMode={transformMode}
      selectMode={selectMode}
      alignmentMode={alignmentMode}
      // UI state
      snapToGrid={snapToGrid}
      setSnapToGrid={setSnapToGrid}
      crtFilter={crtFilter}
      setCrtFilter={setCrtFilter}
      diceRollerOpen={diceRollerOpen}
      rollLogOpen={rollLogOpen}
      toggleDiceRoller={toggleDiceRoller}
      toggleRollLog={toggleRollLog}
      micEnabled={micEnabled}
      toggleMic={toggleMic}
      gridLocked={gridLocked}
      setGridLocked={setGridLocked}
      // Data
      snapshot={snapshot}
      uid={uid}
      gridSize={gridSize}
      gridSquareSize={gridSquareSize}
      isDM={isDM}
      // Camera
      cameraState={cameraState}
      camera={camera}
      cameraCommand={cameraCommand}
      handleCameraCommandHandled={handleCameraCommandHandled}
      setCameraState={handleCameraChange}
      handleFocusToken={handleFocusToken}
      handleResetCamera={handleResetCamera}
      // Drawing
      drawingToolbarProps={drawingManager.toolbarProps}
      drawingProps={drawingManager.drawingProps}
      handleClearDrawings={drawingManager.handleClearDrawings}
      // Editing
      editingPlayerUID={editingPlayerUID}
      nameInput={nameInput}
      editingHpUID={editingHpUID}
      hpInput={hpInput}
      editingMaxHpUID={editingMaxHpUID}
      maxHpInput={maxHpInput}
      updateNameInput={updateNameInput}
      startNameEdit={handleStartNameEdit}
      submitNameEdit={submitNameEdit}
      updateHpInput={updateHpInput}
      startHpEdit={handleStartHpEdit}
      submitHpEdit={submitHpEdit}
      updateMaxHpInput={updateMaxHpInput}
      startMaxHpEdit={handleStartMaxHpEdit}
      submitMaxHpEdit={submitMaxHpEdit}
      // Selection
      selectedObjectId={selectedObjectId}
      selectedObjectIds={selectedObjectIds}
      handleObjectSelection={handleObjectSelection}
      handleObjectSelectionBatch={handleObjectSelectionBatch}
      lockSelected={lockSelected}
      unlockSelected={unlockSelected}
      // Player token selection (DM shortcuts)
      selectPlayerTokens={selectPlayerTokens}
      // Player actions
      playerActions={playerActions}
      // Scene objects
      mapSceneObject={mapSceneObjectForLayout}
      stagingZoneSceneObject={stagingZoneSceneObjectForLayout}
      recolorToken={recolorToken}
      transformSceneObject={transformSceneObject}
      toggleSceneObjectLock={toggleSceneObjectLock}
      deleteToken={deleteToken}
      updateTokenImage={updateTokenImage}
      updateTokenSize={updateTokenSize}
      // Alignment
      alignmentPoints={alignmentPoints}
      alignmentSuggestion={alignmentSuggestion}
      alignmentError={alignmentError}
      handleAlignmentStart={handleAlignmentStart}
      handleAlignmentReset={handleAlignmentReset}
      handleAlignmentCancel={handleAlignmentCancel}
      handleAlignmentApply={handleAlignmentApply}
      handleAlignmentPointCapture={handleAlignmentPointCapture}
      // Dice
      rollHistory={rollHistory}
      viewingRoll={viewingRollForLayout}
      handleRoll={handleRoll}
      handleClearLog={handleClearLog}
      handleViewRoll={handleViewRoll}
      // Room password
      roomPasswordStatus={roomPasswordStatus}
      roomPasswordPending={roomPasswordPending}
      handleSetRoomPassword={handleSetRoomPassword}
      dismissRoomPasswordStatus={dismissRoomPasswordStatus}
      // NPC management
      handleCreateNPC={handleCreateNPC}
      handleUpdateNPC={handleUpdateNPC}
      handleDeleteNPC={handleDeleteNPC}
      handlePlaceNPCToken={handlePlaceNPCToken}
      handleDeletePlayerToken={handleDeletePlayerToken}
      // Prop management
      handleCreateProp={handleCreateProp}
      handleUpdateProp={handleUpdateProp}
      handleDeleteProp={handleDeleteProp}
      // Session management
      handleSaveSession={handleSaveSession}
      handleLoadSession={handleLoadSession}
      // DM management
      handleToggleDM={handleToggleDM}
      // Map actions
      setMapBackgroundURL={setMapBackgroundURL}
      setGridSize={setGridSize}
      setGridSquareSize={setGridSquareSize}
      // Toast
      toast={toast}
      // Other
      sendMessage={sendMessage}
    />
  );
}
