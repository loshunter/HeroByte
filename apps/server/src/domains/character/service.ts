// ============================================================================
// CHARACTER DOMAIN - SERVICE
// ============================================================================
// Handles character-related business logic (Phase 1: PCs only)

import { randomUUID } from "crypto";
import type { Character } from "@shared";
import type { RoomState } from "../room/model.js";

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
   * Create a new PC character (Phase 1: DM creates PC slots)
   */
  createCharacter(
    state: RoomState,
    name: string,
    maxHp: number,
    portrait?: string
  ): Character {
    const newCharacter: Character = {
      id: randomUUID(),
      type: "pc",
      name,
      portrait,
      hp: maxHp,
      maxHp,
      tokenId: null,
      ownedByPlayerUID: null, // Unclaimed by default
    };

    state.characters.push(newCharacter);
    console.log(`Created character: ${name} (ID: ${newCharacter.id})`);
    return newCharacter;
  }

  /**
   * Claim a character (player takes ownership)
   */
  claimCharacter(
    state: RoomState,
    characterId: string,
    playerUID: string
  ): boolean {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      console.error(`Cannot claim: Character ${characterId} not found`);
      return false;
    }

    if (character.ownedByPlayerUID) {
      console.error(
        `Cannot claim: Character ${characterId} already owned by ${character.ownedByPlayerUID}`
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
  updateHP(
    state: RoomState,
    characterId: string,
    hp: number,
    maxHp: number
  ): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.hp = hp;
      character.maxHp = maxHp;
      return true;
    }
    return false;
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
   * Check if player can control character
   */
  canControlCharacter(character: Character, playerUID: string): boolean {
    // Phase 1: Simple ownership check
    // TODO Phase 3: Add DM override and shared permissions
    return character.ownedByPlayerUID === playerUID;
  }
}
