/**
 * CharacterMessageHandler
 *
 * Handles all character-related messages from clients.
 * Manages character creation, ownership, updates, and deletion.
 *
 * Extracted from apps/server/src/ws/messageRouter.ts on 2025-11-14. The
 * seat-replacement rule a DM delete triggers lives in ./seatReplacement.ts.
 *
 * @module ws/handlers/CharacterMessageHandler
 */

import type {} from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import { replaceIfSeatedPlayerLostLastCharacter } from "./seatReplacement.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { TokenService } from "../../domains/token/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a character message
 */
export interface CharacterMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for character-related messages
 */
export class CharacterMessageHandler {
  private characterService: CharacterService;
  private tokenService: TokenService;
  private selectionService: SelectionService;
  private roomService: RoomService;

  constructor(
    characterService: CharacterService,
    tokenService: TokenService,
    selectionService: SelectionService,
    roomService: RoomService,
  ) {
    this.characterService = characterService;
    this.tokenService = tokenService;
    this.selectionService = selectionService;
    this.roomService = roomService;
  }

  /**
   * Handle create character message (DM only)
   *
   * @param state - Room state
   * @param name - Character name
   * @param maxHp - Max HP
   * @param portrait - Portrait URL
   * @returns Result indicating broadcast/save needs
   */
  handleCreateCharacter(
    state: RoomState,
    name: string,
    maxHp: number,
    portrait?: string,
  ): CharacterMessageResult {
    this.characterService.createCharacter(state, name, maxHp, portrait);
    return { broadcast: true, save: true };
  }

  /**
   * Handle claim character message
   *
   * @param state - Room state
   * @param characterId - ID of character to claim
   * @param senderUid - UID of player claiming the character
   * @returns Result indicating broadcast/save needs
   */
  handleClaimCharacter(
    state: RoomState,
    characterId: string,
    senderUid: string,
  ): CharacterMessageResult {
    const claimed = this.characterService.claimCharacter(state, characterId, senderUid);
    return { broadcast: claimed, save: claimed };
  }

  /**
   * Handle add player character message
   *
   * Creates a character for the requesting player, auto-claims it,
   * and creates a linked token at spawn position.
   *
   * @param state - Room state
   * @param senderUid - UID of player creating the character
   * @param name - Character name
   * @param maxHp - Max HP (defaults to 100)
   * @returns Result indicating broadcast/save needs
   */
  handleAddPlayerCharacter(
    state: RoomState,
    senderUid: string,
    name: string,
    maxHp?: number,
  ): CharacterMessageResult {
    console.log(`[MessageRouter] Received add-player-character from ${senderUid}:`, name);

    // Create character for the requesting player
    const actualMaxHp = maxHp ?? 100;
    const character = this.characterService.createCharacter(
      state,
      name,
      actualMaxHp,
      undefined, // portrait - player can set later
      "pc",
    );

    // Auto-claim for the requesting player
    this.characterService.claimCharacter(state, character.id, senderUid);

    // Create and link token at spawn position — a DM's too (a DM-run ally is
    // a combatant since F3, and a combatant needs a piece).
    {
      const spawn = this.roomService.getPlayerSpawnPosition();
      const token = this.tokenService.createToken(state, senderUid, spawn.x, spawn.y);
      this.characterService.linkToken(state, character.id, token.id);
    }

    console.log(
      `[MessageRouter] Player ${senderUid} created additional character: ${character.name} (ID: ${character.id})`,
    );
    console.log(
      `[MessageRouter] Broadcasting update. Total characters: ${state.characters.length}`,
    );

    return { broadcast: true, save: true };
  }

  /**
   * Handle delete player character message
   *
   * Deletes a character and its linked token if the sender owns it.
   *
   * @param state - Room state
   * @param characterId - ID of character to delete
   * @param senderUid - UID of player deleting the character
   * @param isDM - Whether sender is a DM
   * @returns Result indicating broadcast/save needs
   */
  handleDeletePlayerCharacter(
    state: RoomState,
    characterId: string,
    senderUid: string,
    isDM: boolean,
  ): CharacterMessageResult {
    // Find the character to delete
    const characterToDelete = this.characterService.findCharacter(state, characterId);

    // Permission check: Only allow if player owns this character or is DM
    if (!characterToDelete || (!isDM && characterToDelete.ownedByPlayerUID !== senderUid)) {
      console.warn(`Player ${senderUid} tried to delete character they don't own`);
      return { broadcast: false, save: false };
    }

    // Delete the character
    const deleted = this.characterService.deleteCharacter(state, characterId);
    if (deleted) {
      // Delete linked token if exists
      if (deleted.tokenId) {
        this.tokenService.forceDeleteToken(state, deleted.tokenId);
        this.selectionService.removeObject(state, deleted.tokenId);
      }
      replaceIfSeatedPlayerLostLastCharacter(
        {
          characterService: this.characterService,
          tokenService: this.tokenService,
          roomService: this.roomService,
        },
        state,
        deleted,
        senderUid,
      );
      console.log(`Player ${senderUid} deleted character: ${deleted.name}`);
      return { broadcast: true, save: true };
    }

    return { broadcast: false, save: false };
  }

