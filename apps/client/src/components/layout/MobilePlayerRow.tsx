// ============================================================================
// MOBILE PLAYER ROW
// ============================================================================
// Compact player/character row for mobile list view.

import React, { memo, useEffect, useState } from "react";
import { MobileRowConditions } from "./MobileRowConditions";
import { MobileRowActions, type MobileRowInitiative } from "./MobileRowActions";
import type { MovementBudgetControl } from "../../features/players/components/MovementSpeedField";
import type { Player, Token, TokenSize } from "@herobyte/shared";
import { HPBar } from "../../features/players/components/HPBar";
import { PlayerSettingsMenu } from "../../features/players/components/PlayerSettingsMenu";
import type { OwnerControl } from "../../features/players/components/TokenSettingsSection";

interface MobilePlayerRowProps {
  player: Player & { characterId: string };
  isMe: boolean;
  /** The VIEWER's DM state (mobile passes one flag to every row). */
  isDM: boolean;
  /** Grant/revoke the viewer's own DM status. */
  onToggleDMMode: (next: boolean) => void;
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
  /**
   * The viewer's own seat with no character: no HP, conditions, name, portrait
   * or status editors — only what a seat can use (➕ Add Character, Table role).
   */
  characterless?: boolean;
  /** DM-only: this character's owner (the sheet's Token settings). */
  owner?: OwnerControl;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  /** Present when this viewer may delete this row's character (owner or DM). */
  onDeleteCharacter?: (characterId: string) => void;
  /** The table's default sight radius in feet, shown on a token that inherits
   *  it. Undefined means no default is set, which is unlimited. */
  tableVisionDefault?: number;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
  /** This player's token, for the DM-only sight controls (S7). */
  token?: Token;
  onTokenVisionRadiusChange?: (radiusFeet: number | null) => void;
  tokenSize?: TokenSize;
  /** Present when this viewer may resize this row's token (its owner, or a DM). */
  onTokenSizeChange?: (size: TokenSize) => void;
  /** Your own row: add a character (the settings window asks for its name). */
  onAddCharacter?: (name: string) => boolean;
  isCreatingCharacter?: boolean;
  /** DM-only: the token's lock and deletion. */
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  onDeleteToken?: () => void;
  /** Feet per turn (movement budget); DM-only, like the sight radius. */
  characterSpeed?: number;
  onCharacterSpeedChange?: (speedFeet: number | null) => void;
  /** DM-only: the spend and its reset. */
  characterBudget?: MovementBudgetControl;
  /**
   * Centre the map on THIS character's token and show the map (U7). Absent
   * when the character has no token to centre on.
   */
  onFocus?: () => void;
  /** Its initiative and turn (U8); absent on a characterless row. */
  initiative?: MobileRowInitiative;
}

