// ============================================================================
// NPC CARD COMPONENT
// ============================================================================
// Displays an NPC in the entities panel with DM controls. Styled to mirror the
// player card while using a red accent to indicate an enemy.

import { useCallback, useEffect, useState } from "react";
import type { TokenSize, SnapshotCharacter } from "@herobyte/shared";
import { normalizeHPValues, parseHPInput, parseMaxHPInput } from "@herobyte/shared";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { RedactedHpBadge } from "./RedactedHpBadge";
import { NpcNameEditor } from "./NpcNameEditor";
import { NpcSettingsMenu } from "./NpcSettingsMenu";
import { useHpFeedback, FloatingDamageNumber } from "../../juice";

interface NpcCardProps {
  character: SnapshotCharacter;
  isDM: boolean;
  onUpdate?: (
    id: string,
    updates: {
      name?: string;
      hp?: number;
      maxHp?: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
    },
  ) => void;
  onDelete?: (id: string) => void;
  onPlaceToken?: (id: string) => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  onFocusToken?: () => void;
  initiative?: number;
  onInitiativeClick?: () => void;
  initiativeModifier?: number;
  /** Whether NPC deletion is in progress */
  isDeleting?: boolean;
  /** Error message from deletion attempt */
  deletionError?: string | null;
  /** Toggle NPC visibility to players */
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onClearInitiative?: () => void;
  isCurrentTurn?: boolean;
}

