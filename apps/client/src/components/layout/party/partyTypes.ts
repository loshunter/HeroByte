// ============================================================================
// PARTY PANEL TYPES
// ============================================================================
// The Party panel's props, and the one context its card wiring reads. They
// live apart from EntitiesPanel so the extracted cards and the compact roster
// can share them without importing the panel itself.

import type React from "react";
import type {
  Drawing,
  Player,
  PlayerState,
  SceneObject,
  SnapshotCharacter,
  Token,
  TokenSize,
} from "@herobyte/shared";

export interface EntitiesPanelProps {
  players: Player[];
  characters: SnapshotCharacter[];
  tokens: Token[];
  sceneObjects: SceneObject[];
  drawings: Drawing[];
  uid: string;
  micEnabled: boolean;
  editingPlayerUID: string | null;
  nameInput: string;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  editingTempHpUID: string | null;
  tempHpInput: string;
  onNameInputChange: (value: string) => void;
  onNameEdit: (uid: string, currentName: string) => void;
  onNameSubmit: () => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  /** The table's default sight radius in feet, shown on a token that inherits
   *  it. Undefined means no default is set, which is unlimited. */
  tableVisionDefault?: number;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
  onToggleMic: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  onTempHpInputChange: (value: string) => void;
  onTempHpEdit: (uid: string) => void;
  onTempHpSubmit: () => void;
  currentIsDM: boolean;
  onTokenImageChange: (tokenId: string, imageUrl: string) => void;
  onApplyPlayerState: (state: PlayerState, tokenId?: string, characterId?: string) => void;
  _onStatusEffectsChange: (effects: string[]) => void; // Deprecated - kept for backward compatibility
  onCharacterStatusEffectsChange: (characterId: string, effects: string[]) => void;
  onNpcUpdate?: (
    id: string,
    updates: { name?: string; hp?: number; maxHp?: number; portrait?: string; tokenImage?: string },
  ) => void;
  onNpcDelete?: (id: string) => void;
  onNpcPlaceToken?: (id: string) => void;
  onNpcToggleVisibility?: (id: string, visible: boolean) => void;
  onPlayerTokenDelete?: (tokenId: string) => void;
  /** Whether NPC deletion is in progress */
  isDeletingNpc?: boolean;
  /** Error message from NPC deletion attempt */
  npcDeletionError?: string | null;
  onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
  onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
  /** DM-only: move a player character and its token to another seat. */
  onCharacterOwnerChange: (characterId: string, ownerUid: string) => void;
  /** DM-only: set a token's sight limit in feet, or null for unlimited (S7;
   * optional so the layout fixtures stay untouched). */
  onTokenVisionRadiusChange?: (tokenId: string, radiusFeet: number | null) => void;
  /** DM-only: a character's feet per turn — the movement budget's ceiling. */
  onCharacterSpeedChange?: (characterId: string, speedFeet: number | null) => void;
  /** DM-only: zero a character's spend outside a turn boundary. */
  onCharacterBudgetReset?: (characterId: string) => void;
  onAddCharacter: (name: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  onFocusToken: (tokenId: string) => void;
  bottomPanelRef?: React.RefObject<HTMLDivElement>;
  /** Receives the Party bar's launcher dock element (U7, IA-15). */
  launcherDockRef: (node: HTMLDivElement | null) => void;
  // Combat/Initiative props
  combatActive?: boolean;
  currentTurnCharacterId?: string;
  onSetInitiative: (characterId: string, initiative: number, modifier: number) => void;
  onRollInitiative: (characterId: string, modifier?: number) => void;
  /** Whether the modal offers hand-entry: the table setting, or DM always. */
  manualInitiativeAllowed?: boolean;
  onClearInitiative?: (characterId: string) => void;
  isSettingInitiative?: boolean;
  initiativeError?: string | null;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
}

/** Everything a character or NPC card needs from the panel that renders it. */
export interface PartyCardContext {
  panel: EntitiesPanelProps;
  tokenSceneMap: ReadonlyMap<string, SceneObject & { type: "token" }>;
  drawingsByOwner: ReadonlyMap<string, Drawing[]>;
  /** The inline rename: which character's name is being typed, and its buffer. */
  nameEdit: {
    editingCharacterId: string | null;
    input: string;
    begin: (characterId: string, currentName: string) => void;
    setInput: (value: string) => void;
    end: () => void;
  };
  characterCreation: { createCharacter: (name: string) => boolean; isCreating: boolean };
  openInitiativeModal: (character: SnapshotCharacter) => void;
}
