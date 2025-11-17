// ============================================================================
// CHARACTER DOMAIN - SERVICE
// ============================================================================
// Handles character-related business logic (Phase 1: PCs only)

import { randomUUID } from "crypto";
import type { Character } from "@shared";
import type { RoomState } from "../room/model.js";
import type { TokenService } from "../token/service.js";

/**
 * Character service - manages character data and actions
 */
export class CharacterService {
  /**
   * Find character by ID
   */
  findCharacter(state: RoomState, characterId: string): Character | undefined {
    return state.characters.find((c) => c.id === characterId);
  }

  /**
   * Find character owned by player UID
   */
  findCharacterByOwner(state: RoomState, playerUID: string): Character | undefined {
    return state.characters.find((c) => c.ownedByPlayerUID === playerUID);
  }

  /**
   * Get all unclaimed characters
   */
  getUnclaimedCharacters(state: RoomState): Character[] {
    return state.characters.filter((c) => !c.ownedByPlayerUID);
  }

  /**
   * Create a new character (supports PCs and NPCs)
   */
  createCharacter(
    state: RoomState,
    name: string,
    maxHp: number,
    portrait?: string,
    type: "pc" | "npc" = "pc",
    options?: { hp?: number; tokenImage?: string },
  ): Character {
    const clamp = (value: number) => Math.max(0, value);
    const normalizedMaxHp = clamp(maxHp);
    const normalizedHp = Math.min(normalizedMaxHp, clamp(options?.hp ?? maxHp));
    const tokenImage = options?.tokenImage?.trim() ?? undefined;

    const newCharacter: Character = {
      id: randomUUID(),
      type,
      name,
      portrait,
      hp: normalizedHp,
      maxHp: normalizedMaxHp,
      tokenId: undefined,
      ownedByPlayerUID: undefined,
      tokenImage: tokenImage ?? null,
    };

    state.characters.push(newCharacter);
    console.log(`Created character: ${name} (ID: ${newCharacter.id})`);
    return newCharacter;
  }

  /**
   * Claim a character (player takes ownership)
   */
  claimCharacter(state: RoomState, characterId: string, playerUID: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      console.error(`Cannot claim: Character ${characterId} not found`);
      return false;
    }

    if (character.ownedByPlayerUID) {
      console.error(
        `Cannot claim: Character ${characterId} already owned by ${character.ownedByPlayerUID}`,
      );
      return false;
    }

