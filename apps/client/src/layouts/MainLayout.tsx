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

import React, { useCallback } from "react";
import type { MainLayoutProps, RollLogEntry } from "./props/MainLayoutProps";
import { TopPanelLayout } from "./TopPanelLayout";
import { CenterCanvasLayout } from "./CenterCanvasLayout";
import { FloatingPanelsLayout } from "./FloatingPanelsLayout";
import { BottomPanelLayout } from "./BottomPanelLayout";
import { useEntityEditHandlers } from "../hooks/useEntityEditHandlers";
import { useInitiativeSetting } from "../hooks/useInitiativeSetting";
import { useNpcVisibility } from "../hooks/useNpcVisibility";
import { PublicTableNotice } from "../features/rooms/PublicTableNotice";
import { buildDMMenuProps } from "../features/dm/buildDMMenuProps";

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
    remoteMeasurements,
    transformMode,
    selectMode,
    alignmentMode,
    mapEditMode,
    mapEditActiveSubTool,
    mapEditFloorFamily,
    mapEditRoomWallFamily,
    mapEditSelectedAssetId,
    mapEditHallwayWidth,
    mapEditSplineKind,
    mapEditPopulateGhosts,
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

    // UI state
    snapToGrid,
    setSnapToGrid,
    crtFilter,
    setCrtFilter,
    playerLens,
    onTogglePlayerLens,
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    micEnabled,
    toggleMic,

    // Data
    uid,
    gridSize,
    isDM,
    snapshot,
    playerActions,

    // Camera
    cameraCommand,
    handleCameraCommandHandled,
    setCameraState,
    handleFocusToken,
    handleResetCamera,

    // Drawing
    drawingToolbarProps,
    drawingProps,

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
    onCharacterPortraitUpdate,

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
    toggleSceneObjectLock,
    deleteToken,
    updateTokenImage,
    updateTokenSize,
    updateTokenVisionRadius,

    // Alignment
    alignmentPoints,
    alignmentSuggestion,
    handleAlignmentPointCapture,

    // Dice
    rollHistory,
    chatMessages,
    handleSendChat,
    viewingRoll,
    handleRoll,
    latestOwnRoll,
    handleClearLog,
    handleViewRoll,

    // DM management (hooks now in DMMenuContainer; the rename/derive wiring
    // now lives in buildDMMenuProps)
    handleToggleDM,

    // Toast
    toast,

    // WebSocket
    sendMessage,
    mapStudio,
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

  // DM-only NPC visibility toggles
  const { toggleNpcVisibility } = useNpcVisibility({ sendMessage });

  // The one mapping from the props bag onto DMMenuContainer's shape — shared
  // with the mobile shell, so a DM feature is wired once, not per layout.
  // setInitiative rides as an extra because it is a hook result, not bag state.
  const dmMenuProps = buildDMMenuProps(props, { setInitiative });

  // Turn navigation handlers for combat controls
  const handleNextTurn = useCallback(() => {
    sendMessage({ t: "next-turn" });
  }, [sendMessage]);

  const handlePreviousTurn = useCallback(() => {
    sendMessage({ t: "previous-turn" });
  }, [sendMessage]);

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Marks the shared default table for anyone who bookmarked its URL and
          never saw the join screen. Driven by the live snapshot flag, not the
          room id: setting a password claims the table and this goes away.
          Rendered here rather than in TopPanelLayout because the snapshot is
          already in scope — no new prop to thread through the layout fixtures. */}
      {snapshot?.isPublicTable ? <PublicTableNotice variant="chip" /> : null}
      {/* Top Panel - Server status, drawing toolbar, header, and multi-select toolbar */}
      <TopPanelLayout
        isConnected={isConnected}
        drawMode={drawMode}
        drawingToolbarProps={drawingToolbarProps}
        mapEditMode={mapEditMode}
        mapEditToolbarProps={mapEditToolbarProps}
        uid={uid}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        crtFilter={crtFilter}
        setCrtFilter={setCrtFilter}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        playerLens={playerLens}
        onTogglePlayerLens={onTogglePlayerLens}
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
        playerLens={playerLens}
        pointerMode={pointerMode}
        measureMode={measureMode}
        remoteMeasurements={remoteMeasurements}
        drawMode={drawMode}
        transformMode={transformMode}
        selectMode={selectMode}
        alignmentMode={alignmentMode}
        mapEditMode={mapEditMode}
        mapEditActiveSubTool={mapEditActiveSubTool}
        mapEditFloorFamily={mapEditFloorFamily}
        mapEditRoomWallFamily={mapEditRoomWallFamily}
        mapEditSelectedAssetId={mapEditSelectedAssetId}
        mapEditHallwayWidth={mapEditHallwayWidth}
        mapEditSplineKind={mapEditSplineKind}
        mapEditPopulateGhosts={mapEditPopulateGhosts}
        mapEditWheelActions={mapEditWheelActions}
        mapEditSelectedElementId={mapEditSelectedElementId}
        mapEditWallsOverlayPinned={mapEditWallsOverlayPinned}
        onMapEditRoomRejected={onMapEditRoomRejected}
        onMapEditGestureDropped={onMapEditGestureDropped}
        onMapEditRegionPlaced={onMapEditRegionPlaced}
        onMapEditRegionDragged={onMapEditRegionDragged}
        onMapEditSelectElement={onMapEditSelectElement}
        onMapEditSampleAsset={onMapEditSampleAsset}
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
        mapStudio={mapStudio}
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
        onCharacterPortraitUpdate={onCharacterPortraitUpdate}
        onToggleMic={toggleMic}
        onToggleDMMode={handleToggleDM}
        onApplyPlayerState={playerActions.applyPlayerState}
        onStatusEffectsChange={playerActions.setStatusEffects}
        onCharacterStatusEffectsChange={playerActions.setCharacterStatusEffects}
        onCharacterNameUpdate={playerActions.updateCharacterName}
        onNpcUpdate={undefined}
        onNpcDelete={undefined}
        onNpcPlaceToken={undefined}
        onNpcToggleVisibility={isDM ? toggleNpcVisibility : undefined}
        // Was hardcoded undefined, which (together with an impossible isDM gate
        // in PlayerSettingsMenu) meant a DM had no way to remove a player's
        // token and the confirm string written for it was unreachable code.
        onPlayerTokenDelete={isDM ? deleteToken : undefined}
        isDeletingNpc={undefined}
        npcDeletionError={undefined}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        onTokenVisionRadiusChange={updateTokenVisionRadius}
        onTokenImageChange={updateTokenImage}
        onAddCharacter={playerActions.addCharacter}
        onDeleteCharacter={playerActions.deleteCharacter}
        onFocusToken={handleFocusToken}
        combatActive={snapshot?.combatActive}
        currentTurnCharacterId={snapshot?.currentTurnCharacterId}
        onSetInitiative={setInitiative}
        isSettingInitiative={isSettingInitiative}
        initiativeError={initiativeError}
        onClearInitiative={clearInitiative}
        onNextTurn={handleNextTurn}
        onPreviousTurn={handlePreviousTurn}
      />

      {/* Floating Panels - DM menu, context menu, visual effects, dice roller, roll log, toasts */}
      <FloatingPanelsLayout
        isDM={isDM}
        contextMenu={contextMenu}
        deleteToken={deleteToken}
        setContextMenu={setContextMenu}
        dmMenuProps={dmMenuProps}
        snapshot={snapshot}
        diceRollerOpen={diceRollerOpen}
        toggleDiceRoller={toggleDiceRoller}
        handleRoll={handleRoll}
        latestOwnRoll={latestOwnRoll}
        rollLogOpen={rollLogOpen}
        rollHistory={rollHistory}
        chatMessages={chatMessages}
        handleSendChat={handleSendChat}
        uid={uid}
        viewingRoll={viewingRoll}
        toggleRollLog={toggleRollLog}
        handleClearLog={handleClearLog}
        handleViewRoll={handleViewRoll}
        crtFilter={crtFilter}
        toast={toast}
      />
    </div>
  );
});
