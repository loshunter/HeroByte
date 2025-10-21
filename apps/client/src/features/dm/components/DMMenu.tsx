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
import { ImagePreview } from "../../../components/ui/ImagePreview";
import { FormInput } from "../../../components/ui/FormInput";
import { EmptyState } from "../../../components/ui/EmptyState";

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

// ============================================================================
// PROP EDITOR
// ============================================================================

interface PropEditorProps {
  prop: Prop;
  players: Player[];
  onUpdate: (updates: {
    label: string;
    imageUrl: string;
    owner: string | null;
    size: TokenSize;
  }) => void;
  onDelete: () => void;
}

const PropEditor = ({ prop, players, onUpdate, onDelete }: PropEditorProps) => {
  const [label, setLabel] = useState(prop.label);
  const [imageUrl, setImageUrl] = useState(prop.imageUrl);
  const [owner, setOwner] = useState<string | null>(prop.owner);
  const [size, setSize] = useState<TokenSize>(prop.size);

  useEffect(() => {
    setLabel(prop.label);
    setImageUrl(prop.imageUrl);
    setOwner(prop.owner);
    setSize(prop.size);
  }, [prop]);

  const commitUpdate = (
    overrides?: Partial<{
      label: string;
      imageUrl: string;
      owner: string | null;
      size: TokenSize;
    }>,
  ) => {
    const nextLabel = (overrides?.label ?? label).trim();
    const nextImageUrl = (overrides?.imageUrl ?? imageUrl).trim();
    const nextOwner = overrides?.owner !== undefined ? overrides.owner : owner;
    const nextSize = overrides?.size ?? size;

    onUpdate({
      label: nextLabel.length > 0 ? nextLabel : "Prop",
      imageUrl: nextImageUrl,
      owner: nextOwner,
      size: nextSize,
    });
  };

  const handleLabelBlur = () => commitUpdate({ label });
  const handleImageUrlBlur = () => commitUpdate({ imageUrl });
  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newOwner = value === "null" ? null : value === "*" ? "*" : value;
    setOwner(newOwner);
    commitUpdate({ owner: newOwner });
  };
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = e.target.value as TokenSize;
    setSize(newSize);
    commitUpdate({ size: newSize });
  };

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <FormInput label="Label" value={label} onChange={(v) => setLabel(v as string)} onBlur={handleLabelBlur} />

      <FormInput
        label="Image URL"
        value={imageUrl}
        onChange={(v) => setImageUrl(v as string)}
        onBlur={handleImageUrlBlur}
      />
      <ImagePreview src={imageUrl} alt={`${prop.label} preview`} />

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Ownership
        <select
          value={owner ?? "null"}
          onChange={handleOwnerChange}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        >
          <option value="null">DM Only</option>
          <option value="*">Everyone</option>
          {players.map((player) => (
            <option key={player.uid} value={player.uid}>
              {player.name}
            </option>
          ))}
        </select>
      </label>

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Size
        <select
          value={size}
          onChange={handleSizeChange}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        >
          <option value="tiny">Tiny</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="huge">Huge</option>
          <option value="gargantuan">Gargantuan</option>
        </select>
      </label>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <JRPGButton variant="danger" onClick={onDelete} style={{ fontSize: "10px", flex: 1 }}>
          Delete
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
};

