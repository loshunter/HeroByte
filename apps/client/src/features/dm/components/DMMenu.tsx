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
import { NPCEditor } from "./NPCEditor";
import { PropEditor } from "./PropEditor";
import { MapBackgroundControl } from "./map-controls/MapBackgroundControl";
import { DrawingControls } from "./map-controls/DrawingControls";
import { GridControl } from "./map-controls/GridControl";
import { MapTransformControl } from "./map-controls/MapTransformControl";
import { StagingZoneControl } from "./map-controls/StagingZoneControl";
import { GridAlignmentWizard } from "./map-controls/GridAlignmentWizard";
import { SessionPersistenceControl } from "./session-controls/SessionPersistenceControl";
import { RoomPasswordControl } from "./session-controls/RoomPasswordControl";

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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <MapBackgroundControl
                  mapBackground={mapBackground}
                  onSetMapBackground={onSetMapBackground}
                />

                {/* Step 2: Adjust Map Transform (scale, position, rotation) */}
                {onMapLockToggle && onMapTransformChange && mapTransform && (
                  <MapTransformControl
                    mapTransform={mapTransform}
                    mapLocked={mapLocked ?? false}
                    onMapTransformChange={onMapTransformChange}
                    onMapLockToggle={onMapLockToggle}
                  />
                )}

                <GridControl
                  gridSize={gridSize}
                  gridSquareSize={gridSquareSize}
                  gridLocked={gridLocked}
                  onGridSizeChange={onGridSizeChange}
                  onGridSquareSizeChange={onGridSquareSizeChange}
                  onGridLockToggle={onGridLockToggle}
                />

                {/* Step 4: Align Grid to Map (optional) */}
                <GridAlignmentWizard
                  alignmentModeActive={alignmentModeActive}
                  alignmentPoints={alignmentPoints}
                  alignmentSuggestion={alignmentSuggestion}
                  alignmentError={alignmentError}
                  gridLocked={gridLocked}
                  mapLocked={mapLocked}
                  onAlignmentStart={onAlignmentStart}
                  onAlignmentReset={onAlignmentReset}
                  onAlignmentCancel={onAlignmentCancel}
                  onAlignmentApply={onAlignmentApply}
                />

                {/* Step 5: Define Player Spawn Area */}
                <StagingZoneControl
                  playerStagingZone={playerStagingZone}
                  camera={camera}
                  gridSize={gridSize}
                  stagingZoneLocked={stagingZoneLocked ?? false}
                  onStagingZoneLockToggle={onStagingZoneLockToggle}
                  onSetPlayerStagingZone={onSetPlayerStagingZone}
                />

                {/* Step 6: Session Cleanup */}
                <DrawingControls onClearDrawings={onClearDrawings} />
              </div>
            )}

            {activeTab === "npcs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h4 className="jrpg-text-command" style={{ margin: 0 }}>
                    NPCs & Monsters
                  </h4>
                  <JRPGButton
                    variant="success"
                    onClick={onCreateNPC}
                    style={{ fontSize: "10px", padding: "6px 12px" }}
                  >
                    + Add NPC
                  </JRPGButton>
                </div>

                {npcs.length === 0 ? (
                  <JRPGPanel
                    variant="simple"
                    style={{ color: "var(--jrpg-white)", fontSize: "12px" }}
                  >
                    No NPCs yet. Use &ldquo;Add NPC&rdquo; to create one.
                  </JRPGPanel>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {npcs.map((npc) => (
                      <NPCEditor
                        key={npc.id}
                        npc={npc}
                        onUpdate={(updates) => onUpdateNPC(npc.id, updates)}
                        onPlace={() => onPlaceNPCToken(npc.id)}
                        onDelete={() => onDeleteNPC(npc.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "props" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h4 className="jrpg-text-command" style={{ margin: 0 }}>
                    Props & Objects
                  </h4>
                  <JRPGButton
                    variant="success"
                    onClick={onCreateProp}
                    style={{ fontSize: "10px", padding: "6px 12px" }}
                  >
                    + Add Prop
                  </JRPGButton>
                </div>

                {props.length === 0 ? (
                  <JRPGPanel
                    variant="simple"
                    style={{ color: "var(--jrpg-white)", fontSize: "12px" }}
                  >
                    No props yet. Use &ldquo;Add Prop&rdquo; to create one.
                  </JRPGPanel>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {props.map((prop) => (
                      <PropEditor
                        key={prop.id}
                        prop={prop}
                        players={players}
                        onUpdate={(updates) => onUpdateProp(prop.id, updates)}
                        onDelete={() => onDeleteProp(prop.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "session" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <SessionPersistenceControl
                  sessionName={sessionName}
                  setSessionName={setSessionName}
                  onRequestSaveSession={onRequestSaveSession}
                  onRequestLoadSession={onRequestLoadSession}
                  saveDisabled={saveDisabled}
                  loadDisabled={loadDisabled}
                />

                <RoomPasswordControl
                  onSetRoomPassword={onSetRoomPassword}
                  roomPasswordStatus={roomPasswordStatus}
                  roomPasswordPending={roomPasswordPending}
                  onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
                />

                <JRPGPanel variant="simple" title="Players">
                  <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                    {playerCount} player{playerCount === 1 ? "" : "s"} currently online
                  </div>
                </JRPGPanel>
              </div>
            )}
          </div>
        </DraggableWindow>
      )}
    </>
  );
}
