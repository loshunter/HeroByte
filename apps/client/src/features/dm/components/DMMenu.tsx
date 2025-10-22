// ============================================================================
// DM MENU COMPONENT
// ============================================================================
// Floating tools panel for Dungeon Masters. Provides access to map setup,
// NPC management (scaffolding), and session utilities.

import { useEffect, useMemo, useState } from "react";
import type { Character, PlayerStagingZone, Prop, Player, TokenSize } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import type { Camera } from "../../../hooks/useCamera";
import MapTab from "./tab-views/MapTab";
import NPCsTab from "./tab-views/NPCsTab";
import PropsTab from "./tab-views/PropsTab";
import SessionTab from "./tab-views/SessionTab";

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
  onUpdateNPC: (
    id: string,
    updates: { name: string; hp: number; maxHp: number; portrait?: string; tokenImage?: string },
  ) => void;
  onDeleteNPC: (id: string) => void;
  onPlaceNPCToken: (id: string) => void;
  props: Prop[];
  players: Player[];
  onCreateProp: () => void;
  onUpdateProp: (
    id: string,
    updates: { label: string; imageUrl: string; owner: string | null; size: TokenSize },
  ) => void;
  onDeleteProp: (id: string) => void;
  mapLocked?: boolean;
  onMapLockToggle?: () => void;
  mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  onMapTransformChange?: (transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  }) => void;
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
}

type DMMenuTab = "map" | "npcs" | "props" | "session";

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
  props,
  players,
  onCreateProp,
  onUpdateProp,
  onDeleteProp,
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
}: DMMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
  const [sessionName, setSessionName] = useState("session");
  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

  useEffect(() => {
    if (!isDM) {
      setOpen(false);
    }
  }, [isDM]);

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
          onClick={() => setOpen((prev) => !prev)}
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
              <TabButton tab="session" label="Session" />
            </div>

            {activeTab === "map" && (
              <MapTab
                mapBackground={mapBackground}
                onSetMapBackground={onSetMapBackground}
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
              />
            )}

            {activeTab === "props" && (
              <PropsTab
                props={props}
                players={players}
                onCreateProp={onCreateProp}
                onUpdateProp={onUpdateProp}
                onDeleteProp={onDeleteProp}
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
