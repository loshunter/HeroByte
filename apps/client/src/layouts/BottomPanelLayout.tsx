/**
 * BottomPanelLayout Component
 *
 * Renders the bottom panel section containing the EntitiesPanel.
 * This component displays players, characters, NPCs, and provides controls
 * for managing entities in the game session.
 *
 * Part of Phase 15 SOLID Refactor Initiative - MainLayout Decomposition (Extraction 4)
 * Extracted from: apps/client/src/layouts/MainLayout.tsx (lines 593-656)
 *
 * @remarks
 * This is a pure presentation component that receives all state and handlers
 * as props. It renders EntitiesPanel directly without any wrapper elements,
 * following the established pattern from other layout components.
 *
 * The component handles:
 * - Player and character display with HP/name editing
 * - NPC management (create, update, delete, place tokens)
 * - Token management (lock, size, image changes)
 * - Mic and portrait controls
 * - DM mode toggling
 */

import React from "react";
import type {
  Player,
  Character,
  Token,
  SceneObject,
  Drawing,
  PlayerState,
  TokenSize,
} from "@shared";
import { EntitiesPanel } from "../components/layout/EntitiesPanel";

/**
 * NPC update partial interface for type safety
 */
export interface NPC {
  name?: string;
  hp?: number;
  maxHp?: number;
  portrait?: string;
  tokenImage?: string;
}

/**
 * Props for the BottomPanelLayout component
 *
 * Organized into 11 semantic groups for clarity:
 * 1. Layout & Ref (1 prop)
 * 2. State Data (9 props)
 * 3. Name Editing (5 props)
 * 4. HP Editing (6 props)
 * 5. Max HP Editing (5 props)
 * 6. Portrait & Mic (2 props)
 * 7. DM & Player State (4 props)
 * 8. NPC Management (4 props)
 * 9. Token Management (3 props)
 * 10. Character Management (2 props)
 * 11. Combat/Initiative (5 props)
 */
export interface BottomPanelLayoutProps {
  // Layout & Ref (1 prop)
  /** Reference to the bottom panel DOM element for height measurement */
  bottomPanelRef?: React.RefObject<HTMLDivElement>;

  // State Data (9 props)
  /** Array of all players in the session */
  players: Player[];
  /** Array of all characters in the session */
  characters: Character[];
  /** Array of all tokens on the board */
  tokens: Token[];
  /** Array of all scene objects on the board */
  sceneObjects: SceneObject[];
  /** Array of all drawings on the board */
  drawings: Drawing[];
  /** Unique identifier for the current user */
  uid: string;
  /** Whether the microphone is currently enabled */
  micEnabled: boolean;
  /** Whether the current user is the Dungeon Master */
  currentIsDM: boolean;

  // Name Editing (5 props)
  /** UID of the player whose name is being edited (null if none) */
  editingPlayerUID: string | null;
  /** Current value of the name input field */
  nameInput: string;
  /** Handler to update the name input value */
  onNameInputChange: (value: string) => void;
  /** Handler to start editing a player's name */
  onNameEdit: (uid: string, currentName: string) => void;
  /** Handler to submit the name edit */
  onNameSubmit: () => void;

