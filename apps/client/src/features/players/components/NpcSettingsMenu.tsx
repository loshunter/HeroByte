// ============================================================================
// NPC SETTINGS MENU
// ============================================================================
// Collapsible panel for NPC-specific management actions (token image, placement,
// deletion). Mirrors the styling of the player settings popover.

import type { TokenSize } from "@shared";

interface NpcSettingsMenuProps {
  isOpen: boolean;
  tokenImageInput: string;
  tokenImageUrl?: string;
  onTokenImageInputChange: (value: string) => void;
  onTokenImageApply: (value: string) => void;
  onTokenImageClear: () => void;
  onPlaceToken: () => void;
  onDelete: () => void;
  statusIcon: { emoji: string; label: string } | null;
  onStatusChange: (icon: { emoji: string; label: string } | null) => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
}

export function NpcSettingsMenu({
  isOpen,
  tokenImageInput,
  tokenImageUrl,
  onTokenImageInputChange,
  onTokenImageApply,
  onTokenImageClear,
  onPlaceToken,
  onDelete,
  statusIcon,
  onStatusChange,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
}: NpcSettingsMenuProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  const statusOptions = [
    { emoji: "", label: "None" },
    { emoji: "☠️", label: "Poisoned" },
    { emoji: "🔥", label: "Burning" },
    { emoji: "❄️", label: "Frozen" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "6px",
        zIndex: 30,
        width: "220px",
      }}
    >
      <div
        className="jrpg-panel jrpg-panel-simple"
        style={{
          padding: "10px",
          background: "rgba(34, 11, 18, 0.95)",
          border: "1px solid var(--jrpg-border-gold)",
          boxShadow: "0 12px 24px rgba(12, 6, 12, 0.55)",
          borderRadius: "8px",
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
            onBlur={() => onTokenImageApply(tokenImageInput.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onTokenImageApply(tokenImageInput.trim());
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
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
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
          <button className="btn btn-danger" style={{ fontSize: "0.65rem" }} onClick={onDelete}>
            Delete NPC
          </button>
        </div>
      </div>
    </div>
  );
}
