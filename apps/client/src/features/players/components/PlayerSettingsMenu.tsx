// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// Collapsible panel containing token image controls and state save/load actions

import { useRef } from "react";
import { createPortal } from "react-dom";

import type { TokenSize } from "@shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useImageUrlNormalization } from "../../../hooks/useImageUrlNormalization";

export interface StatusOption {
  value: string;
  emoji: string;
  label: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "", emoji: "", label: "None" },
  { value: "poisoned", emoji: "☠️", label: "Poisoned" },
  { value: "burning", emoji: "🔥", label: "Burning" },
  { value: "frozen", emoji: "❄️", label: "Frozen" },
];

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
  statusIcon: StatusOption | null;
  onStatusChange: (option: StatusOption | null) => void;
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  onDeleteToken?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  onAddCharacter?: (name: string) => void;
  characterId?: string;
  onDeleteCharacter?: (characterId: string) => void;
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
  statusIcon,
  onStatusChange,
  isDM,
  onToggleDMMode,
  onDeleteToken,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  onAddCharacter,
  characterId,
  onDeleteCharacter,
}: PlayerSettingsMenuProps): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { normalizeUrl } = useImageUrlNormalization();

  const handleApplyTokenImage = async () => {
    const normalizedUrl = await normalizeUrl(tokenImageInput.trim());
    onTokenImageApply(normalizedUrl);
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
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
            Status Effect
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {STATUS_OPTIONS.map((option) => {
              const isNone = option.value === "";
              const active = statusIcon ? statusIcon.value === option.value : isNone;
              const handleStatusClick = () => {
                onStatusChange(isNone ? null : option);
              };
              return (
                <JRPGButton
                  key={option.value || "none"}
                  onClick={handleStatusClick}
                  variant={active ? "primary" : "default"}
                  style={{ fontSize: "10px", padding: "6px 8px" }}
                >
                  {option.emoji ? `${option.emoji} ${option.label}` : option.label}
                </JRPGButton>
              );
            })}
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
              onClick={() => {
                const confirmed = confirm(
                  "Are you sure you want to have 2 separate characters in the campaign?\n\nThis will create a new character card with its own HP, portrait, and token that you control.",
                );
                if (confirmed) {
                  const name = prompt("Enter character name:", "Character 2");
                  if (name && name.trim()) {
                    onAddCharacter(name.trim());
                  }
                }
              }}
              variant="primary"
              style={{ fontSize: "10px" }}
            >
              ➕ Add Character
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
}