  // HP Editing (6 props)
  /** UID of the character whose current HP is being edited (null if none) */
  editingHpUID: string | null;
  /** Current value of the HP input field */
  hpInput: string;
  /** Handler to update the HP input value */
  onHpInputChange: (value: string) => void;
  /** Handler to start editing a character's current HP */
  onHpEdit: (uid: string, currentHp: number) => void;
  /** Handler to submit the HP edit */
  onHpSubmit: () => void;
  /** Handler to update a character's HP values */
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number) => void;

  // Max HP Editing (5 props)
  /** UID of the character whose max HP is being edited (null if none) */
  editingMaxHpUID: string | null;
  /** Current value of the max HP input field */
  maxHpInput: string;
  /** Handler to update the max HP input value */
  onMaxHpInputChange: (value: string) => void;
  /** Handler to start editing a character's max HP */
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  /** Handler to submit the max HP edit */
  onMaxHpSubmit: () => void;

  // Portrait & Mic (2 props)
  /** Handler to load a new portrait image */
  onPortraitLoad: () => void;
  /** Handler to toggle microphone on/off */
  onToggleMic: () => void;

  // DM & Player State (5 props)
  /** Handler to toggle DM mode on/off */
  onToggleDMMode: (next: boolean) => void;
  /** Handler to apply a player state (dead, unconscious, etc.) */
  onApplyPlayerState: (state: PlayerState, tokenId?: string, characterId?: string) => void;
  /** Handler to update status effects for a character (deprecated - use onCharacterStatusEffectsChange) */
  onStatusEffectsChange: (effects: string[]) => void;
  /** Handler to update character status effects */
  onCharacterStatusEffectsChange: (characterId: string, effects: string[]) => void;
  /** Handler to update a character's name */
  onCharacterNameUpdate: (characterId: string, name: string) => void;

  // NPC Management (6 props)
  /** Handler to update NPC properties */
  onNpcUpdate: (id: string, updates: Partial<NPC>) => void;
  /** Handler to delete an NPC */
  onNpcDelete: (id: string) => void;
  /** Handler to place an NPC token on the board */
  onNpcPlaceToken: (id: string) => void;
  /** Handler to delete a player token from the board */
  onPlayerTokenDelete: (tokenId: string) => void;
  /** Whether NPC deletion is in progress */
  isDeletingNpc?: boolean;
  /** Error message from NPC deletion attempt */
  npcDeletionError?: string | null;

  // Token Management (3 props)
  /** Handler to toggle token lock state */
  onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
  /** Handler to change token size */
  onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
  /** Handler to change token image */
  onTokenImageChange: (tokenId: string, imageUrl: string) => void;

  // Character Management (2 props)
  /** Handler to add a new character */
  onAddCharacter: (name: string) => void;
  /** Handler to delete a character */
  onDeleteCharacter: (characterId: string) => void;

  // Camera (1 prop)
  /** Handler to focus camera on a specific token */
  onFocusToken: (tokenId: string) => void;

  // Combat/Initiative (7 props)
  /** Whether combat is currently active */
  combatActive?: boolean;
  /** Character ID of the entity whose turn it currently is */
  currentTurnCharacterId?: string;
  /** Handler to set a character's initiative roll and modifier */
  onSetInitiative: (characterId: string, initiative: number, modifier: number) => void;
  /** Whether an initiative setting operation is in progress */
  isSettingInitiative?: boolean;
  /** Error message from initiative setting operation */
  initiativeError?: string | null;
  /** Handler to advance to the next turn in combat */
  onNextTurn?: () => void;
  /** Handler to go back to the previous turn in combat */
  onPreviousTurn?: () => void;
}

/**
 * BottomPanelLayout Component
 *
 * Renders the bottom panel containing the EntitiesPanel with all player,
 * character, and NPC management controls.
 *
 * @param props - BottomPanelLayoutProps with all entity state and handlers
 * @returns EntitiesPanel component (no wrapper div)
 *
 * @example
 * ```tsx
 * <BottomPanelLayout
 *   bottomPanelRef={bottomPanelRef}
 *   players={snapshot?.players || []}
 *   characters={snapshot?.characters || []}
 *   tokens={snapshot?.tokens || []}
 *   sceneObjects={snapshot?.sceneObjects || []}
 *   drawings={snapshot?.drawings || []}
 *   uid={uid}
 *   micEnabled={micEnabled}
 *   currentIsDM={isDM}
 *   editingPlayerUID={editingPlayerUID}
 *   nameInput={nameInput}
 *   onNameInputChange={updateNameInput}
 *   onNameEdit={startNameEdit}
 *   onNameSubmit={handleNameSubmit}
 *   editingHpUID={editingHpUID}
 *   hpInput={hpInput}
 *   onHpInputChange={updateHpInput}
 *   onHpEdit={startHpEdit}
 *   onHpSubmit={handleHpSubmit}
 *   onCharacterHpChange={playerActions.updateCharacterHP}
 *   editingMaxHpUID={editingMaxHpUID}
 *   maxHpInput={maxHpInput}
 *   onMaxHpInputChange={updateMaxHpInput}
 *   onMaxHpEdit={startMaxHpEdit}
 *   onMaxHpSubmit={handleMaxHpSubmit}
 *   onPortraitLoad={handlePortraitLoad}
 *   onToggleMic={toggleMic}
 *   onToggleDMMode={handleToggleDM}
 *   onApplyPlayerState={playerActions.applyPlayerState}
 *   onStatusEffectsChange={playerActions.setStatusEffects}
 *   onCharacterNameUpdate={playerActions.updateCharacterName}
 *   onNpcUpdate={handleUpdateNPC}
 *   onNpcDelete={handleDeleteNPC}
 *   onNpcPlaceToken={handlePlaceNPCToken}
 *   onPlayerTokenDelete={handleDeletePlayerToken}
 *   onToggleTokenLock={toggleSceneObjectLock}
 *   onTokenSizeChange={updateTokenSize}
 *   onTokenImageChange={updateTokenImage}
 *   onAddCharacter={playerActions.addCharacter}
 *   onDeleteCharacter={playerActions.deleteCharacter}
 * />
 * ```
 */
