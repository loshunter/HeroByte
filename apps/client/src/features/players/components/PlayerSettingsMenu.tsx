// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// Collapsible panel containing token image controls and state save/load actions

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { ImageField } from "../../../components/ui/ImageField";
import { VisionRadiusField } from "./VisionRadiusField";
import { STATUS_OPTIONS } from "../constants/statusOptions";
import { CharacterCreationModal } from "./CharacterCreationModal";

interface PlayerSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /*
   * These are OPTIONAL, and the sections that use them render only when they
   * are supplied. The mobile sheet used to satisfy them with `""` and `() => {}`
   * to meet a required-prop signature, which shipped a text field that could not
   * be typed into, a "Save to File" that did nothing, and a "Load from File"
   * that opened a real OS file picker and discarded the chosen file. Omitting
   * a capability is honest; faking it is not.
   */
  tokenImageInput?: string;
  tokenImageUrl?: string;
  onTokenImageInputChange?: (value: string) => void;
  onTokenImageClear?: () => void;
  onTokenImageApply?: (value: string) => void;
  onSavePlayerState?: () => void;
  onLoadPlayerState?: (file: File) => Promise<void>;
  selectedEffects: string[];
  onStatusEffectsChange: (effects: string[]) => void;
  /** Whether the player/character this card BELONGS TO is a DM. */
  isDM: boolean;
  /**
   * Whether the person LOOKING at this card is a DM, and may they toggle it.
   *
   * These are separate on purpose. `onToggleDMMode` is viewer-scoped — it grants
   * or revokes the VIEWER's own DM status — but the panel used to label itself
   * from `isDM`, the card owner's flag. On another player's card that meant the
   * button read their state and acted on yours: it silently no-opped for a
   * non-DM viewer, and for a second DM it offered to "revoke your DM status"
   * while appearing to demote someone else. The panel is now rendered only on
   * the viewer's own card, and reads `viewerIsDM`.
   */
  viewerIsDM?: boolean;
  /** Show the DM Mode panel at all — true only on the viewer's own card. */
  canToggleDM?: boolean;
  onToggleDMMode: (next: boolean) => void;
  onDeleteToken?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  /** Sight limit in feet; undefined is unlimited. DM-only (S7). */
  tokenVisionRadius?: number;
  /** The table's default sight radius in feet, so a token that INHERITS it can
   *  say what it inherited. Undefined means no default is set, which is
   *  unlimited — a real answer, not a missing one. */
  tableVisionDefault?: number;
  onTokenVisionRadiusChange?: (radiusFeet: number | null) => void;
  /** Render the sight controls at the 44px touch floor (mobile rows). */
  compactControls?: boolean;
  onAddCharacter?: (name: string) => boolean;
  isCreatingCharacter?: boolean;
  characterId?: string;
  onDeleteCharacter?: (characterId: string) => void;
  initiative?: number;
  onClearInitiative?: () => void;
  // New props for name and portrait editing
  nameInput?: string;
  onNameInputChange?: (value: string) => void;
  onNameSubmit?: () => void;
  portraitImageInput?: string;
  onPortraitInputChange?: (value: string) => void;
  onPortraitApply?: (value: string) => void;
}