export const MobilePlayerRow = memo<MobilePlayerRowProps>(
  ({
    player,
    isMe,
    isDM,
    onToggleDMMode,
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
    characterless = false,
    owner,
    onCharacterHpChange,
    onCharacterNameUpdate,
    onDeleteCharacter,
    tableVisionDefault,
    onCharacterPortraitUpdate,
    token,
    onTokenVisionRadiusChange,
    tokenSize,
    onTokenSizeChange,
    onAddCharacter,
    isCreatingCharacter,
    tokenLocked,
    onToggleTokenLock,
    onDeleteToken,
    characterSpeed,
    onCharacterSpeedChange,
    characterBudget,
    onFocus,
    initiative,
  }) => {
    const isEditingHp = editingHpUID === player.characterId;
    const isEditingMaxHp = editingMaxHpUID === player.characterId;
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Another player's sheet is the DM's to hold. On losing DM rights (a
    // deploy, a restart) it closes rather than offering editors the server
    // now refuses, and it does not reopen by itself on re-elevation.
    const mayEdit = isMe || isDM;
    useEffect(() => {
      if (!mayEdit) setSettingsOpen(false);
    }, [mayEdit]);
    const [localNameInput, setLocalNameInput] = useState(player.name);
    // Re-read the name whenever the sheet opens or someone renames the
    // character, as the desktop card does: a copy taken at mount showed a
    // stale name, and leaving the field sent it back over their rename.
    useEffect(() => {
      if (settingsOpen) setLocalNameInput(player.name);
    }, [settingsOpen, player.name]);
    const [portraitImageInput, setPortraitImageInput] = useState(player.portrait ?? "");
    // Like the name: re-read on open and on a change made elsewhere, or
    // leaving the field sends a stale URL back over it.
    useEffect(() => {
      if (settingsOpen) setPortraitImageInput(player.portrait ?? "");
    }, [settingsOpen, player.portrait]);

    const activeEffects = player.statusEffects || [];

    return (
      <div
        data-testid="mobile-player-row"
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
              {initiative?.value !== undefined ? ` · Init ${initiative.value}` : ""}
              {initiative?.isTurn ? " · ▶ Turn" : ""}
            </div>
          </div>
        </div>

        {/* The row's actions on a line of their own (U7): beside the name,
            FOCUS and EDIT left a phone ~80px for it and cut "Player 1" to
            "Playe…". */}
        <MobileRowActions
          name={player.name}
          onFocus={onFocus}
          onOpenInitiative={initiative?.onOpen}
          initiative={initiative?.value}
          initiativeFocusKey={initiative?.focusKey}
          onEdit={isMe || isDM ? () => setSettingsOpen(true) : undefined}
        />

        {/* HP Bar */}
        {!characterless && (
          <div style={{ padding: "0 4px" }}>
            <HPBar
              hp={player.hp ?? 100}
              maxHp={player.maxHp ?? 100}
              tempHp={player.tempHp}
              // Its editors: the owner's, and the DM's (the server allows both).
              isMe={isMe || isDM}
              isEditingHp={isEditingHp}
              hpInput={hpInput}
              isEditingMaxHp={isEditingMaxHp}
              maxHpInput={maxHpInput}
              playerUid={player.characterId}
              onHpChange={(newHp) =>
                onCharacterHpChange(player.characterId, newHp, player.maxHp ?? 100, player.tempHp)
              }
              onHpInputChange={onHpInputChange}
              onHpEdit={onHpEdit}
              onHpSubmit={onHpSubmit}
              onMaxHpInputChange={onMaxHpInputChange}
              onMaxHpEdit={onMaxHpEdit}
              onMaxHpSubmit={onMaxHpSubmit}
              onTempHpInputChange={() => {}} // Simplify mobile view
            />
          </div>
        )}

        <MobileRowConditions
          activeEffects={activeEffects}
          // The owner or the DM: the handler is supplied for every row, so
          // this is the gate that keeps a player off a party member's.
          onStatusEffectsChange={isMe || isDM ? onStatusEffectsChange : undefined}
        />

        {/* Mobile Settings Menu Overlay */}
        <PlayerSettingsMenu
          isOpen={mayEdit && settingsOpen}
          onClose={() => setSettingsOpen(false)}
          tokenVisionRadius={token?.visionRadius}
          tableVisionDefault={tableVisionDefault}
          onTokenVisionRadiusChange={onTokenVisionRadiusChange}
          tokenSize={tokenSize}
          onTokenSizeChange={onTokenSizeChange}
          owner={owner}
          onAddCharacter={onAddCharacter}
          isCreatingCharacter={isCreatingCharacter}
          tokenLocked={tokenLocked}
          onToggleTokenLock={onToggleTokenLock}
          onDeleteToken={onDeleteToken}
          characterSpeed={characterSpeed}
          onCharacterSpeedChange={onCharacterSpeedChange}
          characterBudget={characterBudget}
          compactControls
          nameInput={localNameInput}
          onNameInputChange={characterless ? undefined : setLocalNameInput}
          onNameSubmit={() => {
            // Leaving the field is a submit; an unchanged name is not a rename.
            const next = localNameInput.trim();
            if (next && next !== player.name) {
              onCharacterNameUpdate(player.characterId, next);
            }
          }}
          portraitImageInput={characterless ? undefined : portraitImageInput}
          onPortraitInputChange={setPortraitImageInput}
          onPortraitApply={(url) => {
            onCharacterPortraitUpdate(player.characterId, url);
          }}
          // Token-image and save/load are deliberately OMITTED rather than
          // stubbed: they are not wired on mobile, and a control that silently
          // does nothing is worse than one that isn't there. PlayerSettingsMenu
          // hides those sections when the handlers are absent.
          selectedEffects={activeEffects}
          onStatusEffectsChange={characterless ? undefined : (onStatusEffectsChange ?? (() => {}))}
          isDM={isDM}
          // The viewer's own row is the only place DM Mode belongs, and this is
          // the only DM-elevation control that exists on a phone.
          viewerIsDM={isDM}
          canToggleDM={isMe}
          onToggleDMMode={onToggleDMMode}
          characterId={player.characterId}
          onDeleteCharacter={onDeleteCharacter}
        />
      </div>
    );
  },
);

MobilePlayerRow.displayName = "MobilePlayerRow";
