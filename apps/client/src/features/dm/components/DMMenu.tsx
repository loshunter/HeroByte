// ============================================================================
// DM MENU COMPONENT
// ============================================================================
// Floating tools panel for Dungeon Masters. Provides access to map setup,
// NPC management (scaffolding), and session utilities.

import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { Character } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";

interface DMMenuProps {
  isDM: boolean;
  onToggleDM: (next: boolean) => void;
  gridSize: number;
  gridLocked: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onClearDrawings: () => void;
  onSetMapBackground: (url: string) => void;
  mapBackground?: string;
  playerCount: number;
  characters: Character[];
  onRequestSaveSession?: (sessionName: string) => void;
  onRequestLoadSession?: (file: File) => void;
}

type DMMenuTab = "map" | "npcs" | "session";

export function DMMenu({
  isDM,
  onToggleDM,
  gridSize,
  gridLocked,
  onGridLockToggle,
  onGridSizeChange,
  onClearDrawings,
  onSetMapBackground,
  mapBackground,
  playerCount,
  characters,
  onRequestSaveSession,
  onRequestLoadSession,
}: DMMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
  const [mapUrl, setMapUrl] = useState(mapBackground ?? "");
  const [sessionName, setSessionName] = useState("session");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMapUrl(mapBackground ?? "");
  }, [mapBackground]);

  useEffect(() => {
    if (!isDM) {
      setOpen(false);
    }
  }, [isDM]);

  const handleMapApply = () => {
    if (!mapUrl.trim()) return;
    onSetMapBackground(mapUrl.trim());
  };

  const handleClearDrawings = () => {
    if (window.confirm("Clear all drawings from the map?")) {
      onClearDrawings();
    }
  };

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
        <div
          style={{
            position: "fixed",
            bottom: "96px",
            right: "32px",
            width: "360px",
            maxHeight: "70vh",
            overflowY: "auto",
            zIndex: 200,
          }}
        >
          <JRPGPanel variant="bevel" title="Dungeon Master Tools">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <label
                className="jrpg-text-small"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={isDM}
                  onChange={(event) => onToggleDM(event.target.checked)}
                  style={{ transform: "scale(1.2)" }}
                />
                DM Mode
              </label>

              <JRPGButton
                onClick={() => onToggleDM(false)}
                variant="danger"
                style={{ fontSize: "10px", padding: "4px 10px" }}
              >
                Exit DM
              </JRPGButton>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              <TabButton tab="map" label="Map Setup" />
              <TabButton tab="npcs" label="NPCs & Monsters" />
              <TabButton tab="session" label="Session" />
            </div>

            {activeTab === "map" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <JRPGPanel variant="simple" title="Map Background">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="text"
                      value={mapUrl}
                      placeholder="Paste image URL"
                      onChange={(event) => setMapUrl(event.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#111",
                        color: "var(--jrpg-white)",
                        border: "1px solid var(--jrpg-border-gold)",
                      }}
                    />
                    <JRPGButton
                      onClick={handleMapApply}
                      variant="success"
                      disabled={!mapUrl.trim()}
                      style={{ fontSize: "10px" }}
                    >
                      Apply Background
                    </JRPGButton>
                    {mapBackground && (
                      <img
                        src={mapBackground}
                        alt="Current map background"
                        style={{
                          width: "100%",
                          maxHeight: "120px",
                          objectFit: "cover",
                          borderRadius: "4px",
                        }}
                      />
                    )}
                  </div>
                </JRPGPanel>

                <JRPGPanel variant="simple" title="Grid Controls">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span className="jrpg-text-small">Grid Size</span>
                      <span className="jrpg-text-small">{gridSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={500}
                      step={5}
                      value={gridSize}
                      onChange={(event) => onGridSizeChange(Number(event.target.value))}
                      disabled={gridLocked}
                      style={{ width: "100%" }}
                    />
                    <JRPGButton
                      onClick={onGridLockToggle}
                      variant={gridLocked ? "danger" : "primary"}
                      style={{ fontSize: "10px" }}
                    >
                      {gridLocked ? "Grid Locked" : "Lock Grid"}
                    </JRPGButton>
                  </div>
                </JRPGPanel>

                <JRPGButton
                  onClick={handleClearDrawings}
                  variant="danger"
                  style={{ fontSize: "10px" }}
                >
                  Clear All Drawings
                </JRPGButton>
              </div>
            )}

            {activeTab === "npcs" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  color: "var(--jrpg-white)",
                  fontSize: "12px",
                }}
              >
                <JRPGPanel variant="simple" title="Roster Preview">
                  {characters.length === 0 ? (
                    <p style={{ margin: 0 }}>No NPCs or monsters yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {characters.map((character) => (
                        <div
                          key={character.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                            paddingBottom: "4px",
                          }}
                        >
                          <strong style={{ color: "var(--jrpg-gold)" }}>{character.name}</strong>
                          <span>
                            HP: {character.hp}/{character.maxHp}
                          </span>
                          {character.portrait && (
                            <img
                              src={character.portrait}
                              alt={`${character.name} portrait`}
                              style={{
                                width: "100%",
                                maxHeight: "80px",
                                objectFit: "cover",
                                borderRadius: "4px",
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </JRPGPanel>

                <JRPGButton disabled style={{ fontSize: "10px" }}>
                  NPC tools coming in next iteration
                </JRPGButton>
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
                        disabled={!onRequestSaveSession}
                        style={{ fontSize: "10px", flex: 1 }}
                      >
                        Save Game State
                      </JRPGButton>
                      <JRPGButton
                        onClick={() => fileInputRef.current?.click()}
                        variant="primary"
                        disabled={!onRequestLoadSession}
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

                <JRPGPanel variant="simple" title="Players">
                  <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                    {playerCount} player{playerCount === 1 ? "" : "s"} currently online
                  </div>
                </JRPGPanel>
              </div>
            )}
          </JRPGPanel>
        </div>
      )}
    </>
  );
}
