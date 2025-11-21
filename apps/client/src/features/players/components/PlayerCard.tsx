// ============================================================================
// PLAYER CARD COMPONENT
// ============================================================================
// Displays a single player's portrait, name, HP bar, and controls
// Memoized to prevent unnecessary re-renders

import { memo, useEffect, useState } from "react";
import type { Drawing, Player, PlayerState, SceneObject, Token, TokenSize } from "@shared";
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
  token?: Token | null;
  tokenSceneObject?: (SceneObject & { type: "token" }) | null;
  playerDrawings?: Drawing[];
  statusEffects?: string[];
  micEnabled: boolean;
  editingPlayerUID: string | null;
  nameInput: string;
  onNameInputChange: (name: string) => void;
  onNameEdit: () => void;
  onNameSubmit: () => void;
  onPortraitLoad: (characterId?: string) => void;
  onToggleMic: () => void;
  onHpChange: (hp: number) => void;
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (hp: string) => void;
  onHpEdit: (uid: string, hp: number) => void;
  onHpSubmit: (hp: string) => void;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (maxHp: string) => void;
  onMaxHpEdit: (uid: string, maxHp: number) => void;
  onMaxHpSubmit: (maxHp: string) => void;
  editingTempHpUID?: string | null;
  tempHpInput?: string;
  onTempHpInputChange?: (tempHp: string) => void;
  onTempHpEdit?: (uid: string) => void;
  onTempHpSubmit?: (tempHp: string) => void;
  tokenImageUrl?: string;
  onTokenImageSubmit?: (url: string) => void;
  tokenId?: string;
  onApplyPlayerState?: (state: PlayerState, tokenId?: string, characterId?: string) => void;
  onDeleteToken?: (tokenId: string) => void;
  onStatusEffectsChange?: (effects: string[]) => void;
  isDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  onAddCharacter?: (name: string) => boolean;
  isCreatingCharacter?: boolean;
  characterId?: string;
  onDeleteCharacter?: (characterId: string) => void;
  onFocusToken?: () => void;
  initiative?: number;
  onInitiativeClick?: () => void;
  initiativeModifier?: number;
  isCurrentTurn?: boolean;
  onClearInitiative?: () => void;
  canEditStatusEffects?: boolean;
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
    editingHpUID,
    hpInput,
    onHpInputChange,
    onHpEdit,
    onHpSubmit,
    editingMaxHpUID,
    maxHpInput,
    onMaxHpInputChange,
    onMaxHpEdit,
    onMaxHpSubmit,
    editingTempHpUID,
    tempHpInput,
    onTempHpInputChange,
    onTempHpEdit,
    onTempHpSubmit,
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
    onAddCharacter,
    isCreatingCharacter,
    characterId,
    onDeleteCharacter,
    onFocusToken,
    initiative,
    onInitiativeClick,
    initiativeModifier,
    isCurrentTurn = false,
    onClearInitiative,
    canEditStatusEffects = isMe,
  }) => {
    const editing = editingPlayerUID === player.uid;
    const editingHp = editingHpUID === (characterId ?? player.uid);
    const editingMaxHp = editingMaxHpUID === (characterId ?? player.uid);
    const editingTempHp = editingTempHpUID === (characterId ?? player.uid);
    const [tokenImageInput, setTokenImageInput] = useState(tokenImageUrl ?? "");
    const [settingsOpen, setSettingsOpen] = useState(false);

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
        initiativeModifier,
      });
    };

    const handleLoadPlayerState = async (file: File) => {
      if (!isMe || !onApplyPlayerState) return;
      const state = await loadPlayerState(file);
      onApplyPlayerState(state, tokenId, characterId);
      const nextImage = state.token?.imageUrl ?? state.tokenImage ?? "";
      setTokenImageInput(nextImage ?? "");
    };

    const handleStatusEffectsChange = (effects: string[]) => {
      if (!canEditStatusEffects || !onStatusEffectsChange) {
        return;
      }
      onStatusEffectsChange(effects);
    };

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
        {isCurrentTurn && (
          <div
            className="jrpg-text-small"
            style={{
              color: "#FFE8A3",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {isMe ? "🎯 YOUR TURN" : "⚔️ CURRENT TURN"}
          </div>
        )}
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
          onRequestChange={() => onPortraitLoad(characterId)}
          statusEffects={statusEffects ?? []}
          tokenColor={tokenColor}
          onFocusToken={onFocusToken}
          initiative={initiative}
          onInitiativeClick={onInitiativeClick}
          isCurrentTurn={isCurrentTurn}
        />

        <HPBar
          hp={player.hp ?? 100}
          maxHp={player.maxHp ?? 100}
          tempHp={player.tempHp}
          isMe={isMe}
          isEditingHp={editingHp}
          hpInput={hpInput}
          isEditingMaxHp={editingMaxHp}
          maxHpInput={maxHpInput}
          isEditingTempHp={editingTempHp}
          tempHpInput={tempHpInput}
          playerUid={characterId ?? player.uid}
          onHpChange={onHpChange}
          onHpInputChange={onHpInputChange}
          onHpEdit={onHpEdit}
          onHpSubmit={onHpSubmit}
          onMaxHpInputChange={onMaxHpInputChange}
          onMaxHpEdit={onMaxHpEdit}
          onMaxHpSubmit={onMaxHpSubmit}
          onTempHpInputChange={onTempHpInputChange}
          onTempHpEdit={onTempHpEdit ? () => onTempHpEdit(characterId ?? player.uid) : undefined}
          onTempHpSubmit={onTempHpSubmit}
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
          selectedEffects={statusEffects ?? []}
          onStatusEffectsChange={handleStatusEffectsChange}
          isDM={isDM}
          onToggleDMMode={onToggleDMMode}
          tokenLocked={tokenLocked}
          onToggleTokenLock={onToggleTokenLock}
          tokenSize={tokenSize}
          onTokenSizeChange={onTokenSizeChange}
          onAddCharacter={onAddCharacter}
          isCreatingCharacter={isCreatingCharacter}
          characterId={characterId}
          onDeleteCharacter={onDeleteCharacter}
          initiative={initiative}
          onClearInitiative={onClearInitiative}
        />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.portrait === nextProps.player.portrait &&
    prevProps.player.micLevel === nextProps.player.micLevel &&
    prevProps.player.hp === nextProps.player.hp &&
    prevProps.player.maxHp === nextProps.player.maxHp &&
    prevProps.player.tempHp === nextProps.player.tempHp &&
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
    prevProps.editingTempHpUID === nextProps.editingTempHpUID &&
    prevProps.tempHpInput === nextProps.tempHpInput &&
    prevProps.isDM === nextProps.isDM &&
    prevProps.initiative === nextProps.initiative &&
    prevProps.initiativeModifier === nextProps.initiativeModifier &&
    prevProps.isCurrentTurn === nextProps.isCurrentTurn,
);

PlayerCard.displayName = "PlayerCard";
