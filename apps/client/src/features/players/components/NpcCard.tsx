// ============================================================================
// NPC CARD COMPONENT
// ============================================================================
// Displays an NPC in the entities panel with DM controls. Styled to mirror the
// player card while using a red accent to indicate an enemy.

import { useCallback, useEffect, useState } from "react";
import type { Character, TokenSize } from "@shared";
import { PortraitSection } from "./PortraitSection";
import { HPBar } from "./HPBar";
import { NpcSettingsMenu } from "./NpcSettingsMenu";
import { sanitizeText } from "../../../utils/sanitize";

interface NpcCardProps {
  character: Character;
  isDM: boolean;
  onUpdate: (
    id: string,
    updates: { name?: string; hp?: number; maxHp?: number; portrait?: string; tokenImage?: string },
  ) => void;
  onDelete: (id: string) => void;
  onPlaceToken: (id: string) => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
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
}: NpcCardProps): JSX.Element {
  const [editingMaxHp, setEditingMaxHp] = useState(false);
  const [maxHpInput, setMaxHpInput] = useState(String(character.maxHp));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenImageInput, setTokenImageInput] = useState(character.tokenImage ?? "");
  const [statusIcon, setStatusIcon] = useState<{ emoji: string; label: string } | null>(null);

  useEffect(() => {
    setTokenImageInput(character.tokenImage ?? "");
  }, [character.tokenImage]);

  const handleHpChange = useCallback(
    (nextHp: number) => {
      onUpdate(character.id, { hp: nextHp });
    },
    [character.id, onUpdate],
  );

  const handleMaxHpSubmit = useCallback(
    (value: string) => {
      if (!isDM) return;
      const numeric = Number.parseInt(value, 10);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setEditingMaxHp(false);
        return;
      }
      const nextMax = numeric;
      const nextHp = Math.min(character.hp, nextMax);
      onUpdate(character.id, { maxHp: nextMax, hp: nextHp });
      setEditingMaxHp(false);
    },
    [isDM, character.id, character.hp, onUpdate],
  );

  const handlePortraitChange = useCallback(() => {
    if (!isDM) return;
    const url = prompt("Enter portrait URL", character.portrait ?? "");
    if (!url) return;
    onUpdate(character.id, { portrait: url.trim() });
  }, [isDM, character.id, character.portrait, onUpdate]);

  const handleTokenImageApply = useCallback(
    (value: string) => {
      if (!isDM) return;
      const trimmed = value.trim();
      onUpdate(character.id, { tokenImage: trimmed.length > 0 ? trimmed : undefined });
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
      className="player-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#fbe1e1",
        fontSize: "0.8rem",
        gap: "6px",
        position: "relative",
        width: "150px",
        padding: "8px",
        background: "rgba(40, 9, 15, 0.9)",
        border: "1px solid var(--jrpg-border-gold)",
        boxShadow: "0 0 12px rgba(214, 60, 83, 0.45)",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          width: "100%",
          textAlign: "center",
          borderBottom: "1px solid rgba(255, 190, 190, 0.25)",
          marginBottom: "4px",
          fontSize: "0.7rem",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: canEdit ? "pointer" : "default",
          }}
          title={canEdit ? "Double-click to rename" : undefined}
          onDoubleClick={() => {
            if (!canEdit) return;
            const newName = prompt("Rename NPC", character.name);
            if (!newName || newName.trim() === character.name) return;
            onUpdate(character.id, { name: newName.trim() });
          }}
        >
          {sanitizeText(character.name)}
        </div>
        <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Enemy
        </span>
      </div>

      <div style={{ width: "110px" }}>
        <PortraitSection
          portrait={character.portrait ?? undefined}
          isEditable={canEdit}
          onRequestChange={handlePortraitChange}
          statusIcon={statusIcon}
          tokenColor="#D63C53"
        />
      </div>

      <HPBar
        hp={character.hp}
        maxHp={character.maxHp}
        isMe={canEdit}
        isEditingMaxHp={editingMaxHp}
        maxHpInput={maxHpInput}
        playerUid={character.id}
        onHpChange={handleHpChange}
        onHpSet={handleHpChange}
        onMaxHpInputChange={setMaxHpInput}
        onMaxHpEdit={() => {
          if (!canEdit) return;
          setEditingMaxHp(true);
          setMaxHpInput(String(character.maxHp));
        }}
        onMaxHpSubmit={handleMaxHpSubmit}
      />

      <div style={{ display: "flex", gap: "6px" }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: "0.7rem", padding: "4px 8px" }}
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
        onPlaceToken={() => onPlaceToken(character.id)}
        onDelete={() => onDelete(character.id)}
        statusIcon={statusIcon}
        onStatusChange={setStatusIcon}
        tokenLocked={tokenLocked}
        onToggleTokenLock={onToggleTokenLock}
        tokenSize={tokenSize}
        onTokenSizeChange={onTokenSizeChange}
      />
    </div>
  );
}