export function PlayerSettingsMenu({
  isOpen,
  onClose,
  tokenImageInput,
  tokenImageUrl,
  onTokenImageInputChange,
  onTokenImageClear,
  onTokenImageApply,
  onSavePlayerState,
  onLoadPlayerState,
  selectedEffects,
  onStatusEffectsChange,
  isDM,
  viewerIsDM = false,
  canToggleDM = false,
  onToggleDMMode,
  onDeleteToken,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  tokenVisionRadius,
  tableVisionDefault,
  onTokenVisionRadiusChange,
  compactControls = false,
  onAddCharacter,
  isCreatingCharacter,
  characterId,
  onDeleteCharacter,
  initiative,
  onClearInitiative,
  nameInput,
  onNameInputChange,
  onNameSubmit,
  portraitImageInput,
  onPortraitInputChange,
  onPortraitApply,
}: PlayerSettingsMenuProps): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [localEffects, setLocalEffects] = useState<string[]>(selectedEffects);

  const handleToggleEffect = (value: string) => {
    const newEffects = localEffects.includes(value)
      ? localEffects.filter((e) => e !== value)
      : [...localEffects, value];
    setLocalEffects(newEffects);
    onStatusEffectsChange(newEffects);
  };

  useEffect(() => {
    if (!dropdownOpen) {
      setLocalEffects(selectedEffects);
    }
  }, [selectedEffects, dropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!isOpen) {
    return null;
  }

  const settingsMenu = createPortal(
    <DraggableWindow
      // Named and positioned PER SUBJECT. Every settings window used to be
      // titled "🎮 Player Settings" and share one saved position, so a DM
      // opening Alice's and then Bob's got two identical windows stacked
      // pixel-for-pixel with nothing on screen naming who each belonged to.
      title={nameInput ? `🎮 ${nameInput}` : "🎮 Player Settings"}
      onClose={onClose}
      initialX={300}
      initialY={100}
      width={280}
      minWidth={280}
      maxWidth={350}
      storageKey={characterId ? `player-settings-menu:${characterId}` : "player-settings-menu"}
      zIndex={2500}
    >
      <JRPGPanel
        variant="bevel"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "12px",
          background: "rgba(12, 18, 40, 0.95)",
        }}
      >
        {/* Name Editing */}
        {onNameInputChange && onNameSubmit && nameInput !== undefined && (
          <JRPGPanel
            variant="simple"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px",
            }}
          >
            <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Character Name
            </label>
            <input
              className="jrpg-input"
              type="text"
              value={nameInput}
              placeholder="Enter Name"
              onChange={(event) => onNameInputChange(event.target.value)}
              onBlur={onNameSubmit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onNameSubmit();
                }
              }}
            />
          </JRPGPanel>
        )}

        {/* Portrait: upload from disk/camera roll, or paste a URL (S3) */}
        {onPortraitInputChange && onPortraitApply && portraitImageInput !== undefined && (
          <JRPGPanel
            variant="simple"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px",
            }}
          >
            <ImageField
              label="Portrait Image URL"
              value={portraitImageInput}
              onChange={onPortraitInputChange}
              onCommit={(url) => {
                // An empty commit means "typed nothing"; portraits keep their
                // long-standing skip-empty behavior (Clear never existed here).
                if (url) onPortraitApply(url);
              }}
              placeholder="https://example.com/portrait.png"
              applyLabel="Apply Portrait"
            />
          </JRPGPanel>
        )}

        {/*
          DM players don't have tokens, so hide token controls when isDM is true.
          Also hidden when no handler is supplied: the mobile sheet used to pass
          a value pinned to "" with a no-op onChange, producing a text field that
          physically could not be typed into.
        */}
        {!isDM && onTokenImageInputChange && onTokenImageApply && (
          <JRPGPanel
            variant="simple"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px",
            }}
          >
            <ImageField
              label="Token Image URL"
              value={tokenImageInput ?? ""}
              onChange={onTokenImageInputChange}
              onCommit={onTokenImageApply}
              onClear={onTokenImageClear}
              placeholder="https://example.com/token.png"
            />
            {tokenImageUrl ? (
              <img
                src={tokenImageUrl}
                alt="Token preview"
                style={{
                  width: "60px",
                  height: "60px",
                  margin: "4px auto 0",
                  objectFit: "cover",
                  borderRadius: "6px",
                  border: "2px solid var(--jrpg-border-gold)",
                }}
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </JRPGPanel>
        )}

        {onSavePlayerState && onLoadPlayerState && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Player State
            </span>
            <JRPGButton onClick={onSavePlayerState} variant="primary" style={{ fontSize: "10px" }}>
              Save to File
            </JRPGButton>
            <JRPGButton onClick={() => fileInputRef.current?.click()} style={{ fontSize: "10px" }}>
              Load from File
            </JRPGButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await onLoadPlayerState(file);
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : "Unknown error loading player state";
                  window.alert(message);
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </JRPGPanel>
        )}

        {canToggleDM && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Dungeon Master Mode
            </span>
            <JRPGButton
              onClick={() => onToggleDMMode(!viewerIsDM)}
              variant={viewerIsDM ? "success" : "default"}
              style={{ fontSize: "10px" }}
            >
              {viewerIsDM ? "DM Mode: ON" : "DM Mode: OFF"}
            </JRPGButton>
          </JRPGPanel>
        )}

        {onClearInitiative && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Initiative Status
            </span>
            <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
              {initiative !== undefined ? `Active: ${initiative}` : "No initiative set"}
            </div>
            <JRPGButton
              onClick={onClearInitiative}
              variant="default"
              disabled={initiative === undefined}
              style={{ fontSize: "10px", padding: "6px 8px" }}
            >
              🧹 Clear Initiative
            </JRPGButton>
          </JRPGPanel>
        )}

        {/* Token Size - only show for non-DM players who have tokens */}
        {!isDM && onTokenSizeChange && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Token Size
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
              {(["tiny", "small", "medium", "large", "huge", "gargantuan"] as TokenSize[]).map(
                (size) => {
                  const sizeLabels: Record<TokenSize, string> = {
                    tiny: "Tiny",
                    small: "Small",
                    medium: "Med",
                    large: "Large",
                    huge: "Huge",
                    gargantuan: "Garg",
                  };
                  const active = tokenSize === size;
                  return (
                    <JRPGButton
                      key={size}
                      onClick={() => onTokenSizeChange(size)}
                      variant={active ? "primary" : "default"}
                      style={{ fontSize: "10px", padding: "6px 4px" }}
                      title={size.charAt(0).toUpperCase() + size.slice(1)}
                    >
                      {sizeLabels[size]}
                    </JRPGButton>
                  );
                },
              )}
            </div>
          </JRPGPanel>
        )}

        {/* Sight Radius — supplied only for a DM viewer (EntitiesPanel), so
            unlike Token Size this is NOT gated on the card owner's role: a DM
            sets the darkness on every token, including their own. */}
        {onTokenVisionRadiusChange && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <VisionRadiusField
              value={tokenVisionRadius}
              inheritsTableDefault
              tableDefault={tableVisionDefault}
              onChange={onTokenVisionRadiusChange}
              compact={compactControls}
            />
          </JRPGPanel>
        )}

        {/* Token Lock - only show for non-DM players who have tokens */}
        {!isDM && onToggleTokenLock && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Token Lock
            </span>
            <JRPGButton
              onClick={() => onToggleTokenLock(!tokenLocked)}
              variant={tokenLocked ? "primary" : "default"}
              style={{ fontSize: "10px" }}
              title={tokenLocked ? "Token is locked (DM only)" : "Token is unlocked"}
            >
              {tokenLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </JRPGButton>
          </JRPGPanel>
        )}

        <JRPGPanel
          variant="simple"
          style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
        >
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Status Effects
          </span>
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <JRPGButton
              onClick={() => setDropdownOpen(!dropdownOpen)}
              variant="default"
              style={{ width: "100%", fontSize: "10px", padding: "6px 8px" }}
            >
              {localEffects.length === 0
                ? "No Effects"
                : `${localEffects.length} Active Effect${localEffects.length === 1 ? "" : "s"}`}
            </JRPGButton>
            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "4px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  background: "rgba(12, 18, 40, 0.98)",
                  border: "2px solid var(--jrpg-border-gold)",
                  borderRadius: "6px",
                  padding: "8px",
                  zIndex: 1000,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                }}
              >
                {STATUS_OPTIONS.map((option) => {
                  const isSelected = localEffects.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        transition: "background 0.2s, border 0.2s",
                        fontSize: "12px",
                        color: isSelected ? "var(--jrpg-gold)" : "var(--jrpg-white)",
                        background: isSelected ? "rgba(255, 215, 0, 0.15)" : "transparent",
                        border: isSelected
                          ? "1px solid rgba(255, 215, 0, 0.4)"
                          : "1px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255, 215, 0, 0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                      onClick={() => handleToggleEffect(option.value)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleEffect(option.value);
                        }}
                        style={{
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      <span>
                        {option.emoji} {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </JRPGPanel>

        {/* Add Character - only show for non-DM players */}
        {!isDM && onAddCharacter && (
          <JRPGPanel
            variant="simple"
            style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
          >
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
              Multiple Characters
            </span>
            <JRPGButton
              onClick={() => setShowCharacterModal(true)}
              variant="primary"
              style={{ fontSize: "10px" }}
              disabled={isCreatingCharacter}
            >
              {isCreatingCharacter ? "Creating..." : "➕ Add Character"}
            </JRPGButton>
            {characterId && onDeleteCharacter && (
              <JRPGButton
                onClick={() => {
                  if (
                    confirm(
                      "Delete this character? This will remove the character and their token.",
                    )
                  ) {
                    onDeleteCharacter(characterId);
                  }
                }}
                variant="danger"
                style={{ fontSize: "10px" }}
              >
                🗑️ Delete this character
              </JRPGButton>
            )}
          </JRPGPanel>
        )}

        {/*
          Gated on viewerIsDM, not isDM. `isDM` is the CARD OWNER's flag while
          `onDeleteToken` is only ever supplied to a DM VIEWER — an impossible
          combination, so this button could never render at all.
        */}
        {viewerIsDM && onDeleteToken && (
          <JRPGPanel variant="simple" style={{ padding: "12px" }}>
            <JRPGButton
              onClick={() => {
                if (confirm("Delete this player's token? This cannot be undone.")) {
                  onDeleteToken();
                }
              }}
              variant="danger"
              style={{ width: "100%", fontSize: "10px" }}
            >
              🗑️ Delete Token (DM)
            </JRPGButton>
          </JRPGPanel>
        )}
      </JRPGPanel>
    </DraggableWindow>,
    document.body,
  );

  const modal = onAddCharacter ? (
    <CharacterCreationModal
      isOpen={showCharacterModal}
      onCreateCharacter={(name) => {
        const success = onAddCharacter(name);
        if (!success) {
          // Creation already in progress, keep modal open
          return false;
        }
        // Modal will auto-close when isCreating becomes false
        return true;
      }}
      isCreating={isCreatingCharacter ?? false}
      onClose={() => setShowCharacterModal(false)}
    />
  ) : null;

  return (
    <>
      {settingsMenu}
      {modal}
    </>
  );
}
