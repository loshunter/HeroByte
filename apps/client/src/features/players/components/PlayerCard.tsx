// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo, useEffect, useState } from "react";
import type { PlayerState, Player } from "@shared";
import { NameEditor } from "./NameEditor";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { CardControls } from "./CardControls";
import { PlayerSettingsMenu } from "./PlayerSettingsMenu";
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
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
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
    isDM,
    onToggleDMMode,
  }) => {
    const editing = editingPlayerUID === player.uid;
    const editingMaxHp = editingMaxHpUID === player.uid;
    const [tokenImageInput, setTokenImageInput] = useState(tokenImageUrl ?? "");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [statusIcon, setStatusIcon] = useState<{ emoji: string; label: string } | null>(null);

    useEffect(() => {
      setTokenImageInput(tokenImageUrl ?? "");
    }, [tokenImageUrl]);

    const handleTokenImageApply = (value: string) => {
      if (!isMe || !onTokenImageSubmit) return;
      onTokenImageSubmit(value);
    };

    const handleSavePlayerState = () => {
      if (!isMe) return;
      const imageRef = tokenImageInput.trim() || tokenImageUrl || undefined;
      savePlayerState(player, imageRef);
    };

    const handleLoadPlayerState = async (file: File) => {
      if (!isMe || !onApplyPlayerState) return;
      const state = await loadPlayerState(file);
      onApplyPlayerState(state, tokenId);
      setTokenImageInput(state.tokenImage ?? "");
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
          position: "relative",
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
          <span
            className="jrpg-text-small"
            style={{
              alignSelf: "center",
              color: player.isDM ? "var(--jrpg-gold)" : "var(--jrpg-white)",
              letterSpacing: "1px",
            }}
          >
            {isMe ? "You" : player.isDM ? "Dungeon Master" : "Adventurer"}
          </span>
        </div>

        <PortraitSection
          portrait={player.portrait}
          micLevel={player.micLevel}
          isEditable={isMe}
          onRequestChange={onPortraitLoad}
          statusIcon={statusIcon}
        />

        <HPBar
          hp={player.hp ?? 100}
          maxHp={player.maxHp ?? 100}
          isMe={isMe}
          isEditingMaxHp={editingMaxHp}
          maxHpInput={maxHpInput}
          playerUid={player.uid}
          onHpChange={onHpChange}
          onHpSet={onHpChange}
          onMaxHpInputChange={onMaxHpInputChange}
          onMaxHpEdit={onMaxHpEdit}
          onMaxHpSubmit={onMaxHpSubmit}
        />

        <CardControls
          isMe={isMe}
          micEnabled={micEnabled}
          onToggleMic={onToggleMic}
          onOpenSettings={() => setSettingsOpen((value) => !value)}
        />

        <PlayerSettingsMenu
          isOpen={isMe && settingsOpen}
          tokenImageInput={tokenImageInput}
          tokenImageUrl={tokenImageUrl}
          onTokenImageInputChange={setTokenImageInput}
          onTokenImageApply={(value) => handleTokenImageApply(value)}
          onTokenImageClear={() => {
            setTokenImageInput("");
            handleTokenImageApply("");
          }}
          onSavePlayerState={handleSavePlayerState}
          onLoadPlayerState={handleLoadPlayerState}
          statusIcon={statusIcon}
          onStatusChange={setStatusIcon}
          isDM={isDM}
          onToggleDMMode={onToggleDMMode}
        />
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
      prevProps.maxHpInput === nextProps.maxHpInput &&
      prevProps.isDM === nextProps.isDM
    );
  },
);

PlayerCard.displayName = "PlayerCard";
