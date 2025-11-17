import type { Character, PlayerStagingZone, Prop, Player, SceneObject } from "@shared";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import type { Camera } from "../../../hooks/useCamera";
import MapTab from "./tab-views/MapTab";
import NPCsTab from "./tab-views/NPCsTab";
import PropsTab from "./tab-views/PropsTab";
import PlayersTab from "./tab-views/PlayersTab";
import SessionTab from "./tab-views/SessionTab";
import { useDMMenuState, type DMMenuTab } from "../hooks/useDMMenuState";

interface DMMenuProps {
  isDM: boolean;
  onToggleDM: (next: boolean) => void;
  gridSize: number;
  gridSquareSize?: number; // Feet per square
  gridLocked: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;
  onClearDrawings: () => void;
  onSetMapBackground: (url: string) => void;
  mapBackground?: string;
  onMapBackgroundSuccess?: (message: string) => void;
  onMapBackgroundError?: (message: string) => void;
  playerStagingZone?: PlayerStagingZone;
  onSetPlayerStagingZone?: (zone: PlayerStagingZone | undefined) => void;
  stagingZoneLocked?: boolean;
  onStagingZoneLockToggle?: () => void;
  camera: Camera;
  playerCount: number;
  characters: Character[];
  onRequestSaveSession?: (sessionName: string) => void;
  onRequestLoadSession?: (file: File) => void;
  onCreateNPC: () => void;
  onUpdateNPC: (id: string, updates: Partial<Character>) => void;
  onDeleteNPC: (id: string) => void;
  onPlaceNPCToken: (id: string) => void;
  isCreatingNpc?: boolean;
  npcCreationError?: string | null;
  isUpdatingNpc?: boolean;
  npcUpdateError?: string | null;
  updatingNpcId?: string | null;
  isPlacingToken?: boolean;
  tokenPlacementError?: string | null;
  placingTokenForNpcId?: string | null;
  props: Prop[];
  players: Player[];
  onCreateProp: () => void;
  onUpdateProp: (id: string, updates: Pick<Prop, "label" | "imageUrl" | "owner" | "size">) => void;
  onDeleteProp: (id: string) => void;
  isCreatingProp?: boolean;
  propCreationError?: string | null;
  isDeletingProp?: boolean;
  deletingPropId?: string | null;
  propDeletionError?: string | null;
  isUpdatingProp?: boolean;
  propUpdateError?: string | null;
  updatingPropId?: string | null;
  mapLocked?: boolean;
  onMapLockToggle?: () => void;
  mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  onMapTransformChange?: (
    transform: Partial<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  ) => void;
  alignmentModeActive: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError?: string | null;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;
  onSetRoomPassword?: (secret: string) => void;
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
  roomPasswordPending?: boolean;
  onDismissRoomPasswordStatus?: () => void;
  sceneObjects: SceneObject[];
  onSelectPlayerTokens: (playerUid: string) => void;
  combatActive?: boolean;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  onClearAllInitiative?: () => void;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
  onSetInitiative?: (characterId: string, initiative: number, modifier: number) => void;
}

export function DMMenu({
  isDM,
  onToggleDM,
  gridSize,
  gridSquareSize = 5,
  gridLocked,
  onGridLockToggle,
  onGridSizeChange,
  onGridSquareSizeChange,
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
}: DMMenuProps) {
  const { open, setOpen, toggleOpen, activeTab, setActiveTab, sessionName, setSessionName, npcs } =
    useDMMenuState({
      isDM,
      characters,
    });

  if (!isDM) {
    return null;
  }

  const saveDisabled = !onRequestSaveSession;
  const loadDisabled = !onRequestLoadSession;

  const TabButton = ({ tab, label }: { tab: DMMenuTab; label: string }) => (
    <JRPGButton
      onClick={() => setActiveTab(tab)}
      variant={activeTab === tab ? "primary" : "default"}
      style={{ fontSize: "10px", padding: "4px 12px" }}
    >
      {label}
    </JRPGButton>
  );

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

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              <TabButton tab="map" label="Map Setup" />
              <TabButton tab="npcs" label="NPCs & Monsters" />
              <TabButton tab="props" label="Props & Objects" />
              <TabButton tab="players" label="Players" />
              <TabButton tab="session" label="Session" />
            </div>
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
                saveDisabled={saveDisabled}
                loadDisabled={loadDisabled}
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
