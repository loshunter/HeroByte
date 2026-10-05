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

import React, { useCallback, useState } from "react";
import type { MainLayoutProps, RollLogEntry } from "./props/MainLayoutProps";
import { TopPanelLayout } from "./TopPanelLayout";
import { CenterCanvasLayout } from "./CenterCanvasLayout";
import { FloatingPanelsLayout } from "./FloatingPanelsLayout";
import { BottomPanelLayout } from "./BottomPanelLayout";
import { usePartyNpcActions } from "../components/layout/party/usePartyNpcActions";
import { useEntityEditHandlers } from "../hooks/useEntityEditHandlers";
import { useInitiativeSetting } from "../hooks/useInitiativeSetting";
import { useNpcVisibility } from "../hooks/useNpcVisibility";
import { buildDMMenuProps } from "../features/dm/buildDMMenuProps";
import { useTableMenuProps } from "../features/table/tableMenuProps";
import { manualInitiativeAllowedFor } from "../features/initiative/manualOverride";
import { useDMThroughBlip } from "../features/table/roleKnown";

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
  // The Table menu's facts, held through a reconnect's empty snapshot (see the hook).
  const tableMenu = useTableMenuProps(props);
  const {
    // Layout state
    topHeight,
    bottomHeight,
    topPanelRef,
    bottomPanelRef,
    contextMenu,
    setContextMenu,

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
    linkAimActive,
    captureLinkAnchor,
    kick,
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

    // UI state
    snapToGrid,
    setSnapToGrid,
    crtFilter,
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
    updateCharacterSpeed,
    resetCharacterBudget,

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
    handleEnterRoll,
    canEnterOver,
    latestOwnRoll,
    handleClearLog,
    handleViewRoll,

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

  // Initiative setting hook for server-confirmed updates: ONE instance, shared
  // by the Party and the DM menu's Encounter (one pending state, U8).
  const initiativeSetting = useInitiativeSetting({ snapshot, sendMessage });
  const {
    isSetting: isSettingInitiative,
    setInitiative,
    clearInitiative,
    rollInitiative,
    error: initiativeError,
  } = initiativeSetting;

  // DM-only NPC visibility toggles
  const { toggleNpcVisibility } = useNpcVisibility({ sendMessage });
  // The party cards' DM-only handlers hold through a reconnect blip (roleKnown).
  const partyIsDM = useDMThroughBlip(isDM);

  // The one mapping from the props bag onto DMMenuContainer's shape — shared
  // with the mobile shell, so a DM feature is wired once, not per layout.
  // The initiative actions ride as an extra: a hook result, not bag state.
  const dmMenuProps = buildDMMenuProps(props, { initiative: initiativeSetting });

  // Turn navigation handlers for combat controls
  const handleNextTurn = useCallback(() => {
    sendMessage({ t: "next-turn" });
  }, [sendMessage]);

  // The Party bar's launcher dock (U7): the bar reports its slot, and the
  // floating layer's launchers render into it instead of over the cards.
  const [launcherDock, setLauncherDock] = useState<HTMLDivElement | null>(null);

  // The Party's NPC cards act for the DM (they were wired to undefined).
  const partyNpcActions = usePartyNpcActions(snapshot?.characters, sendMessage, partyIsDM);

  const handlePreviousTurn = useCallback(() => {
    sendMessage({ t: "previous-turn" });
  }, [sendMessage]);

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Top Panel - drawing toolbar, header (the Table button carries the
          connection; the public-table warning is a row of the header), and
          multi-select toolbar */}
      <TopPanelLayout
        tableMenu={tableMenu}
        drawMode={drawMode}
        drawingToolbarProps={drawingToolbarProps}
        mapEditMode={mapEditMode}
        mapEditToolbarProps={mapEditToolbarProps}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
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
        linkAimMode={linkAimActive ?? false}
        onLinkAnchorCapture={captureLinkAnchor}
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
        launcherDockRef={setLauncherDock}
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
        onCharacterPortraitUpdate={onCharacterPortraitUpdate}
        onToggleMic={toggleMic}
        onApplyPlayerState={playerActions.applyPlayerState}
        onStatusEffectsChange={playerActions.setStatusEffects}
        onCharacterStatusEffectsChange={playerActions.setCharacterStatusEffects}
        onCharacterNameUpdate={playerActions.updateCharacterName}
        onNpcUpdate={partyNpcActions.onNpcUpdate}
        onNpcDelete={partyNpcActions.onNpcDelete}
        onNpcPlaceToken={partyNpcActions.onNpcPlaceToken}
        onNpcToggleVisibility={partyIsDM ? toggleNpcVisibility : undefined}
        // Was hardcoded undefined, which (together with an impossible isDM gate
        // in PlayerSettingsMenu) meant a DM had no way to remove a player's
        // token and the confirm string written for it was unreachable code.
        onPlayerTokenDelete={partyIsDM ? deleteToken : undefined}
        isDeletingNpc={undefined}
        npcDeletionError={undefined}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        onCharacterOwnerChange={(characterId, ownerUid) =>
          sendMessage({ t: "set-character-owner", characterId, ownerUid })
        }
        onTokenVisionRadiusChange={updateTokenVisionRadius}
        onCharacterSpeedChange={updateCharacterSpeed}
        onCharacterBudgetReset={resetCharacterBudget}
        tableVisionDefault={snapshot?.defaultVisionRadius}
        onTokenImageChange={updateTokenImage}
        onAddCharacter={playerActions.addCharacter}
        onDeleteCharacter={playerActions.deleteCharacter}
        onFocusToken={handleFocusToken}
        combatActive={snapshot?.combatActive}
        currentTurnCharacterId={snapshot?.currentTurnCharacterId}
        onSetInitiative={setInitiative}
        onRollInitiative={rollInitiative}
        manualInitiativeAllowed={manualInitiativeAllowedFor(snapshot, isDM)}
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
        onStartLiveMap={mapEditToolbarProps.onStartLiveMap}
        dmMenuProps={dmMenuProps}
        launcherDock={launcherDock}
        snapshot={snapshot}
        kick={kick}
        diceRollerOpen={diceRollerOpen}
        toggleDiceRoller={toggleDiceRoller}
        handleRoll={handleRoll}
        handleEnterRoll={handleEnterRoll}
        canEnterOver={canEnterOver}
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
