// ============================================================================
// NPC SETTINGS MENU
// ============================================================================
// Collapsible panel for NPC-specific management actions (token image, placement,
// deletion). Mirrors the styling of the player settings popover.

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import type { TokenSize } from "@shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { useImageUrlNormalization } from "../../../hooks/useImageUrlNormalization";

interface NpcSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tokenImageInput: string;
  tokenImageUrl?: string;
  onTokenImageInputChange: (value: string) => void;
  onTokenImageApply: (value: string) => void;
  onTokenImageClear: () => void;
  onPlaceToken: () => void;
  onDelete: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  /** Whether NPC deletion is in progress */
  isDeleting?: boolean;
  /** Error message from deletion attempt */
  deletionError?: string | null;
  onClearInitiative?: () => void;
  hasInitiative?: boolean;
}

export function NpcSettingsMenu({
  isOpen,
  onClose,
  tokenImageInput,
  tokenImageUrl,
  onTokenImageInputChange,
  onTokenImageApply,
  onTokenImageClear,
  onPlaceToken,
  onDelete,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  isDeleting = false,
  deletionError = null,
  onClearInitiative,
  hasInitiative = false,
}: NpcSettingsMenuProps): JSX.Element | null {
  const [wasDeleting, setWasDeleting] = useState(false);
  const { normalizeUrl } = useImageUrlNormalization();

  const handleApplyTokenImage = async () => {
    const normalizedUrl = await normalizeUrl(tokenImageInput.trim());
    onTokenImageApply(normalizedUrl);
  };

  // Auto-close when deletion completes successfully
  useEffect(() => {
    if (wasDeleting && !isDeleting && !deletionError) {
      // Deletion finished successfully
      console.log("[NpcSettingsMenu] Deletion completed, closing menu");
      onClose();
    }
    setWasDeleting(isDeleting);
  }, [isDeleting, wasDeleting, deletionError, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <DraggableWindow
      title="NPC Settings"
      onClose={onClose}
      initialX={350}
      initialY={150}
      width={280}
      minWidth={280}
      maxWidth={350}
      storageKey="npc-settings-menu"
      zIndex={1001}
    >
      <div
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Token Image URL
          </label>
          <input
            type="text"
            value={tokenImageInput}
            placeholder="https://enemy-token.png"
            onChange={(event) => onTokenImageInputChange(event.target.value)}
            onBlur={handleApplyTokenImage}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleApplyTokenImage();
              }
            }}
            style={{
              width: "100%",
              background: "#211317",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
              padding: "4px",
              fontSize: "0.7rem",
            }}
          />
          <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, fontSize: "0.65rem", padding: "4px 6px" }}
              onClick={handleApplyTokenImage}
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

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "0.65rem" }}
            onClick={onPlaceToken}
          >
            Place Token
          </button>

          {onTokenSizeChange && (
            <>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}
              >
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
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />
            </>
          )}

          {onClearInitiative && (
            <>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}
              >
                <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                  Initiative
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.65rem" }}
                  onClick={onClearInitiative}
                  disabled={!hasInitiative}
                >
                  🧹 Clear Initiative
                </button>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />
            </>
          )}

          {onToggleTokenLock && (
            <button
              className={tokenLocked ? "btn btn-primary" : "btn btn-secondary"}
              style={{ fontSize: "0.65rem" }}
              onClick={() => onToggleTokenLock(!tokenLocked)}
              title={tokenLocked ? "Token is locked (DM can unlock)" : "Token is unlocked"}
            >
              {tokenLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          )}

          {deletionError && (
            <div
              className="jrpg-text-small"
              style={{
                color: "var(--jrpg-red)",
                padding: "4px",
                textAlign: "center",
                border: "1px solid var(--jrpg-red)",
                borderRadius: "4px",
                background: "rgba(214, 60, 83, 0.1)",
              }}
            >
              {deletionError}
            </div>
          )}

          <button
            className="btn btn-danger"
            style={{ fontSize: "0.65rem" }}
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete NPC"}
          </button>
        </div>
      </div>
    </DraggableWindow>,
    document.body,
  );
}
