// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// Collapsible panel containing token image controls and state save/load actions

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TokenSize } from "@shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useImageUrlNormalization } from "../../../hooks/useImageUrlNormalization";
import { STATUS_OPTIONS } from "../constants/statusOptions";
import { CharacterCreationModal } from "./CharacterCreationModal";

interface PlayerSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tokenImageInput: string;
  tokenImageUrl?: string;
  onTokenImageInputChange: (value: string) => void;
  onTokenImageClear: () => void;
  onTokenImageApply: (value: string) => void;
  onSavePlayerState: () => void;
  onLoadPlayerState: (file: File) => Promise<void>;
  selectedEffects: string[];
  onStatusEffectsChange: (effects: string[]) => void;
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  onDeleteToken?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  onAddCharacter?: (name: string) => boolean;
  isCreatingCharacter?: boolean;
  characterId?: string;
  onDeleteCharacter?: (characterId: string) => void;
  initiative?: number;
  onClearInitiative?: () => void;
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
  onToggleDMMode,
  onDeleteToken,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  onAddCharacter,
  isCreatingCharacter,
  characterId,
  onDeleteCharacter,
  initiative,
  onClearInitiative,
}: PlayerSettingsMenuProps): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { normalizeUrl } = useImageUrlNormalization();
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [localEffects, setLocalEffects] = useState<string[]>(selectedEffects);

  const handleApplyTokenImage = async () => {
    const normalizedUrl = await normalizeUrl(tokenImageInput.trim());
    onTokenImageApply(normalizedUrl);
  };

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
      title="🎮 Player Settings"
      onClose={onClose}
      initialX={300}
      initialY={100}
      width={280}
      minWidth={280}
      maxWidth={350}
      storageKey="player-settings-menu"
      zIndex={1001}
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
        {/* DM players don't have tokens, so hide token controls when isDM is true */}
        {!isDM && (
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
              Token Image URL
            </label>
            <input
              className="jrpg-input"
              type="text"
              value={tokenImageInput}
              placeholder="https://example.com/token.png"
              onChange={(event) => onTokenImageInputChange(event.target.value)}
              onBlur={handleApplyTokenImage}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleApplyTokenImage();
                }
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <JRPGButton
                onClick={handleApplyTokenImage}
                variant="primary"
                style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
              >
                Apply
              </JRPGButton>
              <JRPGButton
                onClick={onTokenImageClear}
                style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
              >
                Clear
              </JRPGButton>
            </div>
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

        <JRPGPanel
          variant="simple"
          style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
        >
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Dungeon Master Mode
          </span>
          <JRPGButton
            onClick={() => onToggleDMMode(!isDM)}
            variant={isDM ? "success" : "default"}
            style={{ fontSize: "10px" }}
          >
            {isDM ? "DM Mode: ON" : "DM Mode: OFF"}
          </JRPGButton>
        </JRPGPanel>

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

        {isDM && onDeleteToken && (
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