// ============================================================================
// NPC EDITOR
// ============================================================================

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
      <FormInput label="Name" value={name} onChange={(v) => setName(v as string)} onBlur={handleNameBlur} />

      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <FormInput
            label="HP"
            type="number"
            value={hpInput}
            onChange={(v) => setHpInput(v as string)}
            onBlur={handleHpBlur}
            min={0}
          />
        </div>
        <div style={{ flex: 1 }}>
          <FormInput
            label="Max HP"
            type="number"
            value={maxHpInput}
            onChange={(v) => setMaxHpInput(v as string)}
            onBlur={handleMaxHpBlur}
            min={1}
          />
        </div>
      </div>

      <FormInput
        label="Portrait URL"
        value={portrait}
        onChange={(v) => setPortrait(v as string)}
        onBlur={handlePortraitBlur}
      />
      <ImagePreview
        src={portrait}
        alt={`${npc.name} portrait`}
        width="100%"
        maxHeight="100px"
        showBorder={false}
      />

      <FormInput
        label="Token Image URL"
        value={tokenImage}
        onChange={(v) => setTokenImage(v as string)}
        onBlur={handleTokenImageBlur}
      />
      <ImagePreview src={tokenImage} alt={`${npc.name} token preview`} />

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
  const [mapUrl, setMapUrl] = useState(mapBackground ?? "");
  const [sessionName, setSessionName] = useState("session");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );
  const [stagingInputs, setStagingInputs] = useState({
    x: "0",
    y: "0",
    width: "6",
    height: "6",
    rotation: "0",
  });

  useEffect(() => {
    setMapUrl(mapBackground ?? "");
  }, [mapBackground]);

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

  useEffect(() => {
    if (playerStagingZone) {
      setStagingInputs({
        x: playerStagingZone.x.toFixed(2),
        y: playerStagingZone.y.toFixed(2),
        width: playerStagingZone.width.toFixed(2),
        height: playerStagingZone.height.toFixed(2),
        rotation: (playerStagingZone.rotation ?? 0).toFixed(1),
      });
    } else {
      setStagingInputs({
        x: "0",
        y: "0",
        width: "6",
        height: "6",
        rotation: "0",
      });
    }
  }, [playerStagingZone]);

  const handleMapApply = () => {
    if (!mapUrl.trim()) return;
    onSetMapBackground(mapUrl.trim());
  };

  const handleStagingInputChange = (field: keyof typeof stagingInputs, value: string) => {
    setStagingInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleStagingZoneApply = () => {
    if (!onSetPlayerStagingZone) return;

    // Calculate viewport center in world coordinates
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;
    const centerScreenX = viewportWidth / 2;
    const centerScreenY = viewportHeight / 2;

    // Convert screen center to world coordinates
    const centerWorldX = (centerScreenX - camera.x) / camera.scale;
    const centerWorldY = (centerScreenY - camera.y) / camera.scale;

    // Calculate staging zone size based on viewport and current zoom
    // Aim for about 40% of viewport width, minimum 1 grid unit
    const viewportWidthInWorld = viewportWidth / camera.scale;
    const viewportHeightInWorld = viewportHeight / camera.scale;

    // Size as a fraction of viewport, converted to grid units
    const sizeWidthInPixels = viewportWidthInWorld * 0.4;
    const sizeHeightInPixels = viewportHeightInWorld * 0.4;

    const calculatedWidth = Math.max(1, sizeWidthInPixels / gridSize);
    const calculatedHeight = Math.max(1, sizeHeightInPixels / gridSize);

    // Convert world pixel coordinates to grid coordinates
    const gridX = centerWorldX / gridSize;
    const gridY = centerWorldY / gridSize;

    // Update the input fields to reflect calculated values
    setStagingInputs({
      x: gridX.toFixed(2),
      y: gridY.toFixed(2),
      width: calculatedWidth.toFixed(2),
      height: calculatedHeight.toFixed(2),
      rotation: "0",
    });

    onSetPlayerStagingZone({
      x: gridX,
      y: gridY,
      width: calculatedWidth,
      height: calculatedHeight,
      rotation: 0,
    });
  };

  const handleStagingZoneClear = () => {
    if (!onSetPlayerStagingZone) return;
    onSetPlayerStagingZone(undefined);
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

  const handlePasswordChange = (value: string | number) => {
    setPasswordInput(String(value));
    setPasswordError(null);
    onDismissRoomPasswordStatus?.();
  };

  const handlePasswordConfirmChange = (value: string | number) => {
    setPasswordConfirmInput(String(value));
    setPasswordError(null);
    onDismissRoomPasswordStatus?.();
  };

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
                {/* Step 1: Load Map Background */}
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

                {/* Step 2: Adjust Map Transform (scale, position, rotation) */}
                {onMapLockToggle && onMapTransformChange && mapTransform && (
                  <JRPGPanel
                    variant="simple"
                    title="Map Transform"
                    style={{
                      padding: mapLocked ? "8px" : "12px",
                      transition: "padding 150ms ease-in-out",
                      border: mapLocked
                        ? "2px solid rgba(136, 136, 136, 0.5)"
                        : "2px solid var(--jrpg-border-gold)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <JRPGButton
                        onClick={onMapLockToggle}
                        variant={mapLocked ? "default" : "primary"}
                        style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          padding: "8px",
                          background: mapLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
                          color: mapLocked ? "#aaa" : undefined,
                        }}
                        title={mapLocked ? "Map is locked" : "Map is unlocked"}
                      >
                        {mapLocked ? "🔒 MAP LOCKED ▲" : "🔓 MAP UNLOCKED ▼"}
                      </JRPGButton>

                      <CollapsibleSection isCollapsed={mapLocked ?? false}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "4px",
                            }}
                          >
                            <span className="jrpg-text-small">Scale</span>
                            <span className="jrpg-text-small">
                              {mapTransform.scaleX.toFixed(2)}x
                            </span>
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
                            style={{ fontSize: "10px", marginTop: "8px" }}
                          >
                            Reset Transform
                          </JRPGButton>
                        </div>
                      </CollapsibleSection>
                    </div>
                  </JRPGPanel>
                )}

                {/* Step 3: Configure Grid */}
                <JRPGPanel
                  variant="simple"
                  title="Grid Controls"
                  style={{
                    padding: gridLocked ? "8px" : "12px",
                    transition: "padding 150ms ease-in-out",
                    border: gridLocked
                      ? "2px solid rgba(136, 136, 136, 0.5)"
                      : "2px solid var(--jrpg-border-gold)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <JRPGButton
                      onClick={onGridLockToggle}
                      variant={gridLocked ? "default" : "primary"}
                      style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        padding: "8px",
                        background: gridLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
                        color: gridLocked ? "#aaa" : undefined,
                      }}
                    >
                      {gridLocked ? "🔒 GRID LOCKED ▲" : "🔓 GRID UNLOCKED ▼"}
                    </JRPGButton>

                    <CollapsibleSection isCollapsed={gridLocked}>
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
                          style={{ width: "100%" }}
                        />

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
                          onChange={(event) => onGridSquareSizeChange?.(Number(event.target.value))}
                          disabled={!onGridSquareSizeChange}
                          style={{ width: "100%" }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            opacity: 0.8,
                            lineHeight: 1.3,
                            display: "block",
                          }}
                        >
                          Measurement tool displays distances as squares and feet using this value.
                        </span>
                      </div>
                    </CollapsibleSection>
                  </div>
                </JRPGPanel>

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
                <JRPGPanel
                  variant="simple"
                  title="Player Staging Zone"
                  style={{
                    padding: stagingZoneLocked ? "8px" : "12px",
                    transition: "padding 150ms ease-in-out",
                    border: stagingZoneLocked
                      ? "2px solid rgba(136, 136, 136, 0.5)"
                      : "2px solid var(--jrpg-border-gold)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {onStagingZoneLockToggle && (
                      <JRPGButton
                        onClick={onStagingZoneLockToggle}
                        variant={stagingZoneLocked ? "default" : "primary"}
                        style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          padding: "8px",
                          background: stagingZoneLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
                          color: stagingZoneLocked ? "#aaa" : undefined,
                        }}
                        title={
                          stagingZoneLocked ? "Staging zone is locked" : "Staging zone is unlocked"
                        }
                      >
                        {stagingZoneLocked ? "🔒 ZONE LOCKED ▲" : "🔓 ZONE UNLOCKED ▼"}
                      </JRPGButton>
                    )}

                    <CollapsibleSection isCollapsed={stagingZoneLocked ?? false}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "8px",
                          }}
                        >
                          <label
                            className="jrpg-text-small"
                            style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                          >
                            Center X
                            <input
                              type="number"
                              value={stagingInputs.x}
                              onChange={(event) =>
                                handleStagingInputChange("x", event.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                              }}
                              step={0.1}
                            />
                          </label>
                          <label
                            className="jrpg-text-small"
                            style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                          >
                            Center Y
                            <input
                              type="number"
                              value={stagingInputs.y}
                              onChange={(event) =>
                                handleStagingInputChange("y", event.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                              }}
                              step={0.1}
                            />
                          </label>
                          <label
                            className="jrpg-text-small"
                            style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                          >
                            Width (tiles)
                            <input
                              type="number"
                              min={0.5}
                              value={stagingInputs.width}
                              onChange={(event) =>
                                handleStagingInputChange("width", event.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                              }}
                              step={0.5}
                            />
                          </label>
                          <label
                            className="jrpg-text-small"
                            style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                          >
                            Height (tiles)
                            <input
                              type="number"
                              min={0.5}
                              value={stagingInputs.height}
                              onChange={(event) =>
                                handleStagingInputChange("height", event.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                background: "#111",
                                color: "var(--jrpg-white)",
                                border: "1px solid var(--jrpg-border-gold)",
                              }}
                              step={0.5}
                            />
                          </label>
                        </div>
                        <label
                          className="jrpg-text-small"
                          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                          Rotation (degrees)
                          <input
                            type="number"
                            value={stagingInputs.rotation}
                            onChange={(event) =>
                              handleStagingInputChange("rotation", event.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "6px",
                              background: "#111",
                              color: "var(--jrpg-white)",
                              border: "1px solid var(--jrpg-border-gold)",
                            }}
                            step={1}
                          />
                        </label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <JRPGButton
                            onClick={handleStagingZoneApply}
                            variant="primary"
                            style={{ fontSize: "10px", flex: "1 1 auto" }}
                            disabled={!onSetPlayerStagingZone}
                          >
                            Apply Zone
                          </JRPGButton>
                          <JRPGButton
                            onClick={handleStagingZoneClear}
                            variant="danger"
                            style={{ fontSize: "10px", flex: "1 1 auto" }}
                            disabled={!onSetPlayerStagingZone}
                          >
                            Clear Zone
                          </JRPGButton>
                        </div>
                        <span
                          className="jrpg-text-tiny"
                          style={{ color: "var(--jrpg-white)", opacity: 0.6 }}
                        >
                          Click &ldquo;Apply Zone&rdquo; to create/update the staging zone. Use the
                          Transform tool to move and resize it on the map. Players spawn randomly
                          within this area.
                        </span>
                      </div>
                    </CollapsibleSection>
                  </div>
                </JRPGPanel>

                {/* Step 6: Session Cleanup */}
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
                  <EmptyState message="No NPCs yet. Use &ldquo;Add NPC&rdquo; to create one." />
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
                  <EmptyState message="No props yet. Use &ldquo;Add Prop&rdquo; to create one." />
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
                    <FormInput label="Session Name" value={sessionName} onChange={(v) => setSessionName(v as string)} />

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
                    <FormInput
                      label="Password"
                      type="password"
                      value={passwordInput}
                      onChange={handlePasswordChange}
                      placeholder="New password"
                    />
                    <FormInput
                      label="Confirm Password"
                      type="password"
                      value={passwordConfirmInput}
                      onChange={handlePasswordConfirmChange}
                      placeholder="Confirm password"
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
