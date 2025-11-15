/**
 * TokenMessageHandler
 *
 * Handles all token-related messages from clients.
 * Manages token movement, appearance, lifecycle, and character linking.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - move (lines 94-98)
 * - recolor (lines 100-104)
 * - delete-token (lines 106-120)
 * - update-token-image (lines 122-127)
 * - set-token-size (lines 129-134)
 * - set-token-color (lines 136-147)
 * - link-token (lines 559-564)
 * - clear-all-tokens (lines 815-837)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/TokenMessageHandler
 */

import type { RoomState, TokenSize } from "@shared";
import type { TokenService } from "../../domains/token/service.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a token message
 */
export interface TokenMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for token-related messages
 */
export class TokenMessageHandler {
  private tokenService: TokenService;
  private characterService: CharacterService;
  private selectionService: SelectionService;
  private roomService: RoomService;

  constructor(
    tokenService: TokenService,
    characterService: CharacterService,
    selectionService: SelectionService,
    roomService: RoomService,
  ) {
    this.tokenService = tokenService;
    this.characterService = characterService;
    this.selectionService = selectionService;
    this.roomService = roomService;
  }

  /**
   * Handle token move message
   *
   * @param state - Room state
   * @param tokenId - ID of token to move
   * @param senderUid - UID of player moving the token
   * @param x - New X coordinate
   * @param y - New Y coordinate
   * @returns Result indicating broadcast/save needs
   */
  handleMove(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    x: number,
    y: number,
  ): TokenMessageResult {
    const moved = this.tokenService.moveToken(state, tokenId, senderUid, x, y);
    return { broadcast: moved, save: false };
  }

  /**
   * Handle token recolor message
   *
   * @param state - Room state
   * @param tokenId - ID of token to recolor
   * @param senderUid - UID of player recoloring the token
   * @returns Result indicating broadcast/save needs
   */
  handleRecolor(state: RoomState, tokenId: string, senderUid: string): TokenMessageResult {
    const recolored = this.tokenService.recolorToken(state, tokenId, senderUid);
    return { broadcast: recolored, save: false };
  }

  /**
   * Handle token delete message
   *
   * @param state - Room state
   * @param tokenId - ID of token to delete
   * @param senderUid - UID of player deleting the token
   * @param isDM - Whether sender is a DM
   * @returns Result indicating broadcast/save needs
   */
  handleDelete(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    isDM: boolean,
  ): TokenMessageResult {
    const success = isDM
      ? this.tokenService.forceDeleteToken(state, tokenId)
      : this.tokenService.deleteToken(state, tokenId, senderUid);

    if (success) {
      this.selectionService.removeObject(state, tokenId);
    }

    return { broadcast: success, save: false };
  }

  /**
   * Handle update token image message
   *
   * @param state - Room state
   * @param tokenId - ID of token to update
   * @param senderUid - UID of player updating the token
   * @param imageUrl - New image URL
   * @returns Result indicating broadcast/save needs
   */
  handleUpdateImage(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    imageUrl: string,
  ): TokenMessageResult {
    const updated = this.tokenService.setImageUrl(state, tokenId, senderUid, imageUrl);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set token size message
   *
   * @param state - Room state
   * @param tokenId - ID of token to resize
   * @param senderUid - UID of player resizing the token
   * @param size - New size
   * @returns Result indicating broadcast/save needs
   */
  handleSetSize(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    size: TokenSize,
  ): TokenMessageResult {
    const updated = this.tokenService.setTokenSize(state, tokenId, senderUid, size);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set token color message
   *
   * @param state - Room state
   * @param tokenId - ID of token to recolor
   * @param senderUid - UID of player recoloring the token
   * @param color - New color (HSL format)
   * @param isDM - Whether sender is a DM
   * @returns Result indicating broadcast/save needs
   */
  handleSetColor(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    color: string,
    isDM: boolean,
  ): TokenMessageResult {
    const updated = isDM
      ? this.tokenService.setColorForToken(state, tokenId, color)
      : this.tokenService.setColor(state, tokenId, senderUid, color);

    return { broadcast: updated, save: updated };
  }

  /**
   * Handle link token to character message
   *
   * @param state - Room state
   * @param characterId - ID of character
   * @param tokenId - ID of token to link
   * @returns Result indicating broadcast/save needs
   */
  handleLinkToken(state: RoomState, characterId: string, tokenId: string): TokenMessageResult {
    const linked = this.characterService.linkToken(state, characterId, tokenId);
    return { broadcast: linked, save: linked };
  }

  /**
   * Handle clear all tokens message (DM only)
   *
   * Removes all tokens except DM's tokens and all players except the DM.
   * Cleans up selections for removed players.
   *
   * @param state - Room state
   * @param senderUid - UID of DM clearing tokens
   * @returns Result indicating broadcast/save needs
   */
  handleClearAll(state: RoomState, senderUid: string): TokenMessageResult {
    // Get IDs of tokens to be removed (all except sender's)
    const removedIds = state.tokens
      .filter((token) => token.owner !== senderUid)
      .map((token) => token.id);

    // Clear tokens except sender's
    this.tokenService.clearAllTokensExcept(state, senderUid);

    // Remove selections for deleted tokens
    for (const tokenId of removedIds) {
      this.selectionService.removeObject(state, tokenId);
    }

    // Get UIDs of players to be removed (all except sender)
    const removedPlayerUids = state.players
      .filter((player) => player.uid !== senderUid)
      .map((player) => player.uid);

    // Remove all players except sender (DM)
    state.players = state.players.filter((p) => p.uid === senderUid);

    // Deselect for removed players
    for (const uid of removedPlayerUids) {
      this.selectionService.deselect(state, uid);
    }

    return { broadcast: true, save: true };
  }
}
