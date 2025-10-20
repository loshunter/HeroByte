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
      tokenId: null,
      ownedByPlayerUID: null,
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
   * Check if player can control character
   */
  canControlCharacter(character: Character, playerUID: string): boolean {
    // Phase 1: Simple ownership check
    // TODO Phase 3: Add DM override and shared permissions
    return character.ownedByPlayerUID === playerUID;
  }
}
