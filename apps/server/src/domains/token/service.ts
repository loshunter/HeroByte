// ============================================================================
// TOKEN DOMAIN - SERVICE
// ============================================================================
// Handles token-related business logic

import { randomUUID } from "crypto";
import type { Token } from "@shared";
import type { RoomState } from "../room/model.js";

/**
 * Token service - manages tokens on the map
 */
export class TokenService {
  /**
   * Generate a random HSL color for tokens
   */
  private randomColor(): string {
    return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
  }

  /**
   * Find token by ID
   */
  findToken(state: RoomState, tokenId: string): Token | undefined {
    return state.tokens.find((t) => t.id === tokenId);
  }

  /**
   * Find token by owner UID
   */
  findTokenByOwner(state: RoomState, ownerUid: string): Token | undefined {
    return state.tokens.find((t) => t.owner === ownerUid);
  }

  /**
   * Create a new token for a player
   */
  createToken(
    state: RoomState,
    ownerUid: string,
    x: number = 0,
    y: number = 0,
    imageUrl?: string,
  ): Token {
    const newToken: Token = {
      id: randomUUID(),
      owner: ownerUid,
      x,
      y,
      color: this.randomColor(),
      imageUrl,
    };

    state.tokens.push(newToken);
    console.log("Spawned token", newToken);
    return newToken;
  }

  /**
   * Move a token (with ownership validation)
   */
  moveToken(state: RoomState, tokenId: string, ownerUid: string, x: number, y: number): boolean {
    const token = state.tokens.find((t) => t.id === tokenId && t.owner === ownerUid);
    if (token) {
      token.x = x;
      token.y = y;
      return true;
    }
    return false;
  }

  /**
   * Change token color (with ownership validation)
   */
  recolorToken(state: RoomState, tokenId: string, ownerUid: string): boolean {
    const token = state.tokens.find((t) => t.id === tokenId && t.owner === ownerUid);
    if (token) {
      token.color = this.randomColor();
      return true;
    }
    return false;
  }

  /**
   * Delete a token (with ownership validation)
   */
  deleteToken(state: RoomState, tokenId: string, ownerUid: string): boolean {
    const index = state.tokens.findIndex((t) => t.id === tokenId && t.owner === ownerUid);
    if (index !== -1) {
      state.tokens.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Delete a token without ownership checks (DM/admin actions)
   */
  forceDeleteToken(state: RoomState, tokenId: string): boolean {
    const index = state.tokens.findIndex((t) => t.id === tokenId);
    if (index !== -1) {
      state.tokens.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update or clear a token image (with ownership validation)
   */
  setImageUrl(state: RoomState, tokenId: string, ownerUid: string, imageUrl: string): boolean {
    const token = state.tokens.find((t) => t.id === tokenId && t.owner === ownerUid);
    if (token) {
      const trimmed = imageUrl.trim();
      token.imageUrl = trimmed.length > 0 ? trimmed : undefined;
      return true;
    }
    return false;
  }

  /**
   * Update token image without ownership validation (DM/admin actions)
   */
  setImageUrlForToken(state: RoomState, tokenId: string, imageUrl?: string): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token) {
      const trimmed = imageUrl?.trim() ?? "";
      token.imageUrl = trimmed.length > 0 ? trimmed : undefined;
      return true;
    }
    return false;
  }

  /**
   * Remove all tokens except those owned by specified UID
   */
  clearAllTokensExcept(state: RoomState, keepOwnerUid: string): void {
    state.tokens = state.tokens.filter((t) => t.owner === keepOwnerUid);
  }
}
