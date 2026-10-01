// ============================================================================
// PLAYER SETTINGS MENU
// ============================================================================
// A character's settings window, in two halves (U7): **Character** — name, art,
// conditions, initiative, its file — and **Token settings** — how its token
// behaves on the map. Role (Enter / Leave DM mode) is the table's, not this
// character's, and lives in the Table menu (U9).

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { ImageField } from "../../../components/ui/ImageField";
import type { MovementBudgetControl } from "./MovementSpeedField";
import {
  TokenSettingsSection,
  hasTokenSettings,
  type OwnerControl,
  type TokenSettingsProps,
} from "./TokenSettingsSection";
import { StatusEffectsPicker } from "./StatusEffectsPicker";
import { useStatusEffectsPicker } from "./useStatusEffectsPicker";
import { CharacterNameField, useCharacterEscapeGuard } from "./CharacterNameField";
import { CharacterCreationModal } from "./CharacterCreationModal";
import "./characterSettings.css";

const NO_EFFECTS_CHANGE = () => {};

interface PlayerSettingsMenuProps {
  /** DM-only: this character's owner (Token settings). */
  owner?: OwnerControl;
  isOpen: boolean;
  onClose: () => void;
  /*
   * These are OPTIONAL, and the sections that use them render only when they
   * are supplied. The mobile sheet used to satisfy them with `""` and `() => {}`
   * to meet a required-prop signature, which shipped a text field that could not
   * be typed into, a "Save to File" that did nothing, and a "Load from File"
   * that opened a real OS file picker and discarded the chosen file. Omitting
   * a capability is honest; faking it is not.
   */
  tokenImageInput?: string;
  tokenImageUrl?: string;
  onTokenImageInputChange?: (value: string) => void;
  onTokenImageClear?: () => void;
  onTokenImageApply?: (value: string) => void;
  onSavePlayerState?: () => void;
  onLoadPlayerState?: (file: File) => Promise<void>;
  selectedEffects: string[];
  /** Absent for a seat with no character: no picker is offered. */
  onStatusEffectsChange?: (effects: string[]) => void;
  /**
   * Whether the player/character this card BELONGS TO is a DM. Accepted for
   * the callers' sake and no longer read: it once hid the token image, size
   * and lock ("DM players don't have tokens") and "+ Add Character" on a DM's
   * card — a DM-run ally is a combatant since F3 and needs a card to be added
   * from, and the server tokens it like anyone's. The caller's handlers are
   * the gates, as they always were for Sight Radius and Movement.
   */
  isDM?: boolean;
  /**
   * Whether the person LOOKING at this card is a DM: the owner control, the
   * sight and movement settings and Delete Token are theirs. Separate from
   * `isDM`, the card OWNER's flag — the two differ on anyone else's card.
   */
  viewerIsDM?: boolean;
  onDeleteToken?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  /** Sight limit in feet; undefined is unlimited. DM-only (S7). */
  tokenVisionRadius?: number;
  /** The table's default sight radius in feet, so a token that INHERITS it can
   *  say what it inherited. Undefined means no default is set, which is
   *  unlimited — a real answer, not a missing one. */
  tableVisionDefault?: number;
  onTokenVisionRadiusChange?: (radiusFeet: number | null) => void;
  /** Feet per turn (movement budget); DM-only, like the sight radius. */
  characterSpeed?: number;
  onCharacterSpeedChange?: (speedFeet: number | null) => void;
  /**
   * DM-only: the spend and its reset, beside the speed — and only WITH it: the
   * Movement panel renders on `onCharacterSpeedChange`, so a layout that forwards
   * the reset without the speed shows neither (both are DM-gated at every call site).
   */
  characterBudget?: MovementBudgetControl;
  /** Render the sight controls at the 44px touch floor (mobile rows). */
  compactControls?: boolean;
  onAddCharacter?: (name: string) => boolean;
  isCreatingCharacter?: boolean;
  characterId?: string;
  onDeleteCharacter?: (characterId: string) => void;
  initiative?: number;
  onClearInitiative?: () => void;
  // New props for name and portrait editing
  nameInput?: string;
  onNameInputChange?: (value: string) => void;
  onNameSubmit?: () => void;
  portraitImageInput?: string;
  onPortraitInputChange?: (value: string) => void;
  onPortraitApply?: (value: string) => void;
}

