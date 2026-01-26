// ============================================================================
// MOBILE PLAYER ROW
// ============================================================================
// Compact player/character row for mobile list view.

import React, { memo, useState } from "react";
import type { Player } from "@shared";
import { HPBar } from "../../features/players/components/HPBar";
import { STATUS_OPTIONS } from "../../features/players/constants/statusOptions";
import { JRPGButton } from "../ui/JRPGPanel";
import { PlayerSettingsMenu } from "../../features/players/components/PlayerSettingsMenu";

interface MobilePlayerRowProps {
  player: Player & { characterId: string };
  isMe: boolean;
  isDM: boolean;
  // HP Editing
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: (hp: string) => void;
  // Max HP Editing
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: (maxHp: string) => void;
  // State handlers
  onStatusEffectsChange?: (effects: string[]) => void;
  onCharacterHpChange: (hp: number) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
}

export const MobilePlayerRow = memo<MobilePlayerRowProps>(
  ({
    player,
    isMe,
    isDM,
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
    onStatusEffectsChange,
    onCharacterHpChange,
    onCharacterNameUpdate,
    onCharacterPortraitUpdate,
  }) => {
    const isEditingHp = editingHpUID === player.uid;
    const isEditingMaxHp = editingMaxHpUID === player.uid;
    const [isEditingEffects, setIsEditingEffects] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [localNameInput, setLocalNameInput] = useState(player.name);
    const [portraitImageInput, setPortraitImageInput] = useState(player.portrait ?? "");

    const activeEffects = player.statusEffects || [];

    const handleToggleEffect = (value: string) => {
      if (!onStatusEffectsChange) return;
      const current = activeEffects;
      const next = current.includes(value)
        ? current.filter((e) => e !== value)
        : [...current, value];
      onStatusEffectsChange(next);
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          background: "rgba(20, 24, 35, 0.9)",
          border: `1px solid ${isMe ? "var(--hero-gold)" : "rgba(255, 255, 255, 0.1)"}`,
          borderRadius: "8px",
        }}
      >
        {/* Header: Portrait + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid var(--hero-gold)",
              flexShrink: 0,
            }}
          >
            {player.portrait ? (
              <img
                src={player.portrait}
                alt={player.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#aaa",
                  fontSize: "20px",
                }}
              >
                ?
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "var(--hero-white)",
                fontWeight: "bold",
                fontSize: "1.1rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {player.name}
            </div>
            <div
              style={{
                color: player.isDM ? "var(--hero-gold)" : "rgba(255, 255, 255, 0.6)",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {player.isDM ? "Dungeon Master" : "Adventurer"}
            </div>
          </div>
          {isMe && (
            <JRPGButton
              onClick={() => setSettingsOpen(true)}
              variant="primary"
              style={{ padding: "4px 8px", fontSize: "10px" }}
            >
              ⚙️ EDIT
            </JRPGButton>
          )}
        </div>

        {/* HP Bar */}
        <div style={{ padding: "0 4px" }}>
          <HPBar
            hp={player.hp ?? 100}
            maxHp={player.maxHp ?? 100}
            tempHp={player.tempHp}
            isMe={isMe}
            isEditingHp={isEditingHp}
            hpInput={hpInput}
            isEditingMaxHp={isEditingMaxHp}
            maxHpInput={maxHpInput}
            playerUid={player.uid}
            onHpChange={onCharacterHpChange}
            onHpInputChange={onHpInputChange}
            onHpEdit={onHpEdit}
            onHpSubmit={onHpSubmit}
            onMaxHpInputChange={onMaxHpInputChange}
            onMaxHpEdit={onMaxHpEdit}
            onMaxHpSubmit={onMaxHpSubmit}
            onTempHpInputChange={() => {}} // Simplify mobile view
          />
        </div>

        {/* Status Effects Display */}
        {activeEffects.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "0 4px" }}>
            {activeEffects.map((effectVal) => {
              const opt = STATUS_OPTIONS.find((o) => o.value === effectVal);
              return (
                <div
                  key={effectVal}
                  style={{
                    fontSize: "12px",
                    background: "rgba(0,0,0,0.5)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#ddd",
                  }}
                >
                  {opt ? `${opt.emoji} ${opt.label}` : effectVal}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Effects Button (Only for owner/DM) */}
        {(isMe || isDM) && onStatusEffectsChange && (
          <div style={{ padding: "0 4px" }}>
            <JRPGButton
              onClick={() => setIsEditingEffects(!isEditingEffects)}
              variant="default"
              style={{ width: "100%", fontSize: "12px", padding: "6px" }}
            >
              {isEditingEffects ? "Done Editing" : "⚡ Manage Status"}
            </JRPGButton>

            {/* Effects Selection Grid */}
            {isEditingEffects && (
              <div
                style={{
                  marginTop: "8px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  background: "rgba(0,0,0,0.3)",
                  padding: "8px",
                  borderRadius: "4px",
                }}
              >
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = activeEffects.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleToggleEffect(opt.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: isActive ? "rgba(255, 215, 0, 0.2)" : "transparent",
                        border: isActive
                          ? "1px solid var(--hero-gold)"
                          : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "4px",
                        padding: "6px",
                        color: isActive ? "var(--hero-gold)" : "#aaa",
                        cursor: "pointer",
                        fontSize: "12px",
                        textAlign: "left",
                      }}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mobile Settings Menu Overlay */}
        <PlayerSettingsMenu
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          nameInput={localNameInput}
          onNameInputChange={setLocalNameInput}
          onNameSubmit={() => {
            if (localNameInput.trim()) {
              onCharacterNameUpdate(player.characterId, localNameInput.trim());
            }
          }}
          portraitImageInput={portraitImageInput}
          onPortraitInputChange={setPortraitImageInput}
          onPortraitApply={(url) => {
            onCharacterPortraitUpdate(player.characterId, url);
          }}
          tokenImageInput="" // Add placeholders for required props if necessary
          onTokenImageInputChange={() => {}}
          onTokenImageApply={() => {}}
          onTokenImageClear={() => {}}
          onSavePlayerState={() => {}}
          onLoadPlayerState={async () => {}}
          selectedEffects={activeEffects}
          onStatusEffectsChange={onStatusEffectsChange ?? (() => {})}
          isDM={isDM}
          onToggleDMMode={() => {}}
        />
      </div>
    );
  },
);

MobilePlayerRow.displayName = "MobilePlayerRow";
