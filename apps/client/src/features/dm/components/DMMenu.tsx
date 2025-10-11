// ============================================================================
// DM MENU COMPONENT
// ============================================================================
// Floating tools panel for Dungeon Masters. Provides access to map setup,
// NPC management (scaffolding), and session utilities.

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Character } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";

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
}

type DMMenuTab = "map" | "npcs" | "session";

interface NPCEditorProps {
  npc: Character;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    portrait?: string;
    tokenImage?: string;
  }) => void;
  onPlace: () => void;
  onDelete: () => void;
}

const NPCEditor = ({ npc, onUpdate, onPlace, onDelete }: NPCEditorProps) => {
  const [name, setName] = useState(npc.name);
  const [hpInput, setHpInput] = useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = useState(String(npc.maxHp));
  const [portrait, setPortrait] = useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = useState(npc.tokenImage ?? "");

  useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
    setPortrait(npc.portrait ?? "");
    setTokenImage(npc.tokenImage ?? "");
  }, [npc]);

  const commitUpdate = (
    overrides?: Partial<{
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
    }>,
  ) => {
    const baseHp = overrides?.hp ?? Number(hpInput);
    const baseMaxHp = overrides?.maxHp ?? Number(maxHpInput);
    const parsedHp = Math.max(0, Number.isFinite(baseHp) ? Number(baseHp) : 0);
    const parsedMax = Math.max(1, Number.isFinite(baseMaxHp) ? Number(baseMaxHp) : 1);
    const clampedHp = Math.min(parsedMax, parsedHp);

    setHpInput(String(clampedHp));
    setMaxHpInput(String(parsedMax));

    const nextNameSource = overrides?.name ?? name;
    const trimmedName = nextNameSource.trim();
    const nextPortraitSource = overrides?.portrait ?? portrait;
    const portraitValue = nextPortraitSource.trim();
    const nextTokenImageSource = overrides?.tokenImage ?? tokenImage;
    const tokenImageValue = nextTokenImageSource.trim();

    onUpdate({
      name: trimmedName.length > 0 ? trimmedName : "NPC",
      hp: clampedHp,
      maxHp: parsedMax,
      portrait: portraitValue.length > 0 ? portraitValue : undefined,
      tokenImage: tokenImageValue.length > 0 ? tokenImageValue : undefined,
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
  const handlePortraitBlur = () => commitUpdate({ portrait });
  const handleTokenImageBlur = () => commitUpdate({ tokenImage });

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameBlur();
            }}
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <label className="jrpg-text-small" style={{ flex: 1 }}>
          HP
          <input
            type="number"
            min={0}
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={handleHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleHpBlur();
            }}
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
            }}
          />
        </label>
        <label className="jrpg-text-small" style={{ flex: 1 }}>
          Max HP
          <input
            type="number"
            min={1}
            value={maxHpInput}
            onChange={(e) => setMaxHpInput(e.target.value)}
            onBlur={handleMaxHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMaxHpBlur();
            }}
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
            }}
          />
        </label>
      </div>

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Portrait URL
        <input
          type="text"
          value={portrait}
          onChange={(e) => setPortrait(e.target.value)}
          onBlur={handlePortraitBlur}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
      </label>
      {portrait && (
        <img
          src={portrait}
          alt={`${npc.name} portrait`}
          style={{
            width: "100%",
            maxHeight: "100px",
            objectFit: "cover",
            borderRadius: "4px",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Token Image URL
        <input
          type="text"
          value={tokenImage}
          onChange={(e) => setTokenImage(e.target.value)}
          onBlur={handleTokenImageBlur}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
      </label>
      {tokenImage && (
        <img
          src={tokenImage}
          alt={`${npc.name} token preview`}
          style={{
            width: "48px",
            height: "48px",
            objectFit: "cover",
            borderRadius: "4px",
            border: "1px solid var(--jrpg-border-gold)",
            alignSelf: "flex-start",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <JRPGButton
          variant="primary"
          onClick={() => {
            commitUpdate();
            onPlace();
          }}
          style={{ fontSize: "10px", flex: 1 }}
        >
          Place on Map
        </JRPGButton>
        <JRPGButton variant="danger" onClick={onDelete} style={{ fontSize: "10px", flex: 1 }}>
          Delete
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
};

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
  playerCount,
  characters,
  onRequestSaveSession,
  onRequestLoadSession,
  onCreateNPC,
  onUpdateNPC,
  onDeleteNPC,
  onPlaceNPCToken,
  mapLocked,
  onMapLockToggle,
  mapTransform,
  onMapTransformChange,
}: DMMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
  const [mapUrl, setMapUrl] = useState(mapBackground ?? "");
  const [sessionName, setSessionName] = useState("session");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

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

  const saveDisabled = !onRequestSaveSession;
  const loadDisabled = !onRequestLoadSession;

  const formatSquareSize = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);

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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "8px",
                      }}
                    >
                      <span className="jrpg-text-small">Square Size</span>
                      <span className="jrpg-text-small">
                        {formatSquareSize(gridSquareSize)} ft
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={Math.min(100, Math.max(1, gridSquareSize))}
                      onChange={(event) =>
                        onGridSquareSizeChange?.(Number(event.target.value))
                      }
                      disabled={!onGridSquareSizeChange}
                      style={{ width: "100%" }}
                    />
                    <span style={{ fontSize: "10px", opacity: 0.8, lineHeight: 1.3, display: "block" }}>
                      Measurement tool displays distances as squares and feet using this value.
                    </span>
                  </div>
                </JRPGPanel>

                {onMapLockToggle && onMapTransformChange && mapTransform && (
                  <JRPGPanel variant="simple" title="Map Transform">
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <JRPGButton
                        onClick={onMapLockToggle}
                        variant={mapLocked ? "primary" : "default"}
                        style={{ fontSize: "10px" }}
                        title={mapLocked ? "Map is locked" : "Map is unlocked"}
                      >
                        {mapLocked ? "🔒 Map Locked" : "🔓 Map Unlocked"}
                      </JRPGButton>

                      <div style={{ opacity: mapLocked ? 0.5 : 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span className="jrpg-text-small">Scale</span>
                          <span className="jrpg-text-small">{mapTransform.scaleX.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={3}
                          step={0.1}
                          value={mapTransform.scaleX}
                          onChange={(event) =>
                            onMapTransformChange({
                              ...mapTransform,
                              scaleX: Number(event.target.value),
                              scaleY: Number(event.target.value),
                            })
                          }
                          disabled={mapLocked}
                          style={{ width: "100%" }}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <span className="jrpg-text-small">Rotation</span>
                          <span className="jrpg-text-small">
                            {Math.round(mapTransform.rotation)}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={5}
                          value={mapTransform.rotation}
                          onChange={(event) =>
                            onMapTransformChange({
                              ...mapTransform,
                              rotation: Number(event.target.value),
                            })
                          }
                          disabled={mapLocked}
                          style={{ width: "100%" }}
                        />

                        <div style={{ marginTop: "8px", display: "flex", gap: "4px" }}>
                          <div style={{ flex: 1 }}>
                            <label className="jrpg-text-small" style={{ display: "block" }}>
                              X
                            </label>
                            <input
                              type="number"
                              value={Math.round(mapTransform.x)}
                              onChange={(event) =>
                                onMapTransformChange({
                                  ...mapTransform,
                                  x: Number(event.target.value),
                                })
                              }
                              disabled={mapLocked}
                              style={{
                                width: "100%",
                                padding: "4px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                                fontSize: "10px",
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="jrpg-text-small" style={{ display: "block" }}>
                              Y
                            </label>
                            <input
                              type="number"
                              value={Math.round(mapTransform.y)}
                              onChange={(event) =>
                                onMapTransformChange({
                                  ...mapTransform,
                                  y: Number(event.target.value),
                                })
                              }
                              disabled={mapLocked}
                              style={{
                                width: "100%",
                                padding: "4px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                                fontSize: "10px",
                              }}
                            />
                          </div>
                        </div>

                        <JRPGButton
                          onClick={() =>
                            onMapTransformChange({
                              x: 0,
                              y: 0,
                              scaleX: 1,
                              scaleY: 1,
                              rotation: 0,
                            })
                          }
                          variant="default"
                          disabled={mapLocked}
                          style={{ fontSize: "10px", marginTop: "8px" }}
                        >
                          Reset Transform
                        </JRPGButton>
                      </div>
                    </div>
                  </JRPGPanel>
                )}

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