export const BottomPanelLayout: React.FC<BottomPanelLayoutProps> = React.memo(
  ({
    bottomPanelRef,
    players,
    characters,
    tokens,
    sceneObjects,
    drawings,
    uid,
    micEnabled,
    currentIsDM,
    editingPlayerUID,
    nameInput,
    onNameInputChange,
    onNameEdit,
    onNameSubmit,
    editingHpUID,
    hpInput,
    onHpInputChange,
    onHpEdit,
    onHpSubmit,
    onCharacterHpChange,
    editingMaxHpUID,
    maxHpInput,
    onMaxHpInputChange,
    onMaxHpEdit,
    onMaxHpSubmit,
    onPortraitLoad,
    onToggleMic,
    onToggleDMMode,
    onApplyPlayerState,
    onStatusEffectsChange,
    onCharacterStatusEffectsChange,
    onCharacterNameUpdate,
    onNpcUpdate,
    onNpcDelete,
    onNpcPlaceToken,
    onPlayerTokenDelete,
    isDeletingNpc,
    npcDeletionError,
    onToggleTokenLock,
    onTokenSizeChange,
    onTokenImageChange,
    onAddCharacter,
    onDeleteCharacter,
    onFocusToken,
    combatActive,
    currentTurnCharacterId,
    onSetInitiative,
    isSettingInitiative,
    initiativeError,
    onNextTurn,
    onPreviousTurn,
  }) => {
    return (
      <EntitiesPanel
        players={players}
        characters={characters}
        tokens={tokens}
        sceneObjects={sceneObjects}
        drawings={drawings}
        uid={uid}
        micEnabled={micEnabled}
        currentIsDM={currentIsDM}
        editingPlayerUID={editingPlayerUID}
        nameInput={nameInput}
        onNameInputChange={onNameInputChange}
        onNameEdit={onNameEdit}
        onNameSubmit={onNameSubmit}
        editingHpUID={editingHpUID}
        hpInput={hpInput}
        onHpInputChange={onHpInputChange}
        onHpEdit={onHpEdit}
        onHpSubmit={onHpSubmit}
        onCharacterHpChange={onCharacterHpChange}
        editingMaxHpUID={editingMaxHpUID}
        maxHpInput={maxHpInput}
        onMaxHpInputChange={onMaxHpInputChange}
        onMaxHpEdit={onMaxHpEdit}
        onMaxHpSubmit={onMaxHpSubmit}
        onPortraitLoad={onPortraitLoad}
        onToggleMic={onToggleMic}
        onToggleDMMode={onToggleDMMode}
        onApplyPlayerState={onApplyPlayerState}
        _onStatusEffectsChange={onStatusEffectsChange}
        onCharacterStatusEffectsChange={onCharacterStatusEffectsChange}
        onCharacterNameUpdate={onCharacterNameUpdate}
        onNpcUpdate={onNpcUpdate}
        onNpcDelete={onNpcDelete}
        onNpcPlaceToken={onNpcPlaceToken}
        onPlayerTokenDelete={onPlayerTokenDelete}
        isDeletingNpc={isDeletingNpc}
        npcDeletionError={npcDeletionError}
        onToggleTokenLock={onToggleTokenLock}
        onTokenSizeChange={onTokenSizeChange}
        onTokenImageChange={onTokenImageChange}
        onAddCharacter={onAddCharacter}
        onDeleteCharacter={onDeleteCharacter}
        onFocusToken={onFocusToken}
        bottomPanelRef={bottomPanelRef}
        combatActive={combatActive}
        currentTurnCharacterId={currentTurnCharacterId}
        onSetInitiative={onSetInitiative}
        isSettingInitiative={isSettingInitiative}
        initiativeError={initiativeError}
        onNextTurn={onNextTurn}
        onPreviousTurn={onPreviousTurn}
      />
    );
  },
);

BottomPanelLayout.displayName = "BottomPanelLayout";
