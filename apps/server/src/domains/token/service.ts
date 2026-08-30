// ============================================================================
// TOKEN DOMAIN - SERVICE
// ============================================================================
// Handles token-related business logic

import { randomUUID } from "crypto";
import type { Token, TokenSize } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { isTokenMoveBlocked } from "../room/scene/movementBlocking.js";

/**
 * Token service - manages tokens on the map
 */
export class TokenService {
  /**
   * The generator is injected with a production default, matching the dice
   * roller's `rng: DiceRng = cryptoDiceRng` shape. Token colour is cosmetic,
   * so `Math.random` is the right source here — what the seam buys is a
   * DETERMINISTIC test, not unpredictability.
   *
   * The default CALLS Math.random rather than capturing the reference: bound
   * at construction, a later `vi.spyOn(Math, "random")` would no longer reach
   * it, silently breaking every existing test that mocks it that way.
   */
  constructor(private readonly rng: () => number = () => Math.random()) {}

  /**
   * Generate a random HSL color for tokens
   */
  private randomColor(): string {
    return colorForHue(Math.floor(this.rng() * 360));
  }

  /**
   * A colour that is never the one already showing.
   *
   * The old version drew freely from 360 hues, so one recolour in 360 landed
   * on the hue it started from and the button visibly did nothing. Drawing an
   * OFFSET of 1..359 instead is uniform over every hue EXCEPT the current one,
   * so "recolour" always recolours — no re-roll loop, which could repeat.
   *
   * A colour we cannot parse (not one of ours) has no hue to avoid, so it
   * falls back to a free draw.
   */
  private recolorFrom(current: string): string {
    const hue = hueOf(current);
    if (hue === null) return this.randomColor();
    return colorForHue((hue + 1 + Math.floor(this.rng() * 359)) % 360);
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
   * The most restrictive sight limit among the tokens this owner already has,
   * or undefined when none of them is limited.
   */
  private tightestVisionRadius(state: RoomState, ownerUid: string): number | undefined {
    let tightest: number | undefined;
    for (const token of state.tokens) {
      if (token.owner !== ownerUid) continue;
      if (typeof token.visionRadius !== "number") continue;
      if (tightest === undefined || token.visionRadius < tightest) {
        tightest = token.visionRadius;
      }
    }
    return tightest;
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
    // Inherit the owner's tightest existing sight limit (S7). A radius is
    // DM-authored and is supposed to only ever NARROW what a player can see —
    // but it lives on ONE token record, and vision is the UNION over every
    // token that player owns. Without this, a player who clicks "+ Add
    // Character" (not DM-gated, and it spawns a second token) gets an
    // unclipped polygon and the darkness the DM set is simply gone, with no
    // signal to the DM. Inheriting the MINIMUM fails closed.
    //
    // A player with NO token left to inherit from is caught by the ROOM
    // default, resolved at read time in visionFilter — but only on a table
    // whose DM has set one. Where defaultVisionRadius is null (the shipped
    // value, and every table until someone opens the Map tab) the S7 gap is
    // exactly as wide as it was: delete your only token, reconnect, see
    // everything.
    const inherited = this.tightestVisionRadius(state, ownerUid);
    if (inherited !== undefined) {
      newToken.visionRadius = inherited;
    }

    state.tokens.push(newToken);
    console.log("Spawned token", newToken);
    return newToken;
  }

  /**
   * Move a token (with ownership validation or DM override).
   *
   * Compiled walls and shut doors are physically real for players: a move
   * whose straight path crosses a blocking segment is refused. The DM moves
   * anything anywhere.
   */
  moveToken(
    state: RoomState,
    tokenId: string,
    ownerUid: string,
    x: number,
    y: number,
    isDM: boolean = false,
  ): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (!token || (token.owner !== ownerUid && !isDM)) {
      return false;
    }
    if (!isDM && isTokenMoveBlocked(state, { x: token.x, y: token.y }, { x, y })) {
      return false;
    }
    token.x = x;
    token.y = y;
    return true;
  }

  /**
   * Change token color (with ownership validation or DM override)
   */
  recolorToken(
    state: RoomState,
    tokenId: string,
    ownerUid: string,
    isDM: boolean = false,
  ): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (token && (token.owner === ownerUid || isDM)) {
      token.color = this.recolorFrom(token.color);
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
  setImageUrl(
    state: RoomState,
    tokenId: string,
    ownerUid: string,
    imageUrl: string,
    isDM: boolean = false,
  ): boolean {
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
  setColor(
    state: RoomState,
    tokenId: string,
    ownerUid: string,
    color: string,
    isDM: boolean = false,
  ): boolean {
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
   * Set a token's sight limit in feet, or clear it back to unlimited (S7).
   *
   * DM ONLY, and not by copying a permission from a neighbour: a vision radius
   * can only ever NARROW what the walls already allow, so a player able to
   * clear their own would simply undo the darkness the DM authored. That makes
   * this closer to a scene setting than to token colour, and the gate belongs
   * with the DM.
   *
   * `null` deletes the field rather than storing a sentinel, so "unlimited" has
   * exactly one representation on the wire, on disk and in the cache key.
   */
  setVisionRadius(state: RoomState, tokenId: string, radius: number | null): boolean {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (!token) {
      return false;
    }
    if (radius === null) {
      delete token.visionRadius;
    } else {
      token.visionRadius = radius;
    }
    return true;
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

/** The one place a token colour string is built, so parsing can mirror it. */
function colorForHue(hue: number): string {
  return `hsl(${hue}, 70%, 50%)`;
}

/** The hue of a colour this service produced, or null for anything else. */
function hueOf(color: string): number | null {
  const match = /^hsl\((\d{1,3}), 70%, 50%\)$/.exec(color);
  if (!match) return null;
  const hue = Number(match[1]);
  return Number.isInteger(hue) && hue >= 0 && hue < 360 ? hue : null;
}
