// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { PlayerState, Player } from "@shared";
import { NameEditor } from "./NameEditor";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { CardControls } from "./CardControls";
import { loadPlayerState, savePlayerState } from "../../../utils/playerPersistence";

export interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  tokenColor?: string;
  micEnabled: boolean;
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
  tokenImageUrl?: string;
  onTokenImageSubmit?: (url: string) => void;
  tokenId?: string;
  onApplyPlayerState?: (state: PlayerState, tokenId?: string) => void;
}

export const PlayerCard = memo<PlayerCardProps>(
  ({
    player,
    isMe,
    tokenColor,
    micEnabled,
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
    tokenImageUrl,
    onTokenImageSubmit,
    tokenId,
    onApplyPlayerState,
  }) => {
    const editing = editingPlayerUID === player.uid;
    const editingMaxHp = editingMaxHpUID === player.uid;
    const [tokenImageInput, setTokenImageInput] = useState(tokenImageUrl ?? "");
    const playerStateInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setTokenImageInput(tokenImageUrl ?? "");
    }, [tokenImageUrl]);

    const handleTokenImageSubmit = () => {
      if (!isMe || !onTokenImageSubmit) return;
      onTokenImageSubmit(tokenImageInput.trim());
    };

    const handleSavePlayerState = () => {
      if (!isMe) return;
      const imageRef = tokenImageInput.trim() || tokenImageUrl || undefined;
      savePlayerState(player, imageRef);
    };

    const handleLoadPlayerState = async (event: ChangeEvent<HTMLInputElement>) => {
      if (!isMe || !onApplyPlayerState) return;
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const state = await loadPlayerState(file);
        onApplyPlayerState(state, tokenId);
        setTokenImageInput(state.tokenImage ?? "");
      } catch (err) {
        window.alert(
          err instanceof Error
            ? `Failed to load player state: ${err.message}`
            : "Failed to load player state.",
        );
      } finally {
        event.target.value = "";
      }
    };

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
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <NameEditor
            isEditing={editing}
            isMe={isMe}
            playerName={player.name}
            playerUid={player.uid}
            nameInput={nameInput}
            tokenColor={tokenColor}
            onNameInputChange={onNameInputChange}
            onNameEdit={onNameEdit}
            onNameSubmit={onNameSubmit}
          />
          {player.isDM && (
            <span
              className="jrpg-text-small"
              style={{
                alignSelf: "center",
                color: "var(--jrpg-gold)",
                textShadow: "0 0 4px rgba(255, 215, 0, 0.6)",
                letterSpacing: "1px",
              }}
            >
              DM
            </span>
          )}
        </div>

        <PortraitSection portrait={player.portrait} micLevel={player.micLevel} />

        <HPBar
          hp={player.hp ?? 100}
          maxHp={player.maxHp ?? 100}
          isMe={isMe}
          isEditingMaxHp={editingMaxHp}
          maxHpInput={maxHpInput}
          playerUid={player.uid}
          onHpChange={onHpChange}
          onMaxHpInputChange={onMaxHpInputChange}
          onMaxHpEdit={onMaxHpEdit}
          onMaxHpSubmit={onMaxHpSubmit}
        />

        <CardControls
          isMe={isMe}
          micEnabled={micEnabled}
          onPortraitLoad={onPortraitLoad}
          onToggleMic={onToggleMic}
        />

        {isMe && onTokenImageSubmit && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              textAlign: "center",
            }}
          >
            <label
              className="jrpg-text-small"
              style={{ color: "var(--jrpg-gold)", fontSize: "0.65rem" }}
            >
              Token Image URL
            </label>
            <input
              type="text"
              value={tokenImageInput}
              placeholder="https://example.com/token.png"
              onChange={(e) => setTokenImageInput(e.target.value)}
              onBlur={handleTokenImageSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTokenImageSubmit();
                }
              }}
              style={{
                width: "100%",
                background: "#111",
                color: "var(--jrpg-white)",
                border: "1px solid var(--jrpg-border-gold)",
                padding: "4px",
                fontSize: "0.65rem",
              }}
            />
            {tokenImageUrl && (
              <img
                src={tokenImageUrl}
                alt={`${player.name} token preview`}
                style={{
                  width: "48px",
                  height: "48px",
                  objectFit: "cover",
                  alignSelf: "center",
                  borderRadius: "6px",
                  border: "1px solid var(--jrpg-border-gold)",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.6rem", padding: "4px 6px" }}
              onClick={() => {
                setTokenImageInput("");
                onTokenImageSubmit?.("");
              }}
            >
              Clear Token Image
            </button>
          </div>
        )}

        {isMe && onApplyPlayerState && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              textAlign: "center",
            }}
          >
            <label
              className="jrpg-text-small"
              style={{ color: "var(--jrpg-gold)", fontSize: "0.65rem" }}
            >
              Player State
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.6rem", padding: "4px 6px" }}
                onClick={handleSavePlayerState}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.6rem", padding: "4px 6px" }}
                onClick={() => playerStateInputRef.current?.click()}
              >
                Load
              </button>
            </div>
            <input
              ref={playerStateInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={handleLoadPlayerState}
            />
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if relevant props change
    return (
      prevProps.player.name === nextProps.player.name &&
      prevProps.player.portrait === nextProps.player.portrait &&
      prevProps.player.micLevel === nextProps.player.micLevel &&
      prevProps.player.hp === nextProps.player.hp &&
      prevProps.player.maxHp === nextProps.player.maxHp &&
      (prevProps.player.isDM ?? false) === (nextProps.player.isDM ?? false) &&
      prevProps.tokenImageUrl === nextProps.tokenImageUrl &&
      prevProps.tokenId === nextProps.tokenId &&
      prevProps.onApplyPlayerState === nextProps.onApplyPlayerState &&
      prevProps.tokenColor === nextProps.tokenColor &&
      prevProps.micEnabled === nextProps.micEnabled &&
      prevProps.editingPlayerUID === nextProps.editingPlayerUID &&
      prevProps.nameInput === nextProps.nameInput &&
      prevProps.editingMaxHpUID === nextProps.editingMaxHpUID &&
      prevProps.maxHpInput === nextProps.maxHpInput
    );
  },
);

PlayerCard.displayName = "PlayerCard";
