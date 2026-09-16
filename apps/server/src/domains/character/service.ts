// ============================================================================
// CHARACTER DOMAIN - SERVICE
// ============================================================================
// Handles character-related business logic (Phase 1: PCs only)

import { randomUUID } from "crypto";
// The participation rule has ONE home (combatUtils.ts, shared): this file
// carried a private copy that drifted the moment the rule changed (F3).
import {
  isInInitiativeOrder,
  type Character,
  type NpcDisposition,
  type TokenSize,
} from "@herobyte/shared";
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
    options?: {
      hp?: number;
      tempHp?: number;
      tokenImage?: string;
      tokenSize?: TokenSize;
      disposition?: NpcDisposition;
    },
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
      tokenId: undefined,
      ownedByPlayerUID: undefined,
      tokenImage: tokenImage ?? null,
      // Only when given: a bare `tokenSize: undefined` would still be a key, and
      // a saved file is the character spread as-is.
      ...(options?.tokenSize ? { tokenSize: options.tokenSize } : {}),
      // Same rule. Absent means hostile for an NPC, and nothing at all for a PC.
      ...(options?.disposition ? { disposition: options.disposition } : {}),
      // Same rule again; 0 is a real value here, so the test is on undefined.
      ...(options?.tempHp !== undefined ? { tempHp: Math.max(0, options.tempHp) } : {}),
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
   * Update a character's portrait reference
   */
  setPortrait(state: RoomState, characterId: string, portrait?: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      return false;
    }

    const normalized = portrait?.trim();
    character.portrait = normalized && normalized.length > 0 ? normalized : undefined;
    return true;
  }

  /**
   * Set status effects for a character
   */
  setStatusEffects(state: RoomState, characterId: string, effects: string[]): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.statusEffects = [...effects];
      console.log(`Set status effects for ${character.name}:`, effects);
      return true;
    }
    return false;
  }

  /**
   * Update NPC metadata.
   *
   * NPC-only, and that is a guard rather than a comment: findCharacter does
   * not filter by type, and the line below used to set `type = "npc"`
   * unconditionally — so an update-npc carrying a PLAYER's id renamed their
   * character, rewrote its HP and portrait, and converted it into a DM-owned
   * NPC, irreversibly. No client can send that (the DM menu's editor only ever
   * addresses an NPC it found), so this is a wire-shaped hole rather than a
   * reachable bug — but the arc added `disposition` to the set of fields such a
   * message writes, and "no client sends it" is not a property the server gets
   * to rely on.
   */
  updateNPC(
    state: RoomState,
    tokenService: TokenService,
    characterId: string,
    updates: {
      name: string;
      hp: number;
      maxHp: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
      disposition?: NpcDisposition;
    },
  ): boolean {
    const character = this.findCharacter(state, characterId);
    if (!character || character.type !== "npc") {
      return false;
    }

    character.name = updates.name;
    character.maxHp = Math.max(0, updates.maxHp);
    character.hp = Math.min(character.maxHp, Math.max(0, updates.hp));
    character.portrait = updates.portrait || undefined;
    character.tokenImage = updates.tokenImage?.trim() || null;

    // Update initiative modifier if provided
    if (updates.initiativeModifier !== undefined) {
      character.initiativeModifier = updates.initiativeModifier;
    }

    // Temp HP, same shape. update-npc validated this and declared it on the
    // wire, and this method never wrote it — so the DM's Temp HP blur sent a
    // value the snapshot could never echo, and useNpcUpdate's watcher reported
    // "timed out" five seconds later over an edit that had otherwise landed.
    if (updates.tempHp !== undefined) {
      character.tempHp = Math.max(0, updates.tempHp);
    }

    // Set only when the message carried one: update-npc is a full-record send,
    // and an older client that has never heard of a stance must not silently
    // clear one the DM set from a newer tab.
    if (updates.disposition !== undefined) {
      character.disposition = updates.disposition;
    }

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
  /**
   * A reconnecting character's token. KEPT when linked and the token is in
   * state, or STASHED — a scene capture holds it and the link survives, so a
   * linked character is never re-tokened (no phantom). A link no scene holds
   * is DEAD (a table saved before `unlinkDeletedToken` shipped, or
   * `clearAllTokensExcept`, which still does not unlink): it is cleared and
   * the character is re-tokened like an unlinked one — the road it replaced
   * did that too, and losing it stranded legacy players (F4's review, round
   * 2). Unlinked: ADOPT the one token of the owner's that no character
   * claims — only while the owner runs exactly ONE PC, because with two the
   * adoption is a guess (the client rule's twin) — else spawn and link. "Any
   * token this uid owns" was the gate before: a DM owns the NPC tokens they
   * placed, so a DM who had deleted their own token never got one back (F3's
   * road, found by F4's review, round 1). Every road the client drives links
   * an NPC token to its NPC (placeNPCToken), so the loose set excludes them;
   * only a crafted `link-token` frame can orphan one.
   */
  ensureToken(
    state: RoomState,
    tokenService: TokenService,
    characterId: string,
    ownerUid: string,
    spawnAt: () => { x: number; y: number },
  ): RoomState["tokens"][number] | undefined {
    const character = this.findCharacter(state, characterId);
    if (!character) {
      return undefined;
    }
    if (character.tokenId) {
      const linked = character.tokenId;
      const live = state.tokens.find((t) => t.id === linked);
      if (live) {
        return live;
      }
      const stashed = Object.values(state.sceneStates).some((scene) =>
        scene.tokens.some((t) => t.id === linked),
      );
      if (stashed) {
        return undefined;
      }
      character.tokenId = null;
    }
    const ownedPcs = state.characters.filter(
      (c) => c.type === "pc" && c.ownedByPlayerUID === ownerUid,
    );
    const claimed = new Set(state.characters.flatMap((c) => (c.tokenId ? [c.tokenId] : [])));
    const loose =
      ownedPcs.length === 1
        ? state.tokens.filter((t) => t.owner === ownerUid && !claimed.has(t.id))
        : [];
    if (loose.length === 1) {
      this.linkToken(state, character.id, loose[0].id);
      return loose[0];
    }
    const spawn = spawnAt();
    const token = tokenService.createToken(state, ownerUid, spawn.x, spawn.y);
    this.linkToken(state, character.id, token.id);
    return token;
  }

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

    // Born at the size the NPC was created with (a library pick's default);
    // the token's own size stays editable, as ever.
    const token = tokenService.createToken(
      state,
      ownerUid,
      0,
      0,
      character.tokenImage ?? undefined,
      character.tokenSize ?? "medium",
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
   * Set initiative for a character
   */
  setInitiative(
    state: RoomState,
    characterId: string,
    initiative: number,
    initiativeModifier?: number,
  ): boolean {
    const characterIndex = state.characters.findIndex((c) => c.id === characterId);
    if (characterIndex === -1) {
      return false;
    }

    const character = state.characters[characterIndex];

    // Create a new character object to trigger React re-renders
    const updatedCharacter: Character = {
      ...character,
      initiative,
      initiativeModifier:
        initiativeModifier !== undefined ? initiativeModifier : character.initiativeModifier,
    };

    // Create a new array with the updated character to trigger React re-renders
    state.characters = [
      ...state.characters.slice(0, characterIndex),
      updatedCharacter,
      ...state.characters.slice(characterIndex + 1),
    ];

    console.log(
      `Set initiative for ${updatedCharacter.name}: ${initiative} (modifier: ${updatedCharacter.initiativeModifier ?? 0})`,
    );
    return true;
  }

  /**
   * Clear initiative for a specific character
   */
  clearInitiative(state: RoomState, characterId: string): boolean {
    const character = this.findCharacter(state, characterId);
    if (character) {
      character.initiative = undefined;
      console.log(`Cleared initiative for ${character.name}`);
      return true;
    }
    return false;
  }

  /**
   * Clear initiative for all characters
   */
  clearAllInitiative(state: RoomState): void {
    state.characters.forEach((character) => {
      character.initiative = undefined;
    });
    console.log("Cleared initiative for all characters");
  }

  /**
   * Get characters in initiative order (highest to lowest).
   * Tiebreaker: initiative > PC before NPC > creation order.
   *
   * **Business Rule**: membership is the shared isInInitiativeOrder (the
   * participation rule AND a roll) — the one spelling of "in the order", so
   * an exclusion added to the rule reaches this order through it. That the
   * order reads the helper at all is pinned by a test that mocks it.
   */
  getCharactersInInitiativeOrder(state: RoomState): Character[] {
    const indexMap = new Map<string, number>();
    state.characters.forEach((c, index) => indexMap.set(c.id, index));

    return state.characters
      .filter((c) => isInInitiativeOrder(c, state.players))
      .sort((a, b) => {
        const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
        if (initDiff !== 0) return initDiff;
        if (a.type === "pc" && b.type === "npc") return -1;
        if (a.type === "npc" && b.type === "pc") return 1;
        return (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0);
      });
  }

  /**
   * Set NPC visibility to players
   * @param state - Room state
   * @param npcId - ID of NPC to update
   * @param visible - Whether NPC should be visible to players
   * @returns true if visibility was set successfully
   */
  setNPCVisibility(state: RoomState, npcId: string, visible: boolean): boolean {
    const character = this.findCharacter(state, npcId);
    if (!character) {
      console.error(`Cannot set visibility: NPC ${npcId} not found`);
      return false;
    }

    if (character.type !== "npc") {
      console.error(`Cannot set visibility: Character ${npcId} is not an NPC`);
      return false;
    }

    character.visibleToPlayers = visible;
    console.log(`Set NPC ${character.name} visibility to players: ${visible}`);
    return true;
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
