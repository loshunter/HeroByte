/**
 * MainLayout Component
 *
 * Renders the main application layout with all UI panels and overlays.
 * This component handles the presentation layer, composing all major UI elements:
 * - Fixed header and footer panels
 * - Dynamic center MapBoard canvas
 * - Floating menus and modals
 * - Visual effects and notifications
 *
 * Part of Phase 15 SOLID Refactor Initiative - Priority 29 (Final Phase)
 * Extracted from: apps/client/src/ui/App.tsx:405-641
 *
 * @remarks
 * This is a pure presentation component that receives all state and handlers
 * as props. It does not manage any state internally, following the principle
 * of separating business logic from presentation.
 *
 * The layout uses a fixed top/bottom panel structure with a dynamically-sized
 * center canvas area. Panel heights are measured and passed in as props to
 * ensure proper spacing.
 */

import React from "react";
import type { Camera } from "../hooks/useCamera";
import type { RoomSnapshot, ClientMessage } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { RollResult } from "../components/dice/types";
import type { ToolMode } from "../components/layout/Header";
import type { UseDrawingStateManagerReturn } from "../hooks/useDrawingStateManager";
import MapBoard from "../ui/MapBoard";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { EntitiesPanel } from "../components/layout/EntitiesPanel";
import { VisualEffects } from "../components/effects/VisualEffects";
import { ServerStatus } from "../components/layout/ServerStatus";
import { MultiSelectToolbar } from "../components/layout/MultiSelectToolbar";
import { DMMenu } from "../features/dm";
import { ContextMenu } from "../components/ui/ContextMenu";
import { ToastContainer, ToastMessage } from "../components/ui/Toast";

// Type aliases for missing types
type ContextMenuState = { x: number; y: number; tokenId: string } | null;
type DrawingToolbarProps = UseDrawingStateManagerReturn["toolbarProps"];
type DrawingBoardProps = UseDrawingStateManagerReturn["drawingProps"];
type RollHistoryEntry = RollLogEntry;
type ToastState = ReturnType<typeof import("../hooks/useToast").useToast>;

/**
 * Roll log entry interface
 */
export interface RollLogEntry {
  id: string;
  playerName: string;
  result: RollResult;
  timestamp: number;
}

/**
 * Props for the MainLayout component
 *
 * This interface defines all the props needed to render the complete application
 * layout. Props are organized into logical groups for clarity.
 */
export interface MainLayoutProps {
  // -------------------------------------------------------------------------
  // Layout State
  // -------------------------------------------------------------------------
  /** Height of the top panel in pixels */
  topHeight: number;
  /** Height of the bottom panel in pixels */
  bottomHeight: number;
  /** Reference to the top panel DOM element */
  topPanelRef: React.RefObject<HTMLDivElement>;
  /** Reference to the bottom panel DOM element */
  bottomPanelRef: React.RefObject<HTMLDivElement>;
  /** Context menu state (position and target token) */
  contextMenu: ContextMenuState;
  /** Handler to update context menu state */
  setContextMenu: (menu: ContextMenuState) => void;

  // -------------------------------------------------------------------------
  // Connection State
  // -------------------------------------------------------------------------
  /** Whether the WebSocket connection is active */
  isConnected: boolean;

  // -------------------------------------------------------------------------
  // Tool State
  // -------------------------------------------------------------------------
  /** Currently active tool mode */
  activeTool: string;
  /** Handler to change the active tool */
  setActiveTool: (tool: string) => void;
  /** Whether draw mode is active */
  drawMode: boolean;
  /** Whether pointer mode is active */
  pointerMode: boolean;
  /** Whether measure mode is active */
  measureMode: boolean;
  /** Whether transform mode is active */
  transformMode: boolean;
  /** Whether select mode is active */
  selectMode: boolean;
  /** Whether alignment mode is active */
  alignmentMode: boolean;

