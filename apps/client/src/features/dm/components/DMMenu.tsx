import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import MapTab from "./tab-views/MapTab";
import NPCsTab from "./tab-views/NPCsTab";
import PropsTab from "./tab-views/PropsTab";
import PlayersTab from "./tab-views/PlayersTab";
import SessionTab from "./tab-views/SessionTab";
import { useDMMenuState } from "../hooks/useDMMenuState";
import { DMMenuTabs } from "./DMMenuTabs";
import type { DMMenuProps } from "./DMMenu.types";

export function DMMenu({
  isDM,
  onToggleDM,
  gridSize,
  gridSquareSize = 5,
  gridLocked,
  onGridLockToggle,
  onGridSizeChange,
  onGridSquareSizeChange,
  fogEnabled,
  hasCompiledScene,
  onFogEnabledChange,
  onClearDrawings,
  onSetMapBackground,
  mapBackground,
  onMapBackgroundSuccess,
  onMapBackgroundError,
  playerStagingZone,
  onSetPlayerStagingZone,
  stagingZoneLocked,
  onStagingZoneLockToggle,
  camera,
  playerCount,
  characters,
  onRequestSaveSession,
  onRequestLoadSession,
  onCreateNPC,
  onUpdateNPC,
  onDeleteNPC,
  onPlaceNPCToken,
  isCreatingNpc,
  npcCreationError,
  isUpdatingNpc,
  npcUpdateError,
  updatingNpcId,
  isPlacingToken,
  tokenPlacementError,
  placingTokenForNpcId,
  props,
  players,
  onCreateProp,
  onUpdateProp,
  onDeleteProp,
  isCreatingProp,
  propCreationError,
  isDeletingProp,
  deletingPropId,
  propDeletionError,
  isUpdatingProp,
  propUpdateError,
  updatingPropId,
  mapLocked,
  onMapLockToggle,
  mapTransform,
  onMapTransformChange,
  alignmentModeActive,
  alignmentPoints,
  alignmentSuggestion,
  alignmentError,
  onAlignmentStart,
  onAlignmentReset,
  onAlignmentCancel,
  onAlignmentApply,
  onSetRoomPassword,
  roomPasswordStatus = null,
  roomPasswordPending = false,
  onDismissRoomPasswordStatus,
  sceneObjects,
  onSelectPlayerTokens,
  combatActive,
  onStartCombat,
  onEndCombat,
  onClearAllInitiative,
  onNextTurn,
  onPreviousTurn,
  toast,
  onSetInitiative,
  mapStudio,
  onOpenMapStudio,
}: DMMenuProps) {
  const { open, setOpen, toggleOpen, activeTab, setActiveTab, sessionName, setSessionName, npcs } =
    useDMMenuState({
      isDM,
      characters,
    });

  if (!isDM) {
    return null;
  }

  const handleOpenMapStudio = () => {
    setOpen(false);
    onOpenMapStudio?.();
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "32px",
          right: "32px",
          zIndex: 150,
        }}
      >
        <JRPGButton
          onClick={toggleOpen}
          variant={open ? "primary" : "default"}
          style={{ fontSize: "10px", padding: "10px 16px" }}
        >
          🛠️ DM MENU
        </JRPGButton>
      </div>

      {open && (
        <DraggableWindow
          title="Dungeon Master Tools"
          onClose={() => setOpen(false)}
          initialX={typeof window !== "undefined" ? window.innerWidth - 420 : 100}
          initialY={100}
          width={400}
          minWidth={360}
          maxWidth={500}
          storageKey="dm-menu"
          zIndex={1002}
        >
          <div style={{ padding: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <JRPGButton
                onClick={() => onToggleDM(false)}
                variant="danger"
                style={{ fontSize: "10px", padding: "6px 12px" }}
              >
                🔓 EXIT DM MODE
              </JRPGButton>
            </div>

            <DMMenuTabs activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === "map" && (
              <MapTab
                mapBackground={mapBackground}
                onSetMapBackground={onSetMapBackground}
                onMapBackgroundSuccess={onMapBackgroundSuccess}
                onMapBackgroundError={onMapBackgroundError}
                mapTransform={mapTransform}
                mapLocked={mapLocked}
                onMapTransformChange={onMapTransformChange}
                onMapLockToggle={onMapLockToggle}
                gridSize={gridSize}
                gridSquareSize={gridSquareSize}
                gridLocked={gridLocked}
                onGridSizeChange={onGridSizeChange}
                onGridSquareSizeChange={onGridSquareSizeChange}
                onGridLockToggle={onGridLockToggle}
                fogEnabled={fogEnabled}
                hasCompiledScene={hasCompiledScene}
                onFogEnabledChange={onFogEnabledChange}
                alignmentModeActive={alignmentModeActive}
                alignmentPoints={alignmentPoints}
                alignmentSuggestion={alignmentSuggestion}
                alignmentError={alignmentError}
                onAlignmentStart={onAlignmentStart}
                onAlignmentReset={onAlignmentReset}
                onAlignmentCancel={onAlignmentCancel}
                onAlignmentApply={onAlignmentApply}
                playerStagingZone={playerStagingZone}
                camera={camera}
                stagingZoneLocked={stagingZoneLocked}
                onStagingZoneLockToggle={onStagingZoneLockToggle}
                onSetPlayerStagingZone={onSetPlayerStagingZone}
                onClearDrawings={onClearDrawings}
                mapStudio={mapStudio}
                onOpenMapStudio={handleOpenMapStudio}
              />
            )}
            {activeTab === "npcs" && (
              <NPCsTab
                npcs={npcs}
                onCreateNPC={onCreateNPC}
                onUpdateNPC={onUpdateNPC}
                onPlaceNPCToken={onPlaceNPCToken}
                onDeleteNPC={onDeleteNPC}
                isCreatingNpc={isCreatingNpc}
                npcCreationError={npcCreationError}
                isUpdatingNpc={isUpdatingNpc}
                npcUpdateError={npcUpdateError}
                updatingNpcId={updatingNpcId}
                isPlacingToken={isPlacingToken}
                tokenPlacementError={tokenPlacementError}
                placingTokenForNpcId={placingTokenForNpcId}
                toast={toast}
                onSetInitiative={onSetInitiative}
              />
            )}
            {activeTab === "props" && (
              <PropsTab
                props={props}
                players={players}
                onCreateProp={onCreateProp}
                onUpdateProp={onUpdateProp}
                onDeleteProp={onDeleteProp}
                isCreatingProp={isCreatingProp}
                propCreationError={propCreationError}
                isDeletingProp={isDeletingProp}
                deletingPropId={deletingPropId}
                propDeletionError={propDeletionError}
                isUpdatingProp={isUpdatingProp}
                propUpdateError={propUpdateError}
                updatingPropId={updatingPropId}
              />
            )}
            {activeTab === "players" && (
              <PlayersTab
                players={players}
                sceneObjects={sceneObjects}
                onSelectPlayerTokens={onSelectPlayerTokens}
                combatActive={combatActive}
                onStartCombat={onStartCombat}
                onEndCombat={onEndCombat}
                onClearAllInitiative={onClearAllInitiative}
                onNextTurn={onNextTurn}
                onPreviousTurn={onPreviousTurn}
              />
            )}
            {activeTab === "session" && (
              <SessionTab
                sessionName={sessionName}
                setSessionName={setSessionName}
                onRequestSaveSession={onRequestSaveSession}
                onRequestLoadSession={onRequestLoadSession}
                saveDisabled={!onRequestSaveSession}
                loadDisabled={!onRequestLoadSession}
                onSetRoomPassword={onSetRoomPassword}
                roomPasswordStatus={roomPasswordStatus}
                roomPasswordPending={roomPasswordPending}
                onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
                playerCount={playerCount}
              />
            )}
          </div>
        </DraggableWindow>
      )}
    </>
  );
}
