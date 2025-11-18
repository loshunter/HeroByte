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
import type { MainLayoutProps, RollLogEntry } from "./props/MainLayoutProps";
import { TopPanelLayout } from "./TopPanelLayout";
import { CenterCanvasLayout } from "./CenterCanvasLayout";
import { FloatingPanelsLayout } from "./FloatingPanelsLayout";
import { BottomPanelLayout } from "./BottomPanelLayout";
import { useEntityEditHandlers } from "../hooks/useEntityEditHandlers";
import { useInitiativeSetting } from "../hooks/useInitiativeSetting";

// Re-export for backward compatibility
export type { MainLayoutProps, RollLogEntry };

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
    uid,
    gridSize,
    gridSquareSize,
    isDM,
    snapshot,
    playerActions,

    // Camera
    cameraCommand,
    handleCameraCommandHandled,
    setCameraState,
    handleFocusToken,
    handleResetCamera,
    camera,

    // Drawing
    drawingToolbarProps,
    drawingProps,
    handleClearDrawings,

    // Editing
    editingPlayerUID,
    editingHpUID,
    editingMaxHpUID,
    editingTempHpUID,
    nameInput,
    hpInput,
    maxHpInput,
    tempHpInput,
    updateNameInput,
    startNameEdit,
    updateHpInput,
    startHpEdit,
    updateMaxHpInput,
    startMaxHpEdit,
    updateTempHpInput,
    startTempHpEdit,
    submitHpEdit,
    submitMaxHpEdit,
    submitTempHpEdit,
    submitNameEdit,

    // Selection
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,
    lockSelected,
    unlockSelected,
    selectPlayerTokens,

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
    isDeletingNpc,
    npcDeletionError,
    isCreatingNpc,
    npcCreationError,
    isUpdatingNpc,
    npcUpdateError,
    updatingNpcId,
    isPlacingToken,
    tokenPlacementError,
    placingTokenForNpcId,
    handlePlaceNPCToken,
    handleToggleNPCVisibility,
    handleDeletePlayerToken,

    // Prop management
    handleCreateProp,
    handleUpdateProp,
    handleDeleteProp,
    isCreatingProp,
    propCreationError,
    isDeletingProp,
    deletingPropId,
    propDeletionError,
    isUpdatingProp,
    propUpdateError,
    updatingPropId,

    // Session management
    handleSaveSession,
    handleLoadSession,

    // DM management
    handleToggleDM,
    setMapBackgroundURL,
    setGridSize,
    setGridSquareSize,

    // Toast
    toast,

    // WebSocket
    sendMessage,

    // Combat controls
    onStartCombat,
    onEndCombat,
    onClearAllInitiative,
    onNextTurn,
    onPreviousTurn,
    onClearInitiative: onClearInitiativeProp,
  } = props;

  // Extract entity editing handlers to custom hook
  const {
    handleCharacterHpSubmit,
    handleCharacterMaxHpSubmit,
    handleCharacterTempHpSubmit,
    handlePortraitLoad,
    handleNameSubmit,
  } = useEntityEditHandlers({
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

  // Initiative setting hook for server-confirmed updates
  const {
    isSetting: isSettingInitiative,
    setInitiative,
    clearInitiative,
    error: initiativeError,
  } = useInitiativeSetting({
    snapshot,
    sendMessage,
  });

  const clearInitiativeHandler = onClearInitiativeProp ?? clearInitiative;

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Top Panel - Server status, drawing toolbar, header, and multi-select toolbar */}
      <TopPanelLayout
        isConnected={isConnected}
        drawMode={drawMode}
        drawingToolbarProps={drawingToolbarProps}
        uid={uid}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        crtFilter={crtFilter}
        setCrtFilter={setCrtFilter}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        toggleDiceRoller={toggleDiceRoller}
        toggleRollLog={toggleRollLog}
        handleResetCamera={handleResetCamera}
        topPanelRef={topPanelRef}
        topHeight={topHeight}
        selectedObjectIds={selectedObjectIds}
        isDM={isDM}
        lockSelected={lockSelected}
        unlockSelected={unlockSelected}
      />

      {/* Center Canvas - MapBoard with dynamic top/bottom spacing */}
      <CenterCanvasLayout
        topHeight={topHeight}
        bottomHeight={bottomHeight}
        snapshot={snapshot}
        uid={uid}
        gridSize={gridSize}
        snapToGrid={snapToGrid}
        isDM={isDM}
        pointerMode={pointerMode}
        measureMode={measureMode}
        drawMode={drawMode}
        transformMode={transformMode}
        selectMode={selectMode}
        alignmentMode={alignmentMode}
        selectedObjectId={selectedObjectId}
        selectedObjectIds={selectedObjectIds}
        onSelectObject={handleObjectSelection}
        onSelectObjects={handleObjectSelectionBatch}
        cameraCommand={cameraCommand}
        onCameraCommandHandled={handleCameraCommandHandled}
        onCameraChange={setCameraState}
        alignmentPoints={alignmentPoints}
        alignmentSuggestion={alignmentSuggestion}
        onAlignmentPointCapture={handleAlignmentPointCapture}
        onRecolorToken={recolorToken}
        onTransformObject={transformSceneObject}
        drawingProps={drawingProps}
        sendMessage={sendMessage}
      />

      {/* Bottom Panel - Entities HUD with player/character/NPC management */}
      <BottomPanelLayout
        bottomPanelRef={bottomPanelRef}
        players={snapshot?.players || []}
        characters={snapshot?.characters || []}
        tokens={snapshot?.tokens || []}
        sceneObjects={snapshot?.sceneObjects || []}
        drawings={snapshot?.drawings || []}
        uid={uid}
        micEnabled={micEnabled}
        currentIsDM={isDM}
        editingPlayerUID={editingPlayerUID}
        nameInput={nameInput}
        onNameInputChange={updateNameInput}
        onNameEdit={startNameEdit}
        onNameSubmit={handleNameSubmit}
        editingHpUID={editingHpUID}
        hpInput={hpInput}
        onHpInputChange={updateHpInput}
        onHpEdit={startHpEdit}
        onHpSubmit={handleCharacterHpSubmit}
        onCharacterHpChange={playerActions.updateCharacterHP}
        editingMaxHpUID={editingMaxHpUID}
        maxHpInput={maxHpInput}
        onMaxHpInputChange={updateMaxHpInput}
        onMaxHpEdit={startMaxHpEdit}
        onMaxHpSubmit={handleCharacterMaxHpSubmit}
        editingTempHpUID={editingTempHpUID}
        tempHpInput={tempHpInput}
        onTempHpInputChange={updateTempHpInput}
        onTempHpEdit={startTempHpEdit}
        onTempHpSubmit={handleCharacterTempHpSubmit}
        onPortraitLoad={handlePortraitLoad}
        onToggleMic={toggleMic}
        onToggleDMMode={handleToggleDM}
        onApplyPlayerState={playerActions.applyPlayerState}
        onStatusEffectsChange={playerActions.setStatusEffects}
        onCharacterStatusEffectsChange={playerActions.setCharacterStatusEffects}
        onCharacterNameUpdate={playerActions.updateCharacterName}
        onNpcUpdate={handleUpdateNPC}
        onNpcDelete={handleDeleteNPC}
        onNpcPlaceToken={handlePlaceNPCToken}
        onNpcToggleVisibility={handleToggleNPCVisibility}
        onPlayerTokenDelete={handleDeletePlayerToken}
        isDeletingNpc={isDeletingNpc}
        npcDeletionError={npcDeletionError}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        onTokenImageChange={updateTokenImage}
        onAddCharacter={playerActions.addCharacter}
        onDeleteCharacter={playerActions.deleteCharacter}
        onFocusToken={handleFocusToken}
        combatActive={snapshot?.combatActive}
        currentTurnCharacterId={snapshot?.currentTurnCharacterId}
        onSetInitiative={setInitiative}
        isSettingInitiative={isSettingInitiative}
        initiativeError={initiativeError}
        onClearInitiative={clearInitiativeHandler}
        onNextTurn={onNextTurn}
        onPreviousTurn={onPreviousTurn}
      />

      {/* Floating Panels - DM menu, context menu, visual effects, dice roller, roll log, toasts */}
      <FloatingPanelsLayout
        isDM={isDM}
        contextMenu={contextMenu}
        deleteToken={deleteToken}
        setContextMenu={setContextMenu}
        gridSize={gridSize}
        gridSquareSize={gridSquareSize}
        gridLocked={gridLocked}
        onGridSizeChange={setGridSize}
        onGridSquareSizeChange={setGridSquareSize}
        onToggleDM={handleToggleDM}
        onGridLockToggle={() => setGridLocked((prev) => !prev)}
        onClearDrawings={handleClearDrawings}
        camera={camera}
        snapshot={snapshot}
        selectPlayerTokens={selectPlayerTokens}
        mapSceneObject={mapSceneObject}
        stagingZoneSceneObject={stagingZoneSceneObject}
        onSetMapBackground={setMapBackgroundURL}
        toggleSceneObjectLock={toggleSceneObjectLock}
        transformSceneObject={transformSceneObject}
        onSetPlayerStagingZone={playerActions.setPlayerStagingZone}
        alignmentMode={alignmentMode}
        alignmentPoints={alignmentPoints}
        alignmentSuggestion={alignmentSuggestion}
        alignmentError={alignmentError}
        onAlignmentStart={handleAlignmentStart}
        onAlignmentReset={handleAlignmentReset}
        onAlignmentCancel={handleAlignmentCancel}
        onAlignmentApply={handleAlignmentApply}
        onRequestSaveSession={snapshot ? handleSaveSession : undefined}
        onRequestLoadSession={handleLoadSession}
        onCreateNPC={handleCreateNPC}
        onUpdateNPC={handleUpdateNPC}
        onDeleteNPC={handleDeleteNPC}
        isCreatingNpc={isCreatingNpc}
        npcCreationError={npcCreationError}
        isUpdatingNpc={isUpdatingNpc}
        npcUpdateError={npcUpdateError}
        updatingNpcId={updatingNpcId}
        isPlacingToken={isPlacingToken}
        tokenPlacementError={tokenPlacementError}
        placingTokenForNpcId={placingTokenForNpcId}
        onPlaceNPCToken={handlePlaceNPCToken}
        onCreateProp={handleCreateProp}
        onUpdateProp={handleUpdateProp}
        onDeleteProp={handleDeleteProp}
        isCreatingProp={isCreatingProp}
        propCreationError={propCreationError}
        isDeletingProp={isDeletingProp}
        deletingPropId={deletingPropId}
        propDeletionError={propDeletionError}
        isUpdatingProp={isUpdatingProp}
        propUpdateError={propUpdateError}
        updatingPropId={updatingPropId}
        onSetRoomPassword={handleSetRoomPassword}
        roomPasswordStatus={roomPasswordStatus}
        roomPasswordPending={roomPasswordPending}
        onDismissRoomPasswordStatus={dismissRoomPasswordStatus}
        diceRollerOpen={diceRollerOpen}
        toggleDiceRoller={toggleDiceRoller}
        handleRoll={handleRoll}
        rollLogOpen={rollLogOpen}
        rollHistory={rollHistory}
        viewingRoll={viewingRoll}
        toggleRollLog={toggleRollLog}
        handleClearLog={handleClearLog}
        handleViewRoll={handleViewRoll}
        crtFilter={crtFilter}
        toast={toast}
        combatActive={snapshot?.combatActive}
        onStartCombat={onStartCombat}
        onEndCombat={onEndCombat}
        onClearAllInitiative={onClearAllInitiative}
        onNextTurn={onNextTurn}
        onPreviousTurn={onPreviousTurn}
        onSetInitiative={setInitiative}
      />
    </div>
  );
});
