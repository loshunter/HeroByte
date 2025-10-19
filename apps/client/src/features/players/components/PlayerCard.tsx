// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo, useEffect, useMemo, useState } from "react";
import type { Drawing, Player, PlayerState, SceneObject, Token, TokenSize } from "@shared";
import { NameEditor } from "./NameEditor";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { CardControls } from "./CardControls";
import { PlayerSettingsMenu, STATUS_OPTIONS, type StatusOption } from "./PlayerSettingsMenu";
import { loadPlayerState, savePlayerState } from "../../../utils/playerPersistence";

export interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  tokenColor?: string;
  token?: Token | null;
  tokenSceneObject?: (SceneObject & { type: "token" }) | null;
  playerDrawings?: Drawing[];
  statusEffects?: string[];
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
  onDeleteToken?: (tokenId: string) => void;
  onStatusEffectsChange?: (effects: string[]) => void;
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
}

export const PlayerCard = memo<PlayerCardProps>(
  ({
    player,
    isMe,
    tokenColor,
    token,
    tokenSceneObject,
    playerDrawings,
    statusEffects,
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
    onDeleteToken,
    isDM,
    onToggleDMMode,
    tokenLocked,
    onToggleTokenLock,
    tokenSize,
    onTokenSizeChange,
    onStatusEffectsChange,
  }) => {
    const editing = editingPlayerUID === player.uid;
    const editingMaxHp = editingMaxHpUID === player.uid;
    const [tokenImageInput, setTokenImageInput] = useState(tokenImageUrl ?? "");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [statusOption, setStatusOption] = useState<StatusOption | null>(null);

    useEffect(() => {
      setTokenImageInput(tokenImageUrl ?? "");
    }, [tokenImageUrl]);

    useEffect(() => {
      if (!statusEffects || statusEffects.length === 0) {
        setStatusOption(null);
        return;
      }

      const active = statusEffects[0] ?? "";
      if (!active) {
        setStatusOption(null);
        return;
      }

      const match =
        STATUS_OPTIONS.find((option) => option.value === active) ??
        ({
          value: active,
          emoji: "",
          label: active.charAt(0).toUpperCase() + active.slice(1),
        } satisfies StatusOption);
      setStatusOption(match);
    }, [statusEffects]);

    const handleTokenImageApply = (value: string) => {
      if (!isMe || !onTokenImageSubmit) return;
      onTokenImageSubmit(value);
    };

    const handleSavePlayerState = () => {
      if (!isMe) return;
      const imageRef = tokenImageInput.trim() || tokenImageUrl || undefined;
      const tokenForExport: Token | undefined = token
        ? {
            ...token,
            imageUrl: imageRef ?? token.imageUrl ?? undefined,
          }
        : undefined;
      savePlayerState({
        player,
        token: tokenForExport,
        tokenScene: tokenSceneObject ?? null,
        drawings: playerDrawings ?? [],
      });
    };

    const handleLoadPlayerState = async (file: File) => {
      if (!isMe || !onApplyPlayerState) return;
      const state = await loadPlayerState(file);
      onApplyPlayerState(state, tokenId);
      const nextImage = state.token?.imageUrl ?? state.tokenImage ?? "";
      setTokenImageInput(nextImage ?? "");
    };

    const handleStatusChange = (option: StatusOption | null) => {
      setStatusOption(option);
      if (!isMe || !onStatusEffectsChange) {
        return;
      }
      const payload = option && option.value ? [option.value] : [];
      onStatusEffectsChange(payload);
    };

    const portraitStatus = useMemo(
      () => (statusOption ? { emoji: statusOption.emoji, label: statusOption.label } : null),
      [statusOption],
    );

    // Apply DM-specific styling when player.isDM is true
    const isDMPlayer = player.isDM ?? false;
    const cardStyle = isDMPlayer
      ? {
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center" as const,
          justifyContent: "space-between" as const,
          color: "#ffe8b3",
          fontSize: "0.8rem",
          gap: "6px",
          position: "relative" as const,
          background: "rgba(60, 48, 10, 0.9)",
          border: "2px solid var(--jrpg-gold)",
          boxShadow: "0 0 16px rgba(255, 215, 0, 0.6)",
          borderRadius: "8px",
          padding: "8px",
        }
      : {
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center" as const,
          justifyContent: "space-between" as const,
          color: "#dbe1ff",
          fontSize: "0.8rem",
          gap: "6px",
          position: "relative" as const,
        };

    return (
      <div className="player-card" style={cardStyle}>
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
          statusIcon={portraitStatus}
          tokenColor={tokenColor}
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
          onClose={() => setSettingsOpen(false)}
          tokenImageInput={tokenImageInput}
          tokenImageUrl={tokenImageUrl}
          onTokenImageInputChange={setTokenImageInput}
          onTokenImageApply={(value) => handleTokenImageApply(value)}
          onTokenImageClear={() => {
            setTokenImageInput("");
            handleTokenImageApply("");
          }}
          onDeleteToken={tokenId && onDeleteToken ? () => onDeleteToken(tokenId) : undefined}
          onSavePlayerState={handleSavePlayerState}
          onLoadPlayerState={handleLoadPlayerState}
          statusIcon={statusOption}
          onStatusChange={handleStatusChange}
          isDM={isDM}
          onToggleDMMode={onToggleDMMode}
          tokenLocked={tokenLocked}
          onToggleTokenLock={onToggleTokenLock}
          tokenSize={tokenSize}
          onTokenSizeChange={onTokenSizeChange}
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
      prevProps.token === nextProps.token &&
      prevProps.tokenSceneObject === nextProps.tokenSceneObject &&
      prevProps.playerDrawings === nextProps.playerDrawings &&
      prevProps.statusEffects === nextProps.statusEffects &&
      prevProps.onStatusEffectsChange === nextProps.onStatusEffectsChange &&
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
