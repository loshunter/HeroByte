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
import { allocateNpcNames } from "../../domains/character/npcNaming.js";
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";

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
  /** How many to create, defaulting to 1. Validated upstream against NPC_CREATE_LIMITS. */
  count?: number;
  /** Hidden-from-players flag to carry onto the copy. Only `false` is honoured. */
  visibleToPlayers?: boolean;
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
  initiativeModifier?: number;
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
   * Creates `options.count` NPCs (default 1) in one pass, numbered so a DM can
   * tell Goblin 3 from Goblin 5. One message in, one broadcast and one save
   * out — which is also what keeps the client's single-flight creation guard
   * honest, since it was written for exactly one create in the air.
   *
   * @param state - Room state
   * @param name - NPC name, used as the base for numbering
   * @param maxHp - Max HP
   * @param portrait - Portrait URL
   * @param options - Additional options (hp, tokenImage, count)
   * @returns Result indicating broadcast/save needs
   */
  handleCreateNPC(
    state: RoomState,
    name: string,
    maxHp: number,
    portrait?: string,
    options?: CreateNPCOptions,
  ): NPCMessageResult {
    const requested = Math.max(1, Math.floor(options?.count ?? 1));

    // A room whose characters outgrow the snapshot limit produces a session
    // file that fails its own load validation — the DM's backup stops being a
    // backup. Bulk creation is the first way to hit that by accident, so it is
    // the first thing that has to refuse. Partial batches are deliberate: 3 of
    // 5 goblins beats 0, and the DM can see what landed.
    const room = Math.max(0, SNAPSHOT_LIMITS.characters - state.characters.length);
    const toCreate = Math.min(requested, room);
    if (toCreate === 0) {
      console.warn(
        `Refusing to create NPC: room is at the ${SNAPSHOT_LIMITS.characters}-character limit`,
      );
      return { broadcast: false, save: false };
    }

    const names = allocateNpcNames(
      state.characters.map((character) => character.name),
      name,
      toCreate,
    );
    for (const allocated of names) {
      // An explicit literal, NOT the options bag. The bag carries `count` and
      // `visibleToPlayers`, which are loop control and a post-creation flag —
      // neither belongs in a per-entity constructor, and it was being handed
      // over once per NPC. It compiled only because excess-property checks do
      // not apply to a variable, and it was inert only because createCharacter
      // happens to build its fields one at a time. The day that becomes
      // `...options`, `count` lands in room state, in the snapshot (the
      // recipient filter spreads `...character`) and in the saved session file.
      // A fresh literal restores the excess-property check here, so the next
      // field added to CreateNPCOptions fails typecheck instead of leaking.
      const created = this.characterService.createCharacter(
        state,
        allocated,
        maxHp,
        portrait,
        "npc",
        {
          hp: options?.hp,
          tokenImage: options?.tokenImage,
        },
      );
      // Only an explicit `false` is honoured — everywhere else in the codebase
      // "not false" means visible, so a hostile or malformed value can only
      // ever produce the default. Set here rather than in createCharacter so a
      // hidden NPC's copy stays hidden without every PC creation path growing
      // a visibility argument it has no use for.
      if (options?.visibleToPlayers === false) {
        created.visibleToPlayers = false;
      }
    }

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