  /**
   * Handle update character name message
   *
   * @param state - Room state
   * @param characterId - ID of character to rename
   * @param senderUid - UID of player renaming the character
   * @param name - New name
   * @param isDM - Whether sender is a DM
   * @returns Result indicating broadcast/save needs
   */
  handleUpdateCharacterName(
    state: RoomState,
    characterId: string,
    senderUid: string,
    name: string,
    isDM: boolean,
  ): CharacterMessageResult {
    // Find the character to rename
    const characterToRename = this.characterService.findCharacter(state, characterId);

    // Permission check: Only allow if player owns this character or is DM
    if (!characterToRename || (!isDM && characterToRename.ownedByPlayerUID !== senderUid)) {
      console.warn(`Player ${senderUid} tried to rename character they don't own`);
      return { broadcast: false, save: false };
    }

    // Update the character name
    const updated = this.characterService.updateName(state, characterId, name);
    if (updated) {
      console.log(`Player ${senderUid} renamed character to: ${name} (ID: ${characterId})`);
      return { broadcast: true, save: true };
    }

    return { broadcast: false, save: false };
  }

  /**
   * Handle update character HP message
   *
   * Permission-gated like every sibling mutation: owner or DM. This was the
   * one character write with NO check — any player could rewrite any
   * character's hp, including a monster whose numbers the recipient filter
   * hides (choose the values, know the values) and rival PCs mid-fight.
   *
   * @param state - Room state
   * @param characterId - ID of character
   * @param hp - New HP
   * @param maxHp - New max HP
   * @param senderUid - Author, bound from the connection
   * @param isDM - Whether the sender holds the DM seat
   * @returns Result indicating broadcast/save needs
   */
  handleUpdateCharacterHP(
    state: RoomState,
    characterId: string,
    hp: number,
    maxHp: number,
    senderUid: string,
    isDM: boolean,
    tempHp?: number,
  ): CharacterMessageResult {
    const character = this.characterService.findCharacter(state, characterId);
    if (!character || (!isDM && !this.characterService.canControlCharacter(character, senderUid))) {
      console.warn(`Player ${senderUid} tried to update HP of a character they don't control`);
      return { broadcast: false, save: false };
    }
    const updated = this.characterService.updateHP(state, characterId, hp, maxHp, tempHp);
    return { broadcast: updated, save: updated };
  }

  /**
   * set-character-speed: feet per turn for the movement budget, or null to
   * return the character to the shared default. DM-only by design, the
   * vision-radius precedent — a budget a player could raise is not a budget.
   * The validator bounds the number.
   */
  handleSetCharacterSpeed(
    state: RoomState,
    characterId: string,
    senderUid: string,
    speed: number | null,
    isDM: boolean,
  ): CharacterMessageResult {
    if (!isDM) {
      console.warn(`Player ${senderUid} attempted to set speed for ${characterId}`);
      return { broadcast: false, save: false };
    }
    const character = this.characterService.findCharacter(state, characterId);
    if (!character) return { broadcast: false, save: false };
    const changed = speed === null ? character.speed !== undefined : character.speed !== speed;
    if (speed === null) delete character.speed;
    else character.speed = speed;
    return { broadcast: changed, save: changed };
  }

  /**
   * Handle set character status effects message
   *
   * @param state - Room state
   * @param characterId - ID of character
   * @param senderUid - UID of player setting effects
   * @param effects - Status effects array
   * @param isDM - Whether sender is a DM
   * @returns Result indicating broadcast/save needs
   */
  handleSetCharacterStatusEffects(
    state: RoomState,
    characterId: string,
    senderUid: string,
    effects: string[],
    isDM: boolean,
  ): CharacterMessageResult {
    // Find the character
    const character = this.characterService.findCharacter(state, characterId);

    // Permission check: Only allow if player owns this character or is DM
    const canModify =
      isDM || (character && this.characterService.canControlCharacter(character, senderUid));

    if (!canModify) {
      console.warn(
        `Player ${senderUid} attempted to set status effects for character they don't control`,
      );
      return { broadcast: false, save: false };
    }

    const updated = this.characterService.setStatusEffects(state, characterId, effects);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set character portrait message
   */
  handleSetCharacterPortrait(
    state: RoomState,
    characterId: string,
    senderUid: string,
    portrait: string | undefined,
    isDM: boolean,
  ): CharacterMessageResult {
    const character = this.characterService.findCharacter(state, characterId);
    const canModify =
      isDM || (character && this.characterService.canControlCharacter(character, senderUid));

    if (!canModify) {
      console.warn(
        `Player ${senderUid} attempted to set portrait for character they don't control`,
      );
      return { broadcast: false, save: false };
    }

    const updated = this.characterService.setPortrait(state, characterId, portrait);
    return { broadcast: updated, save: updated };
  }
}