    character.ownedByPlayerUID = playerUID;
    console.log(`Character ${character.name} claimed by player ${playerUID}`);
    return true;
  }

  /**
   * Update character HP
   */
  updateHP(state: RoomState, characterId: string, hp: number, maxHp: number): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.hp = hp;
      character.maxHp = maxHp;
      return true;
    }
    return false;
  }

  /**
   * Update character name
   */
  updateName(state: RoomState, characterId: string, name: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.name = name;
      return true;
    }
    return false;
  }

  /**
   * Set status effects for a character
   */
  setStatusEffects(state: RoomState, characterId: string, effects: string[]): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.statusEffects = [...effects];
      console.log(`Set status effects for ${character.name}:`, effects);
      return true;
    }
    return false;
  }

  /**
   * Update NPC metadata
   */
  updateNPC(
    state: RoomState,
    tokenService: TokenService,
    characterId: string,
    updates: {
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
    },
  ): boolean {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      return false;
    }

    character.name = updates.name;
    character.maxHp = Math.max(0, updates.maxHp);
    character.hp = Math.min(character.maxHp, Math.max(0, updates.hp));
    character.portrait = updates.portrait || undefined;
    character.type = "npc";
    character.tokenImage = updates.tokenImage?.trim() || null;

    // Update initiative modifier if provided
    if (updates.initiativeModifier !== undefined) {
      character.initiativeModifier = updates.initiativeModifier;
    }

    if (character.tokenId) {
      tokenService.setImageUrlForToken(state, character.tokenId, character.tokenImage ?? undefined);
    }

    return true;
  }

  /**
   * Delete character by ID
   */
  deleteCharacter(state: RoomState, characterId: string): Character | undefined {
    const index = state.characters.findIndex((c) => c.id === characterId);
    if (index === -1) return undefined;
    const [removed] = state.characters.splice(index, 1);
    return removed;
  }

  /**
   * Link a token to a character
   */
  linkToken(state: RoomState, characterId: string, tokenId: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.tokenId = tokenId;
      console.log(`Linked token ${tokenId} to character ${character.name}`);
      return true;
    }
    return false;
  }

  /**
   * Place an NPC token on the map at default coordinates
   */
  placeNPCToken(
    state: RoomState,
    tokenService: TokenService,
    characterId: string,
    ownerUid: string,
  ): Character | undefined {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      return undefined;
    }

    if (character.tokenId) {
      tokenService.forceDeleteToken(state, character.tokenId);
    }

    const token = tokenService.createToken(
      state,
      ownerUid,
      0,
      0,
      character.tokenImage ?? undefined,
    );
    character.tokenId = token.id;
    return character;
  }

  /**
   * Unlink token from character (when token deleted)
   */
  unlinkToken(state: RoomState, tokenId: string): boolean {
    const character = state.characters.find((c) => c.tokenId === tokenId);
    if (character) {
      character.tokenId = null;
      console.log(`Unlinked token from character ${character.name}`);
      return true;
    }
    return false;
  }

  /**
   * Set initiative for a character
   */
  setInitiative(
    state: RoomState,
    characterId: string,
    initiative: number,
    initiativeModifier?: number,
  ): boolean {
    const characterIndex = state.characters.findIndex((c) => c.id === characterId);
    if (characterIndex === -1) {
      return false;
    }

    const character = state.characters[characterIndex];

    // Create a new character object to trigger React re-renders
    const updatedCharacter: Character = {
      ...character,
      initiative,
      initiativeModifier:
        initiativeModifier !== undefined ? initiativeModifier : character.initiativeModifier,
    };

    // Create a new array with the updated character to trigger React re-renders
    state.characters = [
      ...state.characters.slice(0, characterIndex),
      updatedCharacter,
      ...state.characters.slice(characterIndex + 1),
    ];

    console.log(
      `Set initiative for ${updatedCharacter.name}: ${initiative} (modifier: ${updatedCharacter.initiativeModifier ?? 0})`,
    );
    return true;
  }

  /**
   * Clear initiative for a specific character
   */
  clearInitiative(state: RoomState, characterId: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.initiative = undefined;
      console.log(`Cleared initiative for ${character.name}`);
      return true;
    }
    return false;
  }

  /**
   * Clear initiative for all characters
   */
  clearAllInitiative(state: RoomState): void {
    state.characters.forEach((character) => {
      character.initiative = undefined;
    });
    console.log("Cleared initiative for all characters");
  }

  /**
   * Get characters in initiative order (highest to lowest).
   * Tiebreaker: initiative > PC before NPC > creation order.
   */
  getCharactersInInitiativeOrder(state: RoomState): Character[] {
    const indexMap = new Map<string, number>();
    state.characters.forEach((c, index) => indexMap.set(c.id, index));

    return state.characters
      .filter((c) => c.initiative !== undefined)
      .sort((a, b) => {
        const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
        if (initDiff !== 0) return initDiff;
        if (a.type === "pc" && b.type === "npc") return -1;
        if (a.type === "npc" && b.type === "pc") return 1;
        return (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0);
      });
  }

  /**
   * Set NPC visibility to players
   * @param state - Room state
   * @param npcId - ID of NPC to update
   * @param visible - Whether NPC should be visible to players
   * @returns true if visibility was set successfully
   */
  setNPCVisibility(state: RoomState, npcId: string, visible: boolean): boolean {
    const character = this.findCharacter(state, npcId);
    if (!character) {
      console.error(`Cannot set visibility: NPC ${npcId} not found`);
      return false;
    }

    if (character.type !== "npc") {
      console.error(`Cannot set visibility: Character ${npcId} is not an NPC`);
      return false;
    }

    character.visibleToPlayers = visible;
    console.log(`Set NPC ${character.name} visibility to players: ${visible}`);
    return true;
  }

  /**
   * Check if player can control character
   */
  canControlCharacter(character: Character, playerUID: string): boolean {
    // Phase 1: Simple ownership check
    // TODO Phase 3: Add DM override and shared permissions
    return character.ownedByPlayerUID === playerUID;
  }
}
