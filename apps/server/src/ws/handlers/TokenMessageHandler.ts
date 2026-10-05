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

import type { DragPreviewEvent, DragPreviewUpdate, Token, TokenSize } from "@herobyte/shared";
import { isDeltaChannelEnabled } from "../../config/featureFlags.js";
import { buildTokenDragPreview } from "./tokenDragPreview.js";
import { chargeTokenMove } from "../../domains/room/transform/movementCharge.js";
import { isTokenLocked, type LockRefusal } from "../../domains/room/locking/pieceLock.js";
import type { RoomState } from "../../domains/room/model.js";
import type { TokenService } from "../../domains/token/service.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import type { RoomService } from "../../domains/room/service.js";
import type { PendingDelta } from "../types.js";

/**
 * Result of handling a token message
 */
export interface TokenMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
  /** Optional delta payload describing targeted updates */
  delta?: PendingDelta;
  /** The piece lock stopped this action: the router tells the sender (the DM or owner only). */
  lockRefusal?: LockRefusal;
}

const lockedToken = (tokenId: string): LockRefusal => ({ ids: [`token:${tokenId}`] });
const mayActOn = (state: RoomState, tokenId: string, senderUid: string, isDM: boolean) =>
  isDM || state.tokens.find((t) => t.id === tokenId)?.owner === senderUid;

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
   * @param isDM - Whether sender is a DM
   */
  handleMove(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    x: number,
    y: number,
    isDM: boolean,
  ): TokenMessageResult {
    const before = state.tokens.find((t) => t.id === tokenId);
    const previousCell = before ? { x: before.x, y: before.y } : undefined;
    const moved = this.tokenService.moveToken(state, tokenId, senderUid, x, y, isDM);
    // A charge lives on the CHARACTER, which the token delta cannot carry —
    // so a charged step forces the full snapshot (and a save) the delta road
    // otherwise skips.
    const charged =
      Boolean(moved && previousCell) && chargeTokenMove(state, tokenId, previousCell!, { x, y });
    const deltasEnabled = isDeltaChannelEnabled();
    let delta: PendingDelta | undefined;
    const token = state.tokens.find((t) => t.id === tokenId) as Token | undefined;
    // A charged move rides the full snapshot alone — a delta beside it would
    // build every hidden-monster recipient's frame twice for one move.
    if (deltasEnabled && token && !charged) {
      // A refused move (blocked by a wall/door or unauthorized) still emits
      // the token's authoritative position so optimistic clients snap back.
      delta = { t: "token-updated", token, previousCell };
    }
    const result = { broadcast: deltasEnabled ? charged : moved, save: charged, delta };
    return isTokenLocked(state, tokenId) && mayActOn(state, tokenId, senderUid, isDM)
      ? { ...result, broadcast: true, lockRefusal: lockedToken(tokenId) }
      : result;
  }

  /**
   * Build a drag preview payload without mutating state.
   * Delegates to tokenDragPreview.ts — extracted for the structural
   * guardrail; the public seam here is unchanged.
   */
  buildDragPreview(
    state: RoomState,
    senderUid: string,
    updates: DragPreviewUpdate[],
    isDM: boolean,
  ): DragPreviewEvent | null {
    return buildTokenDragPreview(state, senderUid, updates, isDM);
  }

  /**
   * Handle token recolor message
   *
   * @param state - Room state
   * @param tokenId - ID of token to recolor
   * @param senderUid - UID of player recoloring the token
   * @param isDM - Whether sender is a DM
   */
  handleRecolor(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    isDM: boolean,
  ): TokenMessageResult {
    const recolored = this.tokenService.recolorToken(state, tokenId, senderUid, isDM);
    return { broadcast: recolored, save: false };
  }

  /**
   * Handle token delete message
   *
   * @param state - Room state
   * @param tokenId - ID of token to delete
   * @param senderUid - UID of player deleting the token
   * @param isDM - Whether sender is a DM
   */
  handleDelete(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    isDM: boolean,
  ): TokenMessageResult {
    // A locked token is deleted by no one, the DM included, until it is unlocked.
    if (isTokenLocked(state, tokenId)) {
      return mayActOn(state, tokenId, senderUid, isDM)
        ? { broadcast: false, save: false, lockRefusal: lockedToken(tokenId) }
        : { broadcast: false, save: false };
    }
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
   * @param isDM - Whether sender is a DM
   */
  handleUpdateImage(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    imageUrl: string,
    isDM: boolean,
  ): TokenMessageResult {
    const updated = this.tokenService.setImageUrl(state, tokenId, senderUid, imageUrl, isDM);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set token size message (owner, or DM override)
   *
   * @param state - Room state
   * @param tokenId - ID of token to resize
   * @param senderUid - UID of player resizing the token
   * @param size - New size
   * @param isDM - Whether sender is DM
   */
  handleSetSize(
    state: RoomState,
    tokenId: string,
    senderUid: string,
    size: TokenSize,
    isDM: boolean,
  ): TokenMessageResult {
    // The DM path existed as TokenService.setTokenSizeByDM and was never
    // wired, leaving size the ONE token mutation a DM could not override
    // while move/recolor/delete/image/color all took owner-or-DM.
    if (isTokenLocked(state, tokenId)) {
      // A resize is a change to the piece: refused like a move. The broadcast puts the
      // size back on a client that already showed the new one.
      return mayActOn(state, tokenId, senderUid, isDM)
        ? { broadcast: true, save: false, lockRefusal: lockedToken(tokenId) }
        : { broadcast: false, save: false };
    }
    const updated = isDM
      ? this.tokenService.setTokenSizeByDM(state, tokenId, size)
      : this.tokenService.setTokenSize(state, tokenId, senderUid, size);
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
      : this.tokenService.setColor(state, tokenId, senderUid, color, isDM);

    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set token vision radius message (DM only — see TokenService).
   *
   * @param isDM - Whether sender is a DM; a non-DM change is refused outright
   */
  handleSetVisionRadius(
    state: RoomState,
    tokenId: string,
    radius: number | null,
    isDM: boolean,
  ): TokenMessageResult {
    if (!isDM) {
      return { broadcast: false, save: false };
    }
    const updated = this.tokenService.setVisionRadius(state, tokenId, radius);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle link token to character message (owner of BOTH ends, or DM)
   *
   * @param state - Room state
   * @param characterId - ID of character
   * @param tokenId - ID of token to link
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   */
  handleLinkToken(
    state: RoomState,
    characterId: string,
    tokenId: string,
    senderUid: string,
    isDM: boolean,
  ): TokenMessageResult {
    // Nothing in the client sends this today, which is exactly why it must
    // be gated: the only possible senders are crafted frames, and it had no
    // check at all. Linking rebinds which token a character record follows —
    // HP display, turn focus, vision all key off it — so a non-DM needs to
    // own BOTH ends, not either.
    if (!isDM) {
      const token = state.tokens.find((candidate) => candidate.id === tokenId);
      const character = state.characters.find((candidate) => candidate.id === characterId);
      const ownsToken = token !== undefined && token.owner === senderUid;
      const ownsCharacter = character !== undefined && character.ownedByPlayerUID === senderUid;
      if (!ownsToken || !ownsCharacter) {
        return { broadcast: false, save: false };
      }
    }
    const linked = this.characterService.linkToken(state, characterId, tokenId);
    return { broadcast: linked, save: linked };
  }

  /**
   * Handle clear all tokens message (DM only): removes every token but the DM's
   * (a locked one stays, passed to the DM) and every player but the DM, with
   * their selections.
   *
   * @param state - Room state
   * @param senderUid - UID of DM clearing tokens
   */
  handleClearAll(state: RoomState, senderUid: string): TokenMessageResult {
    // Get IDs of tokens to be removed (all except sender's); a locked one stays.
    const removedIds = state.tokens
      .filter((token) => token.owner !== senderUid && !isTokenLocked(state, token.id))
      .map((token) => token.id);
    const keptLocked = state.tokens
      .filter((token) => token.owner !== senderUid && isTokenLocked(state, token.id))
      .map((token) => `token:${token.id}`);

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

    // Remove all players except sender (DM); a kept locked token passes to the DM.
    for (const token of state.tokens) if (token.owner !== senderUid) token.owner = senderUid;
    state.players = state.players.filter((p) => p.uid === senderUid);

    // Deselect for removed players
    for (const uid of removedPlayerUids) {
      this.selectionService.deselect(state, uid);
    }

    return keptLocked.length > 0
      ? { broadcast: true, save: true, lockRefusal: { ids: keptLocked, kept: true } }
      : { broadcast: true, save: true };
  }
}
