// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo } from "react";
import type { Player } from "@shared";

export interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  tokenColor?: string;
  micEnabled: boolean;
  micLevel: number;
  editingPlayerUID: string | null;
  nameInput: string;
  onNameInputChange: (name: string) => void;
  onNameEdit: (uid: string, name: string) => void;
  onNameSubmit: (name: string) => void;
  onPortraitLoad: () => void;
  onToggleMic: () => void;
  onHpChange: (hp: number) => void;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (maxHp: string) => void;
  onMaxHpEdit: (uid: string, maxHp: number) => void;
  onMaxHpSubmit: (maxHp: string) => void;
}

export const PlayerCard = memo<PlayerCardProps>(({
  player,
  isMe,
  tokenColor,
  micEnabled,
  micLevel,
  editingPlayerUID,
  nameInput,
  onNameInputChange,
  onNameEdit,
  onNameSubmit,
  onPortraitLoad,
  onToggleMic,
  onHpChange,
  editingMaxHpUID,
  maxHpInput,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
}) => {
  const editing = editingPlayerUID === player.uid;
  const editingMaxHp = editingMaxHpUID === player.uid;

  return (
    <div
      className="player-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#dbe1ff",
        fontSize: "0.8rem",
        gap: "6px",
      }}
    >
      <div
        style={{
          width: "100%",
          textAlign: "center",
          borderBottom: "1px solid #444",
          marginBottom: "4px",
          fontSize: "0.7rem",
        }}
      >
        {isMe && editing ? (
          <input
            type="text"
            value={nameInput}
            onChange={(e) => onNameInputChange(e.target.value)}
            onBlur={() => onNameSubmit(nameInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onNameSubmit(nameInput);
              }
            }}
            autoFocus
            style={{
              width: "100%",
              fontSize: "0.7rem",
              background: "#111",
              color: "var(--hero-blue)",
              border: "1px solid var(--hero-gold)",
              padding: "2px",
              textAlign: "center",
            }}
          />
        ) : (
          <span
            onClick={() => {
              if (isMe) {
                onNameEdit(player.uid, player.name);
              }
            }}
            style={{
              cursor: isMe ? "pointer" : "default",
              color: tokenColor || "var(--hero-gold-light)",
              fontWeight: "bold",
              textShadow: "0 0 6px rgba(240, 226, 195, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8)",
            }}
          >
            {player.name}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
        {/* Pixel class icon */}
        <div
          style={{
            width: "24px",
            height: "24px",
            background: "linear-gradient(135deg, var(--hero-blue) 0%, var(--hero-gold) 100%)",
            border: "2px solid var(--hero-gold-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            boxShadow: "0 0 6px rgba(68, 125, 247, 0.4)",
          }}
        >
          ⚔️
        </div>
        <div
          className="player-portrait"
          style={{
            transform: (player.micLevel ?? 0) > 0.1
              ? `scale(${1 + (player.micLevel ?? 0) * 0.2})`
              : "scale(1)",
            transition: "transform 0.1s ease-out",
            flex: 1,
          }}
        >
          {player.portrait && (
            <img
              key={player.portrait.substring(0, 100)}
              src={player.portrait}
              alt="portrait"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
                userSelect: "none",
                display: "block",
              }}
              draggable={false}
            />
          )}
        </div>
      </div>

      {/* HP Bar with numerical display and drag support */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ fontSize: "0.6rem", color: "var(--hero-text-dim)", textAlign: "center" }}>
          HP: {player.hp ?? 100} / {editingMaxHp ? (
            <input
              type="number"
              value={maxHpInput}
              onChange={(e) => onMaxHpInputChange(e.target.value)}
              onBlur={() => onMaxHpSubmit(maxHpInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onMaxHpSubmit(maxHpInput);
                }
              }}
              autoFocus
              style={{
                width: "40px",
                fontSize: "0.6rem",
                background: "#111",
                color: "var(--hero-blue)",
                border: "1px solid var(--hero-gold)",
                padding: "1px 2px",
                textAlign: "center",
              }}
            />
          ) : (
            <span
              onClick={() => {
                if (isMe) {
                  onMaxHpEdit(player.uid, player.maxHp ?? 100);
                }
              }}
              style={{
                cursor: isMe ? "pointer" : "default",
                textDecoration: isMe ? "underline" : "none",
              }}
            >
              {player.maxHp ?? 100}
            </span>
          )}
        </div>
        <div
          className="stat-bar hp"
          style={{
            cursor: isMe ? "ew-resize" : "default",
            position: "relative"
          }}
          onMouseDown={isMe ? (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            const bar = e.currentTarget;
            const rect = bar.getBoundingClientRect();

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const x = moveEvent.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              const newHp = Math.round(percentage * (player.maxHp ?? 100));
              onHpChange(newHp);
            };

            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            handleMouseMove(e.nativeEvent);
          } : undefined}
        >
          <div
            className="stat-bar-fill"
            style={{ width: `${((player.hp ?? 100) / (player.maxHp ?? 100)) * 100}%` }}
          ></div>
        </div>
      </div>

      {isMe && (
        <>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.7rem", padding: "4px 8px" }}
              onClick={onPortraitLoad}
            >
              Load
            </button>
            <button
              className={micEnabled ? "btn btn-danger" : "btn btn-success"}
              style={{ fontSize: "0.7rem", padding: "4px 8px" }}
              onClick={onToggleMic}
              title={micEnabled ? "Mute mic" : "Enable mic"}
            >
              {micEnabled ? "🔇" : "🎤"}
            </button>
          </div>
        </>
      )}
      {!isMe && (
        <div style={{ height: "30px" }} />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if relevant props change
  return (
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.portrait === nextProps.player.portrait &&
    prevProps.player.micLevel === nextProps.player.micLevel &&
    prevProps.player.hp === nextProps.player.hp &&
    prevProps.player.maxHp === nextProps.player.maxHp &&
    prevProps.tokenColor === nextProps.tokenColor &&
    prevProps.micEnabled === nextProps.micEnabled &&
    prevProps.micLevel === nextProps.micLevel &&
    prevProps.editingPlayerUID === nextProps.editingPlayerUID &&
    prevProps.nameInput === nextProps.nameInput &&
    prevProps.editingMaxHpUID === nextProps.editingMaxHpUID &&
    prevProps.maxHpInput === nextProps.maxHpInput
  );
});
