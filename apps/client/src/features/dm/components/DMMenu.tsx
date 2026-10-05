import { activatePanelLauncher } from "../../interaction/useExplicitDismissal";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { AtlasTab } from "../../atlas/AtlasTab";
import { EncounterTab } from "../../encounter/EncounterTab";
import MapTab from "./tab-views/MapTab";
import NPCsTab from "./tab-views/NPCsTab";
import PropsTab from "./tab-views/PropsTab";
import TableTab from "../../table/tab/TableTab";
import { useDMMenuState } from "../hooks/useDMMenuState";
import { DMMenuTabs } from "./DMMenuTabs";
import type { DMMenuProps } from "./DMMenu.types";
import { DockedLauncher, LAUNCHER_ORDER } from "../../../components/layout/party/LauncherDock";

export function DMMenu({
  isDM,
  gridSize,
  gridSquareSize = 5,
  gridLocked,
  onGridLockToggle,
  onGridSizeChange,
  onGridSquareSizeChange,
  fogEnabled,
  hasCompiledScene,
  liveSceneDocumentId,
  liveMapDocumentId,
  onUseMapAtTable,
  onFogEnabledChange,
  defaultVisionRadius,
  onDefaultVisionRadiusChange,
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
  characters,
  atlasNodes,
  atlasLinks,
  currentAtlasNodeId,
  onAtlasMessage,
  linkAimActive,
  onArmLinkAim,
  onOpenKick,
  onCreateNPC,
  customTokens,
  onAddCustomToken,
  onRemoveCustomToken,
  onDuplicateNPC,
  onUpdateNPC,
  onSetNPCSpeed,
  onResetNPCBudget,
  onDeleteNPC,
  onPlaceNPCToken,
  onSetNPCStatusEffects,
  onFocusNPCToken,
  mapTokenIds,
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
  lockedPropIds,
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
  combatActive,
  diagonalRule,
  onDiagonalRuleChange,
  encounter,
  table,
  toast,
  mapStudio,
  presentation = "window",
  launcherDock,
}: DMMenuProps) {
  const {
    open,
    setOpen,
    toggleOpen,
    focusTabRequest,
    activeTab,
    setActiveTab,
    sessionName,
    setSessionName,
    npcs,
  } = useDMMenuState({ isDM, characters });

  if (!isDM) {
    return null;
  }

  // Shared between both presentations: the window wraps it, the mobile DM
  // screen renders it bare (the screen already provides surface and exit).
  const content = (
    <div style={{ padding: "12px" }}>
      <DMMenuTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scrollable={presentation === "content"}
        focusRequest={focusTabRequest}
      />
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
          diagonalRule={diagonalRule}
          onDiagonalRuleChange={onDiagonalRuleChange}
          fogEnabled={fogEnabled}
          hasCompiledScene={hasCompiledScene}
          liveSceneDocumentId={liveSceneDocumentId}
          tableMapDocumentId={liveMapDocumentId}
          onUseMapAtTable={onUseMapAtTable}
          atlasNodes={atlasNodes}
          onFogEnabledChange={onFogEnabledChange}
          defaultVisionRadius={defaultVisionRadius}
          onDefaultVisionRadiusChange={onDefaultVisionRadiusChange}
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
        />
      )}
      {activeTab === "atlas" && (
        <AtlasTab
          atlasNodes={atlasNodes}
          atlasLinks={atlasLinks}
          currentAtlasNodeId={currentAtlasNodeId}
          onAtlasMessage={onAtlasMessage}
          mapStudio={mapStudio}
          linkAimActive={linkAimActive}
          onArmLinkAim={onArmLinkAim}
          onOpenKick={onOpenKick}
          liveSceneDocumentId={liveSceneDocumentId}
          hasCompiledScene={hasCompiledScene}
          hasBackground={Boolean(mapBackground)}
        />
      )}
      {activeTab === "encounter" && (
        <EncounterTab controls={encounter} isDM={isDM} onOpenTab={setActiveTab} toast={toast} />
      )}
      {activeTab === "npcs" && (
        <NPCsTab
          npcs={npcs}
          onCreateNPC={onCreateNPC}
          customTokens={customTokens}
          onAddCustomToken={onAddCustomToken}
          onRemoveCustomToken={onRemoveCustomToken}
          onDuplicateNPC={onDuplicateNPC}
          onUpdateNPC={onUpdateNPC}
          onSetNPCSpeed={onSetNPCSpeed}
          onResetNPCBudget={onResetNPCBudget}
          combatActive={combatActive}
          onPlaceNPCToken={onPlaceNPCToken}
          onSetNPCStatusEffects={onSetNPCStatusEffects}
          onFocusNPCToken={onFocusNPCToken}
          mapTokenIds={mapTokenIds}
          onDeleteNPC={onDeleteNPC}
          isCreatingNpc={isCreatingNpc}
          npcCreationError={npcCreationError}
          isUpdatingNpc={isUpdatingNpc}
          npcUpdateError={npcUpdateError}
          updatingNpcId={updatingNpcId}
          isPlacingToken={isPlacingToken}
          tokenPlacementError={tokenPlacementError}
          placingTokenForNpcId={placingTokenForNpcId}
          onOpenEncounter={() => setActiveTab("encounter")}
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
          lockedPropIds={lockedPropIds}
        />
      )}
      {activeTab === "table" && (
        <TableTab controls={table} sessionName={sessionName} setSessionName={setSessionName} />
      )}
    </div>
  );

  if (presentation === "content") {
    return content;
  }

  return (
    <>
      {/* In the Party bar's dock (U7, IA-15), never over the Party cards. */}
      <DockedLauncher dock={launcherDock ?? null} order={LAUNCHER_ORDER.dm}>
        <JRPGButton
          onClick={(event) => activatePanelLauncher(event, toggleOpen)}
          variant={open ? "primary" : "default"}
        >
          🛠️ DM MENU
        </JRPGButton>
      </DockedLauncher>

      {open && (
        <DraggableWindow
          title="Dungeon Master Tools"
          onClose={() => setOpen(false)}
          interaction={{ behavior: "close", panel: "dm" }}
          initialX={typeof window !== "undefined" ? window.innerWidth - 420 : 100}
          initialY={100}
          width={400}
          minWidth={360}
          maxWidth={500}
          storageKey="dm-menu"
          zIndex={1002}
        >
          {content}
        </DraggableWindow>
      )}
    </>
  );
}
