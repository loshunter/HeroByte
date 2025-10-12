// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// Collapsible panel containing token image controls and state save/load actions

import { useRef } from "react";
import { createPortal } from "react-dom";

import type { TokenSize } from "@shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";

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
  statusIcon: { emoji: string; label: string } | null;
  onStatusChange: (icon: { emoji: string; label: string } | null) => void;
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  onDeleteToken?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
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
}: PlayerSettingsMenuProps): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) {
    return null;
  }

  const statusOptions = [
    { emoji: "", label: "None" },
    { emoji: "☠️", label: "Poisoned" },
    { emoji: "🔥", label: "Burning" },
    { emoji: "❄️", label: "Frozen" },
  ];

  return createPortal(
    <DraggableWindow
      title="Player Settings"
      onClose={onClose}
      initialX={300}
      initialY={100}
      width={280}
      minWidth={280}
      maxWidth={350}
      storageKey="player-settings-menu"
      zIndex={1001}
    >
      <div
        className="jrpg-frame-simple"
        style={{
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "rgba(12, 16, 40, 0.9)",
          borderRadius: "10px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Token Image URL
          </label>
          <input
            className="jrpg-input"
            type="text"
            value={tokenImageInput}
            placeholder="https://example.com/token.png"
            onChange={(event) => onTokenImageInputChange(event.target.value)}
            onBlur={() => onTokenImageApply(tokenImageInput.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onTokenImageApply(tokenImageInput.trim());
              }
            }}
          />
          <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, fontSize: "0.65rem", padding: "4px 6px" }}
              onClick={() => onTokenImageApply(tokenImageInput.trim())}
            >
              Apply
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: "0.65rem", padding: "4px 6px" }}
              onClick={onTokenImageClear}
            >
              Clear
            </button>
          </div>
          {tokenImageUrl ? (
            <img
              src={tokenImageUrl}
              alt="Token preview"
              style={{
                width: "56px",
                height: "56px",
                margin: "6px auto 0",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid var(--jrpg-border-gold)",
              }}
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>

        <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Player State
          </span>
          <button
            className="btn btn-primary"
            style={{ fontSize: "0.65rem" }}
            onClick={onSavePlayerState}
          >
            Save to File
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "0.65rem" }}
            onClick={() => fileInputRef.current?.click()}
          >
            Load from File
          </button>
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
        </div>

        <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Dungeon Master Mode
          </span>
          <button
            className={isDM ? "btn btn-primary" : "btn btn-secondary"}
            style={{ fontSize: "0.65rem" }}
            onClick={() => onToggleDMMode(!isDM)}
          >
            {isDM ? "DM Mode: ON" : "DM Mode: OFF"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />

        {onTokenSizeChange && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                Token Size
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
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
                    return (
                      <button
                        key={size}
                        className={tokenSize === size ? "btn btn-primary" : "btn btn-secondary"}
                        style={{ fontSize: "0.6rem", padding: "4px 2px" }}
                        onClick={() => onTokenSizeChange(size)}
                        title={size.charAt(0).toUpperCase() + size.slice(1)}
                      >
                        {sizeLabels[size]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />
          </>
        )}

        {onToggleTokenLock && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                Token Lock
              </span>
              <button
                className={tokenLocked ? "btn btn-primary" : "btn btn-secondary"}
                style={{ fontSize: "0.65rem" }}
                onClick={() => onToggleTokenLock(!tokenLocked)}
                title={tokenLocked ? "Token is locked (DM only)" : "Token is unlocked"}
              >
                {tokenLocked ? "🔒 Locked" : "🔓 Unlocked"}
              </button>
            </div>
            <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Status Effect
          </span>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {statusOptions.map((icon) => {
              const isNone = icon.label === "None";
              const active = statusIcon?.label === icon.label || (!statusIcon && isNone);
              const handleStatusClick = () => {
                const nextStatus = isNone ? null : { emoji: icon.emoji || "", label: icon.label };
                onStatusChange(nextStatus);
              };
              return (
                <button
                  key={icon.label}
                  className={active ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ fontSize: "0.6rem", padding: "4px 6px" }}
                  onClick={handleStatusClick}
                >
                  {icon.emoji ? `${icon.emoji} ${icon.label}` : icon.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* DM-only: Delete Token button */}
        {isDM && onDeleteToken && (
          <>
            <div style={{ borderTop: "1px solid rgba(226, 183, 92, 0.25)", margin: "4px 0" }} />
            <button
              className="btn btn-danger"
              style={{ fontSize: "0.65rem" }}
              onClick={() => {
                if (confirm("Delete this player's token? This cannot be undone.")) {
                  onDeleteToken();
                }
              }}
            >
              🗑️ Delete Token (DM)
            </button>
          </>
        )}
      </div>
    </DraggableWindow>,
    document.body,
  );
}
