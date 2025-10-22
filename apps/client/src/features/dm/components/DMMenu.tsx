// ============================================================================
// DM MENU COMPONENT
// ============================================================================
// Floating tools panel for Dungeon Masters. Provides access to map setup,
// NPC management (scaffolding), and session utilities.

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Character, PlayerStagingZone, Prop, Player, TokenSize } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import type { Camera } from "../../../hooks/useCamera";
import { CollapsibleSection } from "../../../components/ui/CollapsibleSection";
import { NPCEditor } from "./NPCEditor";
import { PropEditor } from "./PropEditor";
import { MapBackgroundControl } from "./map-controls/MapBackgroundControl";
import { DrawingControls } from "./map-controls/DrawingControls";
import { GridControl } from "./map-controls/GridControl";
import { MapTransformControl } from "./map-controls/MapTransformControl";
import { StagingZoneControl } from "./map-controls/StagingZoneControl";

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
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

  useEffect(() => {
    if (roomPasswordStatus?.type === "success") {
      setPasswordInput("");
      setPasswordConfirmInput("");
    }
  }, [roomPasswordStatus]);

  useEffect(() => {
    if (!isDM) {
      setOpen(false);
    }
  }, [isDM]);

  const handleSaveSession = () => {
    if (!onRequestSaveSession) return;
    const trimmed = sessionName.trim();
    onRequestSaveSession(trimmed.length > 0 ? trimmed : "session");
  };

  const handleLoadSession = (event: ChangeEvent<HTMLInputElement>) => {
    if (!onRequestLoadSession) return;
    const file = event.target.files?.[0];
    if (file) {
      onRequestLoadSession(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset so same file can be chosen again
    }
  };

  if (!isDM) {
    return null;
  }

  const handlePasswordSubmit = () => {
    if (!onSetRoomPassword) return;

    const trimmed = passwordInput.trim();
    const confirm = passwordConfirmInput.trim();

    if (trimmed.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (trimmed !== confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError(null);
    onDismissRoomPasswordStatus?.();
    onSetRoomPassword(trimmed);
  };

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
                <CollapsibleSection isCollapsed={gridLocked}>
                  <JRPGPanel variant="simple" title="Grid Alignment Wizard">
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span className="jrpg-text-small" style={{ lineHeight: 1.4 }}>
                        {alignmentModeActive
                          ? "Alignment mode active — zoom in and click two opposite corners of a single map square."
                          : "Capture two opposite corners of a map square to auto-match the map to the table grid."}
                      </span>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <JRPGButton
                          variant={alignmentModeActive ? "primary" : "default"}
                          onClick={onAlignmentStart}
                          style={{ fontSize: "10px" }}
                          disabled={alignmentModeActive}
                        >
                          Start Alignment
                        </JRPGButton>
                        <JRPGButton
                          variant="default"
                          onClick={onAlignmentReset}
                          style={{ fontSize: "10px" }}
                          disabled={alignmentPoints.length === 0}
                        >
                          Reset Points
                        </JRPGButton>
                        {alignmentModeActive && (
                          <JRPGButton
                            variant="danger"
                            onClick={onAlignmentCancel}
                            style={{ fontSize: "10px" }}
                          >
                            Cancel
                          </JRPGButton>
                        )}
                      </div>

                      <span className="jrpg-text-small" style={{ opacity: 0.8 }}>
                        Captured Points: {Math.min(alignmentPoints.length, 2)} / 2
                      </span>

                      {alignmentSuggestion && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "6px",
                            fontSize: "10px",
                            background: "rgba(0, 0, 0, 0.2)",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          <span>Scale</span>
                          <span>{alignmentSuggestion.scale.toFixed(4)}×</span>
                          <span>Rotation</span>
                          <span>{alignmentSuggestion.rotation.toFixed(2)}°</span>
                          <span>Offset X</span>
                          <span>{alignmentSuggestion.transform.x.toFixed(1)}</span>
                          <span>Offset Y</span>
                          <span>{alignmentSuggestion.transform.y.toFixed(1)}</span>
                          <span>Residual</span>
                          <span>{alignmentSuggestion.error.toFixed(2)} px</span>
                        </div>
                      )}

                      {alignmentError && (
                        <span style={{ color: "#f87171", fontSize: "10px" }}>{alignmentError}</span>
                      )}

                      <JRPGButton
                        variant="success"
                        onClick={onAlignmentApply}
                        style={{ fontSize: "10px" }}
                        disabled={!alignmentSuggestion || !!alignmentError || mapLocked}
                      >
                        Apply Alignment
                      </JRPGButton>
                      {mapLocked && (
                        <span style={{ color: "#facc15", fontSize: "10px" }}>
                          Unlock the map before applying alignment.
                        </span>
                      )}
                    </div>
                  </JRPGPanel>
                </CollapsibleSection>

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
                <JRPGPanel variant="simple" title="Session Save/Load">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label
                      className="jrpg-text-small"
                      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                    >
                      Session Name
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(event) => setSessionName(event.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px",
                          background: "#111",
                          color: "var(--jrpg-white)",
                          border: "1px solid var(--jrpg-border-gold)",
                        }}
                      />
                    </label>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <JRPGButton
                        onClick={handleSaveSession}
                        variant="success"
                        disabled={saveDisabled}
                        title={
                          saveDisabled
                            ? "Save is unavailable until the room state is ready."
                            : undefined
                        }
                        style={{ fontSize: "10px", flex: 1 }}
                      >
                        Save Game State
                      </JRPGButton>
                      <JRPGButton
                        onClick={() => fileInputRef.current?.click()}
                        variant="primary"
                        disabled={loadDisabled}
                        title={loadDisabled ? "Loading is unavailable at the moment." : undefined}
                        style={{ fontSize: "10px", flex: 1 }}
                      >
                        Load Game State
                      </JRPGButton>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        style={{ display: "none" }}
                        onChange={handleLoadSession}
                      />
                    </div>
                  </div>
                </JRPGPanel>

                <JRPGPanel variant="simple" title="Room Security">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p
                      className="jrpg-text-small"
                      style={{ margin: 0, color: "var(--jrpg-white)" }}
                    >
                      Update the shared room password. Current players remain connected; new
                      entrants must use the new secret.
                    </p>
                    <input
                      type="password"
                      value={passwordInput}
                      placeholder="New password"
                      onChange={(event) => {
                        setPasswordInput(event.target.value);
                        setPasswordError(null);
                        onDismissRoomPasswordStatus?.();
                      }}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#111",
                        color: "var(--jrpg-white)",
                        border: "1px solid var(--jrpg-border-gold)",
                      }}
                    />
                    <input
                      type="password"
                      value={passwordConfirmInput}
                      placeholder="Confirm password"
                      onChange={(event) => {
                        setPasswordConfirmInput(event.target.value);
                        setPasswordError(null);
                        onDismissRoomPasswordStatus?.();
                      }}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#111",
                        color: "var(--jrpg-white)",
                        border: "1px solid var(--jrpg-border-gold)",
                      }}
                    />
                    {passwordError ? (
                      <p style={{ color: "#f87171", margin: 0, fontSize: "0.85rem" }}>
                        {passwordError}
                      </p>
                    ) : null}
                    {roomPasswordStatus ? (
                      <p
                        style={{
                          color: roomPasswordStatus.type === "success" ? "#4ade80" : "#f87171",
                          margin: 0,
                          fontSize: "0.85rem",
                        }}
                      >
                        {roomPasswordStatus.message}
                      </p>
                    ) : null}
                    <JRPGButton
                      onClick={handlePasswordSubmit}
                      variant="primary"
                      disabled={roomPasswordPending || !onSetRoomPassword}
                      style={{ fontSize: "10px" }}
                    >
                      {roomPasswordPending ? "Updating…" : "Update Password"}
                    </JRPGButton>
                  </div>
                </JRPGPanel>

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
