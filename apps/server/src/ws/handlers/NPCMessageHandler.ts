/**
 * NPCMessageHandler
 *
 * Handles all NPC-related messages from clients.
 * Manages NPC creation, updates, deletion, and token placement.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - create-npc (lines 237-252)
 * - update-npc (lines 254-271)
 * - delete-npc (lines 273-288)
 * - place-npc-token (lines 290-301)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/NPCMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { TokenService } from "../../domains/token/service.js";
import type { SelectionService } from "../../domains/selection/service.js";

/**
 * Result of handling an NPC message
 */
export interface NPCMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Options for creating an NPC
 */
export interface CreateNPCOptions {
  hp?: number;
  tokenImage?: string;
}

/**
 * Options for updating an NPC
 */
export interface UpdateNPCOptions {
  name: string;
  hp: number;
  maxHp: number;
  portrait?: string;
  tokenImage?: string;
}

/**
 * Handler for NPC-related messages
 */
export class NPCMessageHandler {
  private characterService: CharacterService;
  private tokenService: TokenService;
  private selectionService: SelectionService;

  constructor(
    characterService: CharacterService,
    tokenService: TokenService,
    selectionService: SelectionService,
  ) {
    this.characterService = characterService;
    this.tokenService = tokenService;
    this.selectionService = selectionService;
  }

  /**
   * Handle create NPC message (DM only)
   *
   * @param state - Room state
   * @param name - NPC name
   * @param maxHp - Max HP
   * @param portrait - Portrait URL
   * @param options - Additional options (hp, tokenImage)
   * @returns Result indicating broadcast/save needs
   */
  handleCreateNPC(
    state: RoomState,
    name: string,
    maxHp: number,
    portrait?: string,
    options?: CreateNPCOptions,
  ): NPCMessageResult {
    this.characterService.createCharacter(state, name, maxHp, portrait, "npc", options);
    return { broadcast: true, save: true };
  }

  /**
   * Handle update NPC message (DM only)
   *
   * @param state - Room state
   * @param npcId - ID of NPC to update
   * @param updates - Properties to update
   * @returns Result indicating broadcast/save needs
   */
  handleUpdateNPC(state: RoomState, npcId: string, updates: UpdateNPCOptions): NPCMessageResult {
    const updated = this.characterService.updateNPC(state, this.tokenService, npcId, updates);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle delete NPC message (DM only)
   *
   * Deletes an NPC and its linked token if it exists.
   *
   * @param state - Room state
   * @param npcId - ID of NPC to delete
   * @returns Result indicating broadcast/save needs
   */
  handleDeleteNPC(state: RoomState, npcId: string): NPCMessageResult {
    const removed = this.characterService.deleteCharacter(state, npcId);
    if (removed) {
      // Delete linked token if exists
      if (removed.tokenId) {
        this.tokenService.forceDeleteToken(state, removed.tokenId);
        this.selectionService.removeObject(state, removed.tokenId);
      }
      return { broadcast: true, save: true };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle place NPC token message (DM only)
   *
   * Creates and places a token for an NPC that doesn't have one yet.
   *
   * @param state - Room state
   * @param npcId - ID of NPC to place token for
   * @param senderUid - UID of DM placing the token
   * @returns Result indicating broadcast/save needs
   */
  handlePlaceNPCToken(state: RoomState, npcId: string, senderUid: string): NPCMessageResult {
    const placed = !!this.characterService.placeNPCToken(
      state,
      this.tokenService,
      npcId,
      senderUid,
    );
    return { broadcast: placed, save: placed };
  }

  /**
   * Handle toggle NPC visibility message (DM only)
   *
   * Toggles whether an NPC is visible to players. Hidden NPCs and their tokens
   * will not appear in player snapshots.
   *
   * @param state - Room state
   * @param npcId - ID of NPC to toggle visibility for
   * @param visible - Whether NPC should be visible to players
   * @returns Result indicating broadcast/save needs
   */
  handleToggleNPCVisibility(state: RoomState, npcId: string, visible: boolean): NPCMessageResult {
    const updated = this.characterService.setNPCVisibility(state, npcId, visible);
    return { broadcast: updated, save: updated };
  }
}
