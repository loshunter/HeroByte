// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo } from "react";
import type { Player } from "@shared";
import { NameEditor } from "./NameEditor";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { CardControls } from "./CardControls";

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