export function PlayerSettingsMenu({
  owner,
  isOpen,
  onClose,
  tokenImageInput,
  tokenImageUrl,
  onTokenImageInputChange,
  onTokenImageClear,
  onTokenImageApply,
  onSavePlayerState,
  onLoadPlayerState,
  selectedEffects,
  onStatusEffectsChange,
  viewerIsDM = false,
  onDeleteToken,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  tokenVisionRadius,
  tableVisionDefault,
  onTokenVisionRadiusChange,
  characterSpeed,
  onCharacterSpeedChange,
  characterBudget,
  compactControls = false,
  onAddCharacter,
  isCreatingCharacter,
  characterId,
  onDeleteCharacter,
  initiative,
  onClearInitiative,
  nameInput,
  onNameInputChange,
  onNameSubmit,
  portraitImageInput,
  onPortraitInputChange,
  onPortraitApply,
}: PlayerSettingsMenuProps): JSX.Element | null {
  const { suppressBlur, beforeEscape } = useCharacterEscapeGuard(isOpen);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const statusEffectsPicker = useStatusEffectsPicker(
    selectedEffects,
    onStatusEffectsChange ?? NO_EFFECTS_CHANGE,
  );
  const characterHeadingId = useId();
  const tokenHeadingId = useId();

  if (!isOpen) {
    return null;
  }

  const tokenSettings: TokenSettingsProps = {
    // The DM's only, like Delete Token below.
    owner: viewerIsDM ? owner : undefined,
    tokenSize,
    onTokenSizeChange,
    tokenVisionRadius,
    tableVisionDefault,
    onTokenVisionRadiusChange,
    characterSpeed,
    onCharacterSpeedChange,
    characterBudget,
    tokenLocked,
    onToggleTokenLock,
    // Gated on viewerIsDM, not isDM: `isDM` is the CARD OWNER's flag, and
    // gating on it once made this button impossible to render at all.
    onDeleteToken: viewerIsDM ? onDeleteToken : undefined,
    compactControls,
  };

  const settingsMenu = createPortal(
    // The portal lands on document.body, OUTSIDE every mobile surface — so on
    // a phone this window's rename and portrait fields were the one Party
    // surface the 44px touch floor could not reach (and the e2e sweep, scoped
    // to the same attribute, could not see). display:contents adds no box;
    // it is the same shape MobileSurfaces uses for the dice sheet.
    <div style={{ display: "contents" }} data-mobile-surface="settings">
      <DraggableWindow
        // Named and positioned PER SUBJECT. Every settings window used to be
        // titled "🎮 Player Settings" and share one saved position, so a DM
        // opening Alice's and then Bob's got two identical windows stacked
        // pixel-for-pixel with nothing on screen naming who each belonged to.
        title={nameInput ? `🎮 ${nameInput}` : "🎮 Player Settings"}
        onClose={onClose}
        interaction={{ behavior: "close", panel: "character", beforeEscape }}
        initialX={300}
        initialY={100}
        width={280}
        minWidth={280}
        maxWidth={350}
        storageKey={characterId ? `player-settings-menu:${characterId}` : "player-settings-menu"}
        zIndex={2500}
      >
        <JRPGPanel
          variant="bevel"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "12px",
            background: "rgba(12, 18, 40, 0.95)",
          }}
        >
          <section className="character-settings__section" aria-labelledby={characterHeadingId}>
            <h3 id={characterHeadingId} className="character-settings__heading">
              Character
            </h3>
            {/* Name Editing */}
            {onNameInputChange && onNameSubmit && nameInput !== undefined && (
              <CharacterNameField
                value={nameInput}
                onChange={onNameInputChange}
                onSubmit={onNameSubmit}
                suppressBlur={suppressBlur}
              />
            )}

            {/* Portrait: upload from disk/camera roll, or paste a URL (S3) */}
            {onPortraitInputChange && onPortraitApply && portraitImageInput !== undefined && (
              <JRPGPanel
                variant="simple"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "12px",
                }}
              >
                <ImageField
                  label="Portrait Image URL"
                  value={portraitImageInput}
                  onChange={onPortraitInputChange}
                  onCommit={(url) => {
                    // An empty commit means "typed nothing"; portraits keep their
                    // long-standing skip-empty behavior (Clear never existed here).
                    if (url) onPortraitApply(url);
                  }}
                  placeholder="https://example.com/portrait.png"
                  applyLabel="Apply Portrait"
                />
              </JRPGPanel>
            )}

            {/*
          Hidden when no handler is supplied: the mobile sheet used to pass a
          value pinned to "" with a no-op onChange, producing a text field that
          physically could not be typed into. (It also used to hide behind
          "DM players don't have tokens" — they do, since their own character
          got one; the caller's handler is the gate now, like Sight Radius.)
        */}
            {onTokenImageInputChange && onTokenImageApply && (
              <JRPGPanel
                variant="simple"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "12px",
                }}
              >
                <ImageField
                  label="Token Image URL"
                  value={tokenImageInput ?? ""}
                  onChange={onTokenImageInputChange}
                  onCommit={onTokenImageApply}
                  onClear={onTokenImageClear}
                  placeholder="https://example.com/token.png"
                />
                {tokenImageUrl ? (
                  <img
                    src={tokenImageUrl}
                    alt="Token preview"
                    style={{
                      width: "60px",
                      height: "60px",
                      margin: "4px auto 0",
                      objectFit: "cover",
                      borderRadius: "6px",
                      border: "2px solid var(--jrpg-border-gold)",
                    }}
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
              </JRPGPanel>
            )}

            {onStatusEffectsChange && <StatusEffectsPicker {...statusEffectsPicker} />}

            {onClearInitiative && (
              <JRPGPanel
                variant="simple"
                style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
              >
                <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                  Initiative Status
                </span>
                <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                  {initiative !== undefined ? `Active: ${initiative}` : "No initiative set"}
                </div>
                <JRPGButton
                  onClick={onClearInitiative}
                  variant="default"
                  disabled={initiative === undefined}
                  style={{ fontSize: "10px", padding: "6px 8px" }}
                >
                  🧹 Clear Initiative
                </JRPGButton>
              </JRPGPanel>
            )}

            {onSavePlayerState && onLoadPlayerState && (
              <JRPGPanel
                variant="simple"
                style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
              >
                <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                  Character file
                </span>
                <span className="character-settings__note">
                  {viewerIsDM
                    ? "This character — name, HP, portrait, token and conditions — plus its player's drawings, if they have any. Loading onto your own character replaces your drawings on the map if the file holds any; onto another player's it leaves their drawings alone. It never saves or restores the table."
                    : "This character — name, HP, portrait, token and conditions — plus your own drawings, if you have any. Loading a file that holds drawings replaces the ones you have on the map. It never saves or restores the table."}
                </span>
                <JRPGButton
                  onClick={onSavePlayerState}
                  variant="primary"
                  style={{ fontSize: "10px" }}
                >
                  Save character
                </JRPGButton>
                <JRPGButton
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: "10px" }}
                >
                  Load character…
                </JRPGButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  aria-label="Choose a character file to load"
                  style={{ display: "none" }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      await onLoadPlayerState(file);
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Could not load that character file";
                      window.alert(message);
                    } finally {
                      event.target.value = "";
                    }
                  }}
                />
              </JRPGPanel>
            )}

            {/* Add Character: the card's own player only. Delete: the owner OR the
              DM — an abandoned seat (a player who started a fresh session) is
              cleared from here, which the server always allowed and the card
              never offered. The panel shows whichever of the two applies. */}
            {(onAddCharacter || (characterId && onDeleteCharacter)) && (
              <JRPGPanel
                variant="simple"
                style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
              >
                {onAddCharacter && (
                  <>
                    <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                      Multiple Characters
                    </span>
                    <JRPGButton
                      onClick={() => setShowCharacterModal(true)}
                      variant="primary"
                      style={{ fontSize: "10px" }}
                      disabled={isCreatingCharacter}
                    >
                      {isCreatingCharacter ? "Creating..." : "➕ Add Character"}
                    </JRPGButton>
                  </>
                )}
                {characterId && onDeleteCharacter && (
                  <JRPGButton
                    // The confirm lives in usePlayerActions.deleteCharacter, the one
                    // funnel every caller goes through; asking here too showed two
                    // identical dialogs back to back.
                    onClick={() => onDeleteCharacter(characterId)}
                    variant="danger"
                    style={{ fontSize: "10px" }}
                  >
                    🗑️ Delete this character
                  </JRPGButton>
                )}
              </JRPGPanel>
            )}
          </section>

          {hasTokenSettings(tokenSettings) && (
            <section className="character-settings__section" aria-labelledby={tokenHeadingId}>
              <h3 id={tokenHeadingId} className="character-settings__heading">
                Token settings
              </h3>
              <TokenSettingsSection {...tokenSettings} />
            </section>
          )}
        </JRPGPanel>
      </DraggableWindow>
    </div>,
    document.body,
  );

  const modal = onAddCharacter ? (
    <CharacterCreationModal
      isOpen={showCharacterModal}
      onCreateCharacter={(name) => {
        const success = onAddCharacter(name);
        if (!success) {
          // Creation already in progress, keep modal open
          return false;
        }
        // Modal will auto-close when isCreating becomes false
        return true;
      }}
      isCreating={isCreatingCharacter ?? false}
      onClose={() => setShowCharacterModal(false)}
    />
  ) : null;

  return (
    <>
      {settingsMenu}
      {modal}
    </>
  );
}