export function NpcCard({
  character,
  isDM,
  onUpdate,
  onDelete,
  onPlaceToken,
  tokenLocked,
  onToggleTokenLock,
  tokenSize,
  onTokenSizeChange,
  onFocusToken,
  initiative,
  onInitiativeClick,
  initiativeModifier: _initiativeModifier,
  isDeleting = false,
  deletionError = null,
  onToggleVisibility,
  onClearInitiative,
  isCurrentTurn = false,
}: NpcCardProps): JSX.Element {
  const [editingHp, setEditingHp] = useState(false);
  const [hpInput, setHpInput] = useState(String(character.hp));
  const [editingMaxHp, setEditingMaxHp] = useState(false);
  const [maxHpInput, setMaxHpInput] = useState(String(character.maxHp));
  const [editingTempHp, setEditingTempHp] = useState(false);
  const [tempHpInput, setTempHpInput] = useState(String(character.tempHp ?? 0));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenImageInput, setTokenImageInput] = useState(character.tokenImage ?? "");
  const [portraitInput, setPortraitInput] = useState(character.portrait ?? "");
  const { feedback, flashClass } = useHpFeedback(character.hp);

  useEffect(() => {
    setTokenImageInput(character.tokenImage ?? "");
  }, [character.tokenImage]);

  const handleHpChange = useCallback(
    (nextHp: number) => {
      onUpdate?.(character.id, { hp: nextHp });
    },
    [character.id, onUpdate],
  );

  const handleHpSubmit = useCallback(
    (value: string) => {
      if (!isDM) return;
      // DM cards always carry exact numbers (redaction is player-only).
      const parsedHp = parseHPInput(value, 0);
      const parsedMaxHp = character.maxHp ?? 1;

      // Use new QoL validation: if HP > Max HP, auto-adjust Max HP
      const normalized = normalizeHPValues(parsedHp, parsedMaxHp);

      onUpdate?.(character.id, { hp: normalized.hp, maxHp: normalized.maxHp });
      setEditingHp(false);
    },
    [isDM, character.id, character.maxHp, onUpdate],
  );

  const handleMaxHpSubmit = useCallback(
    (value: string) => {
      if (!isDM) return;
      const parsedMaxHp = parseMaxHPInput(value, 1);
      const parsedHp = character.hp ?? 0;

      // Use new QoL validation: if HP > Max HP, auto-adjust Max HP
      const normalized = normalizeHPValues(parsedHp, parsedMaxHp);

      onUpdate?.(character.id, { hp: normalized.hp, maxHp: normalized.maxHp });
      setEditingMaxHp(false);
    },
    [isDM, character.id, character.hp, onUpdate],
  );

  const handleTempHpSubmit = useCallback(
    (value: string) => {
      if (!isDM) return;
      const parsedTempHp = parseHPInput(value, 0);
      onUpdate?.(character.id, { tempHp: parsedTempHp > 0 ? parsedTempHp : undefined });
      setEditingTempHp(false);
    },
    [isDM, character.id, onUpdate],
  );

  const handlePortraitApply = useCallback(
    (value: string) => {
      if (!isDM) return;
      // ImageField normalizes (and uploads) before committing, so the value
      // that arrives here is already a URL worth storing.
      onUpdate?.(character.id, { portrait: value.trim() });
    },
    [isDM, character.id, onUpdate],
  );

  const handleTokenImageApply = useCallback(
    (value: string) => {
      if (!isDM) return;
      const trimmed = value.trim();
      onUpdate?.(character.id, { tokenImage: trimmed.length > 0 ? trimmed : undefined });
    },
    [isDM, character.id, onUpdate],
  );

  const handleSettingsToggle = () => {
    if (!isDM) return;
    setSettingsOpen((value) => !value);
  };

  const canEdit = isDM;

  return (
    <div
      className={`player-card player-card--npc${flashClass ? ` ${flashClass}` : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#fbe1e1",
        fontSize: "0.8rem",
        gap: "var(--player-card-gap, 6px)",
        position: "relative",
        padding: "var(--player-card-padding, 8px)",
        background: "rgba(40, 9, 15, 0.9)",
        border: "1px solid var(--jrpg-border-gold)",
        boxShadow: "0 0 12px rgba(214, 60, 83, 0.45)",
        borderRadius: "8px",
      }}
    >
      {feedback && (
        <FloatingDamageNumber
          amount={feedback.amount}
          kind={feedback.kind}
          animationKey={feedback.animationKey}
        />
      )}
      <div
        className="player-card-topbar"
        data-card-resize-anchor="top"
        style={{ borderBottomColor: "rgba(255, 190, 190, 0.25)" }}
      >
        {isCurrentTurn && (
          <div
            className="jrpg-text-small"
            style={{
              color: "#FFE8A3",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            ⚔️ CURRENT TURN
          </div>
        )}
        <NpcNameEditor
          id={character.id}
          name={character.name}
          canEdit={canEdit}
          onRename={(id, name) => onUpdate?.(id, { name })}
        />
        <span className="jrpg-text-small player-card-role" style={{ color: "var(--jrpg-gold)" }}>
          Enemy
        </span>
      </div>

      <div className="player-card-portrait-wrap">
        <PortraitSection
          portrait={character.portrait ?? undefined}
          isEditable={canEdit}
          onRequestChange={handleSettingsToggle}
          statusEffects={character.statusEffects ?? []}
          tokenColor="#D63C53"
          onFocusToken={onFocusToken}
          initiative={initiative}
          onInitiativeClick={onInitiativeClick}
          isCurrentTurn={isCurrentTurn}
        />
      </div>

      {character.hp !== undefined && character.maxHp !== undefined ? (
        <HPBar
          hp={character.hp}
          maxHp={character.maxHp}
          tempHp={character.tempHp}
          isMe={canEdit}
          isEditingHp={editingHp}
          hpInput={hpInput}
          onHpInputChange={setHpInput}
          onHpEdit={(_uid: string) => {
            if (!canEdit) return;
            setEditingHp(true);
            setHpInput(String(character.hp));
          }}
          onHpSubmit={handleHpSubmit}
          isEditingMaxHp={editingMaxHp}
          maxHpInput={maxHpInput}
          playerUid={character.id}
          onHpChange={handleHpChange}
          onMaxHpInputChange={setMaxHpInput}
          onMaxHpEdit={() => {
            if (!canEdit) return;
            setEditingMaxHp(true);
            setMaxHpInput(String(character.maxHp));
          }}
          onMaxHpSubmit={handleMaxHpSubmit}
          isEditingTempHp={editingTempHp}
          tempHpInput={tempHpInput}
          onTempHpInputChange={setTempHpInput}
          onTempHpEdit={() => {
            if (!canEdit) return;
            setEditingTempHp(true);
            setTempHpInput(String(character.tempHp ?? 0));
          }}
          onTempHpSubmit={handleTempHpSubmit}
        />
      ) : (
        // The server redacted this NPC's numbers (monsterHpDisplay).
        <RedactedHpBadge badge={character.hpBadge} />
      )}

      <div className="player-card-controls">
        {onToggleVisibility && canEdit && (
          <button
            className="btn btn-secondary"
            style={{
              fontSize: "var(--player-card-control-font-size, 0.7rem)",
              padding: "var(--player-card-control-padding, 4px 8px)",
              opacity: character.visibleToPlayers === false ? 0.5 : 1,
            }}
            onClick={() => {
              const newVisibility = character.visibleToPlayers === false;
              onToggleVisibility(character.id, newVisibility);
            }}
            title={
              character.visibleToPlayers === false
                ? "Hidden from players (click to show)"
                : "Visible to players (click to hide)"
            }
          >
            {character.visibleToPlayers === false ? "👁️‍🗨️" : "👁️"}
          </button>
        )}
        <button
          className="btn btn-secondary"
          style={{
            fontSize: "var(--player-card-control-font-size, 0.7rem)",
            padding: "var(--player-card-control-padding, 4px 8px)",
          }}
          onClick={handleSettingsToggle}
          disabled={!canEdit}
          title="NPC settings"
        >
          ⚙️
        </button>
      </div>

      <NpcSettingsMenu
        isOpen={canEdit && settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tokenImageInput={tokenImageInput}
        tokenImageUrl={character.tokenImage ?? undefined}
        onTokenImageInputChange={setTokenImageInput}
        onTokenImageApply={handleTokenImageApply}
        onTokenImageClear={() => {
          setTokenImageInput("");
          handleTokenImageApply("");
        }}
        portraitImageInput={portraitInput}
        onPortraitInputChange={setPortraitInput}
        onPortraitApply={handlePortraitApply}
        onPlaceToken={onPlaceToken ? () => onPlaceToken(character.id) : undefined}
        onDelete={onDelete ? () => onDelete(character.id) : undefined}
        tokenLocked={tokenLocked}
        onToggleTokenLock={onToggleTokenLock}
        tokenSize={tokenSize}
        onTokenSizeChange={onTokenSizeChange}
        isDeleting={isDeleting}
        deletionError={deletionError}
        onClearInitiative={onClearInitiative}
        hasInitiative={character.initiative !== undefined}
      />
    </div>
  );
}
