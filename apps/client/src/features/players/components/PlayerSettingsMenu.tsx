// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// Collapsible panel containing token image controls and state save/load actions

import { useRef } from "react";

interface PlayerSettingsMenuProps {
  isOpen: boolean;
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
}

export function PlayerSettingsMenu({
  isOpen,
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
          background: "rgba(12, 19, 38, 0.95)",
          border: "1px solid var(--jrpg-border-gold)",
          boxShadow: "0 12px 24px rgba(5, 8, 15, 0.45)",
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
            placeholder="https://example.com/token.png"
            onChange={(event) => onTokenImageInputChange(event.target.value)}
            onBlur={() => onTokenImageApply(tokenImageInput.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onTokenImageApply(tokenImageInput.trim());
              }
            }}
            style={{
              width: "100%",
              background: "#111",
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

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />

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

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />

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
      </div>
    </div>
  );
}