  // -------------------------------------------------------------------------
  // UI State
  // -------------------------------------------------------------------------
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;
  /** Handler to update snap-to-grid state */
  setSnapToGrid: (value: boolean) => void;
  /** Whether CRT filter is enabled */
  crtFilter: boolean;
  /** Handler to update CRT filter state */
  setCrtFilter: (value: boolean) => void;
  /** Whether dice roller panel is open */
  diceRollerOpen: boolean;
  /** Whether roll log panel is open */
  rollLogOpen: boolean;
  /** Handler to toggle dice roller panel */
  toggleDiceRoller: (value: boolean) => void;
  /** Handler to toggle roll log panel */
  toggleRollLog: (value: boolean) => void;
  /** Whether microphone is enabled */
  micEnabled: boolean;
  /** Handler to toggle microphone */
  toggleMic: () => void;
  /** Whether the grid is locked */
  gridLocked: boolean;
  /** Handler to toggle grid lock */
  setGridLocked: React.Dispatch<React.SetStateAction<boolean>>;

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------
  /** Current room state snapshot */
  snapshot: RoomSnapshot | null;
  /** Current user's UID */
  uid: string;
  /** Grid size (cells) */
  gridSize: number;
  /** Grid square size (feet per cell) */
  gridSquareSize: number;
  /** Whether current user is DM */
  isDM: boolean;

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------
  /** Current camera state */
  cameraState: { x: number; y: number; scale: number };
  /** Camera object (legacy) */
  camera: Camera;
  /** Camera command to execute */
  cameraCommand: { type: "focus-self" | "reset" } | null;
  /** Handler for when camera command is handled */
  handleCameraCommandHandled: () => void;
  /** Handler for camera state changes */
  setCameraState: (state: { x: number; y: number; scale: number }) => void;
  /** Handler to focus on self */
  handleFocusSelf: () => void;
  /** Handler to reset camera */
  handleResetCamera: () => void;

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------
  /** Drawing manager toolbar props */
  drawingToolbarProps: DrawingToolbarProps;
  /** Drawing manager drawing props */
  drawingProps: DrawingBoardProps;
  /** Handler to clear all drawings */
  handleClearDrawings: () => void;

  // -------------------------------------------------------------------------
  // Editing
  // -------------------------------------------------------------------------
  /** UID of player being name-edited */
  editingPlayerUID: string | null;
  /** Current name input value */
  nameInput: string;
  /** UID of player whose max HP is being edited */
  editingMaxHpUID: string | null;
  /** Current max HP input value */
  maxHpInput: string;
  /** Handler to update name input */
  updateNameInput: (value: string) => void;
  /** Handler to start name edit */
  startNameEdit: (uid: string) => void;
  /** Handler to submit name edit */
  submitNameEdit: (callback: (name: string) => void) => void;
  /** Handler to update max HP input */
  updateMaxHpInput: (value: string) => void;
  /** Handler to start max HP edit */
  startMaxHpEdit: (uid: string) => void;
  /** Handler to submit max HP edit */
  submitMaxHpEdit: (callback: (maxHp: number) => void) => void;

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------
  /** ID of currently selected object */
  selectedObjectId: string | null;
  /** IDs of all selected objects */
  selectedObjectIds: string[];
  /** Handler for single object selection */
  handleObjectSelection: (id: string | null) => void;
  /** Handler for batch object selection */
  handleObjectSelectionBatch: (ids: string[]) => void;
  /** Handler to lock selected objects */
  lockSelected: () => void;
  /** Handler to unlock selected objects */
  unlockSelected: () => void;

  // -------------------------------------------------------------------------
  // Player Actions
  // -------------------------------------------------------------------------
  /** Player action handlers */
  playerActions: {
    renamePlayer: (name: string) => void;
    setPortrait: (url: string) => void;
    setHP: (hp: number, maxHp: number) => void;
    applyPlayerState: (
      uid: string,
      state: { x: number; y: number; hp?: number; maxHp?: number },
    ) => void;
    setStatusEffects: (uid: string, effects: string[]) => void;
    setPlayerStagingZone: (zone: { x: number; y: number; width: number; height: number }) => void;
    addCharacter: (name: string) => void;
    deleteCharacter: (id: string) => void;
    updateCharacterName: (id: string, name: string) => void;
  };

