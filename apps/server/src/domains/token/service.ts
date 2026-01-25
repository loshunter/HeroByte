// ============================================================================
// TOKEN DOMAIN - SERVICE
// ============================================================================
// Handles token-related business logic

import { randomUUID } from "crypto";
import type { Token, TokenSize } from "@shared";
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
    size: TokenSize = "medium",
  ): Token {
    const newToken: Token = {
      id: randomUUID(),
      owner: ownerUid,
      x,
      y,
      color: this.randomColor(),
      imageUrl,
      size,
    };

    state.tokens.push(newToken);
    console.log("Spawned token", newToken);
    return newToken;
  }

  /**
   * Move a token (with ownership validation or DM override)
   */
  moveToken(state: RoomState, tokenId: string, ownerUid: string, x: number, y: number, isDM: boolean = false): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token && (token.owner === ownerUid || isDM)) {
      token.x = x;
      token.y = y;
      return true;
    }
    return false;
  }

  /**
   * Change token color (with ownership validation or DM override)
   */
  recolorToken(state: RoomState, tokenId: string, ownerUid: string, isDM: boolean = false): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token && (token.owner === ownerUid || isDM)) {
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
   * Update or clear a token image (with ownership validation or DM override)
   */
  setImageUrl(state: RoomState, tokenId: string, ownerUid: string, imageUrl: string, isDM: boolean = false): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token && (token.owner === ownerUid || isDM)) {
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
   * Update token color explicitly (with ownership validation or DM override)
   */
  setColor(state: RoomState, tokenId: string, ownerUid: string, color: string, isDM: boolean = false): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token && (token.owner === ownerUid || isDM)) {
      const trimmed = color.trim();
      if (trimmed.length === 0) {
        return false;
      }
      token.color = trimmed;
      return true;
    }
    return false;
  }

  /**
   * Update token color without ownership checks (DM/admin actions)
   */
  setColorForToken(state: RoomState, tokenId: string, color: string): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token) {
      const trimmed = color.trim();
      if (trimmed.length === 0) {
        return false;
      }
      token.color = trimmed;
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

  /**
   * Set token size (with ownership and lock validation) - Phase 11
   */
  setTokenSize(state: RoomState, tokenId: string, ownerUid: string, size: TokenSize): boolean {
    const token = state.tokens.find((t) => t.id === tokenId && t.owner === ownerUid);
    if (token && !token.locked) {
      token.size = size;
      return true;
    }
    return false;
  }

  /**
   * Set token size without ownership checks (DM/admin actions) - Phase 11
   */
  setTokenSizeByDM(state: RoomState, tokenId: string, size: TokenSize): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token) {
      token.size = size;
      return true;
    }
    return false;
  }
}
