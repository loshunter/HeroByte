// ============================================================================
// MOBILE ENTITIES LIST
// ============================================================================
// Slide-out drawer for viewing players/entities on mobile.

import React from "react";
import type { Player, Character } from "@shared";
import { MobilePlayerRow } from "./MobilePlayerRow";
import { JRPGButton } from "../ui/JRPGPanel";

interface MobileEntitiesListProps {
  players: Player[];
  characters: Character[];
  uid: string;
  isDM: boolean;
  onClose: () => void;

  // Edit props passed through to row
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
  onCharacterStatusEffectsChange: (characterId: string, effects: string[]) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
}

export const MobileEntitiesList: React.FC<MobileEntitiesListProps> = ({
  players,
  characters,
  uid,
  isDM,
  onClose,
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
  onCharacterHpChange,
  onCharacterStatusEffectsChange,
  onCharacterNameUpdate,
  onCharacterPortraitUpdate,
}) => {
  // Merge player and character data
  const entities = players.map((player) => {
    // Find associated character if any
    const character = characters.find((c) => c.ownedByPlayerUID === player.uid);
    // If character exists, use its stats, otherwise fall back to player stats (legacy)
    return {
      ...player,
      name: character?.name ?? player.name,
      hp: character?.hp ?? player.hp ?? 100,
      maxHp: character?.maxHp ?? player.maxHp ?? 100,
      tempHp: character?.tempHp ?? player.tempHp,
      portrait: character?.portrait ?? player.portrait,
      statusEffects: character?.statusEffects ?? player.statusEffects,
      characterId: character?.id ?? player.uid, // Use character ID for updates if available
    };
  });

  // Sort: Me first, then DM, then others alphabetically
  entities.sort((a, b) => {
    if (a.uid === uid) return -1;
    if (b.uid === uid) return 1;
    if (a.isDM) return -1;
    if (b.isDM) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "85vw",
        maxWidth: "360px",
        backgroundColor: "#0c1228",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.5)",
        zIndex: 1900,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--hero-gold)",
        transform: "translateX(0)",
        transition: "transform 0.3s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ color: "var(--hero-gold)", margin: 0, fontSize: "1.2rem" }}>Party Members</h2>
        <JRPGButton onClick={onClose} variant="default" style={{ padding: "4px 12px" }}>
          ✕
        </JRPGButton>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {entities.map((entity) => (
          <MobilePlayerRow
            key={entity.uid}
            player={entity}
            isMe={entity.uid === uid}
            isDM={isDM}
            editingHpUID={editingHpUID}
            hpInput={hpInput}
            onHpInputChange={onHpInputChange}
            onHpEdit={onHpEdit}
            onHpSubmit={(_hpStr) => {
              // HPBar passes the string value, but onHpSubmit expects void in EntitiesPanel
              // Here we just trigger the submit logic
              onHpSubmit();
            }}
            editingMaxHpUID={editingMaxHpUID}
            maxHpInput={maxHpInput}
            onMaxHpInputChange={onMaxHpInputChange}
            onMaxHpEdit={onMaxHpEdit}
            onMaxHpSubmit={(_maxHpStr) => {
              // HPBar passes the string value, but onMaxHpSubmit expects void here
              onMaxHpSubmit();
            }}
            onCharacterHpChange={(hp) =>
              onCharacterHpChange(entity.characterId, hp, entity.maxHp ?? 100, entity.tempHp)
            }
            onStatusEffectsChange={(effects) =>
              onCharacterStatusEffectsChange(entity.characterId, effects)
            }
            onCharacterNameUpdate={onCharacterNameUpdate}
            onCharacterPortraitUpdate={onCharacterPortraitUpdate}
          />
        ))}
      </div>
    </div>
  );
};