  // -------------------------------------------------------------------------
  // Scene Objects
  // -------------------------------------------------------------------------
  /** Map scene object (if exists) */
  mapSceneObject: { id: string; locked: boolean; transform: any } | null;
  /** Staging zone scene object (if exists) */
  stagingZoneSceneObject: { id: string; locked: boolean } | null;
  /** Handler to recolor a token */
  recolorToken: (id: string, color: string) => void;
  /** Handler to transform a scene object */
  transformSceneObject: (transform: {
    id: string;
    position: { x: number; y: number };
    scale: { x: number; y: number };
    rotation: number;
  }) => void;
  /** Handler to toggle scene object lock */
  toggleSceneObjectLock: (id: string, locked: boolean) => void;
  /** Handler to delete a token */
  deleteToken: (id: string) => void;
  /** Handler to update token image */
  updateTokenImage: (id: string, imageUrl: string) => void;
  /** Handler to update token size */
  updateTokenSize: (id: string, size: number) => void;

  // -------------------------------------------------------------------------
  // Alignment
  // -------------------------------------------------------------------------
  /** Captured alignment points */
  alignmentPoints: AlignmentPoint[];
  /** Current alignment suggestion */
  alignmentSuggestion: AlignmentSuggestion | null;
  /** Alignment error message */
  alignmentError: string | null;
  /** Handler to start alignment */
  handleAlignmentStart: () => void;
  /** Handler to reset alignment points */
  handleAlignmentReset: () => void;
  /** Handler to cancel alignment */
  handleAlignmentCancel: () => void;
  /** Handler to apply alignment */
  handleAlignmentApply: () => void;
  /** Handler for alignment point capture */
  handleAlignmentPointCapture: (point: AlignmentPoint) => void;

  // -------------------------------------------------------------------------
  // Dice
  // -------------------------------------------------------------------------
  /** Roll history entries */
  rollHistory: RollHistoryEntry[];
  /** Currently viewing roll */
  viewingRoll: RollHistoryEntry | null;
  /** Handler for dice roll */
  handleRoll: (
    diceType: string,
    count: number,
    modifier: number,
    advantage?: boolean,
    disadvantage?: boolean,
  ) => void;
  /** Handler to clear roll log */
  handleClearLog: () => void;
  /** Handler to view a roll from history */
  handleViewRoll: (roll: RollHistoryEntry | null) => void;

  // -------------------------------------------------------------------------
  // Room Password
  // -------------------------------------------------------------------------
  /** Room password status message */
  roomPasswordStatus: string | null;
  /** Whether room password operation is pending */
  roomPasswordPending: boolean;
  /** Handler to set room password */
  handleSetRoomPassword: (password: string) => void;
  /** Handler to dismiss room password status */
  dismissRoomPasswordStatus: () => void;

  // -------------------------------------------------------------------------
  // NPC Management
  // -------------------------------------------------------------------------
  /** Handler to create NPC */
  handleCreateNPC: (npc: {
    name: string;
    hp: number;
    maxHp: number;
    ac: number;
    imageUrl?: string;
  }) => void;
  /** Handler to update NPC */
  handleUpdateNPC: (
    id: string,
    updates: { name?: string; hp?: number; maxHp?: number; ac?: number; imageUrl?: string },
  ) => void;
  /** Handler to delete NPC */
  handleDeleteNPC: (id: string) => void;
  /** Handler to place NPC token */
  handlePlaceNPCToken: (npcId: string, position: { x: number; y: number }) => void;
  /** Handler to delete player token */
  handleDeletePlayerToken: (tokenId: string) => void;

  // -------------------------------------------------------------------------
  // Prop Management
  // -------------------------------------------------------------------------
  /** Handler to create prop */
  handleCreateProp: (prop: { name: string; imageUrl: string }) => void;
  /** Handler to update prop */
  handleUpdateProp: (id: string, updates: { name?: string; imageUrl?: string }) => void;
  /** Handler to delete prop */
  handleDeleteProp: (id: string) => void;

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------
  /** Handler to save session */
  handleSaveSession: () => void;
  /** Handler to load session */
  handleLoadSession: () => void;

  // -------------------------------------------------------------------------
  // DM Management
  // -------------------------------------------------------------------------
  /** Handler to toggle DM mode */
  handleToggleDM: (targetUID: string) => void;
  /** Handler to set map background */
  setMapBackgroundURL: (url: string) => void;
  /** Handler to set grid size */
  setGridSize: (size: number) => void;
  /** Handler to set grid square size */
  setGridSquareSize: (size: number) => void;

  // -------------------------------------------------------------------------
  // Toast
  // -------------------------------------------------------------------------
  /** Toast notification state */
  toast: ToastState;

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------
  /** Handler to send messages to server */
  sendMessage: (message: ClientMessage) => void;
}

/**
 * MainLayout Component
 *
 * Pure presentation component that renders the complete application UI.
 * All state and behavior is passed in via props.
 *
 * Wrapped with React.memo for performance optimization to prevent
 * unnecessary re-renders during drag operations.
 */
export const MainLayout = React.memo(function MainLayout(props: MainLayoutProps): JSX.Element {
  const {
    // Layout state
    topHeight,
    bottomHeight,
    topPanelRef,
    bottomPanelRef,
    contextMenu,
    setContextMenu,

    // Connection state
    isConnected,

    // Tool state
    activeTool,
    setActiveTool,
    drawMode,
    pointerMode,
    measureMode,
    transformMode,
    selectMode,
    alignmentMode,

    // UI state
    snapToGrid,
    setSnapToGrid,
    crtFilter,
    setCrtFilter,
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    micEnabled,
    toggleMic,
    gridLocked,
    setGridLocked,

    // Data
    snapshot,
    uid,
    gridSize,
    gridSquareSize,
    isDM,

    // Camera
    cameraCommand,
    handleCameraCommandHandled,
    setCameraState,
    handleFocusSelf,
    handleResetCamera,
    camera,

    // Drawing
    drawingToolbarProps,
    drawingProps,
    handleClearDrawings,

    // Editing
    editingPlayerUID,
    nameInput,
    editingMaxHpUID,
    maxHpInput,
    updateNameInput,
    startNameEdit,
    submitNameEdit,
    updateMaxHpInput,
    startMaxHpEdit,
    submitMaxHpEdit,

    // Selection
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,
    lockSelected,
    unlockSelected,

    // Player actions
    playerActions,

    // Scene objects
    mapSceneObject,
    stagingZoneSceneObject,
    recolorToken,
    transformSceneObject,
    toggleSceneObjectLock,
    deleteToken,
    updateTokenImage,
    updateTokenSize,

    // Alignment
    alignmentPoints,
    alignmentSuggestion,
    alignmentError,
    handleAlignmentStart,
    handleAlignmentReset,
    handleAlignmentCancel,
    handleAlignmentApply,
    handleAlignmentPointCapture,

    // Dice
    rollHistory,
    viewingRoll,
    handleRoll,
    handleClearLog,
    handleViewRoll,

    // Room password
    roomPasswordStatus,
    roomPasswordPending,
    handleSetRoomPassword,
    dismissRoomPasswordStatus,

    // NPC management
    handleCreateNPC,
    handleUpdateNPC,
    handleDeleteNPC,
    handlePlaceNPCToken,
    handleDeletePlayerToken,

    // Prop management
    handleCreateProp,
    handleUpdateProp,
    handleDeleteProp,

    // Session management
    handleSaveSession,

    // DM management
    handleToggleDM,
    setMapBackgroundURL,
    setGridSize,
    setGridSquareSize,

    // Toast
    toast,

    // WebSocket
    sendMessage,
  } = props;

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Server Status Banner */}
      <ServerStatus isConnected={isConnected} />

      {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
      {drawMode && <DrawingToolbar {...drawingToolbarProps} />}

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
        onClearDrawings={handleClearDrawings}
        onSetMapBackground={setMapBackgroundURL}
        mapBackground={snapshot?.mapBackground}
        playerStagingZone={snapshot?.playerStagingZone}
        onSetPlayerStagingZone={playerActions.setPlayerStagingZone}
        camera={camera}
        playerCount={snapshot?.players?.length ?? 0}
        characters={snapshot?.characters || []}
        onRequestSaveSession={snapshot ? handleSaveSession : undefined}
        onRequestLoadSession={undefined} // handleLoadSession is not exposed in the original render
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
});
