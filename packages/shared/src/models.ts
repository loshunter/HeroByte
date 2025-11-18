// ============================================================================
// DOMAIN MODELS
// ============================================================================
// Domain model classes that encapsulate business logic and behavior.
// These complement the plain interfaces used for serialization.

import type {
  Token as IToken,
  Player as IPlayer,
  Character as ICharacter,
  TokenSize,
} from "./index.js";

/**
 * Token domain model
 * Encapsulates token behavior and validation
 */
export class TokenModel {
  constructor(
    public id: string,
    public owner: string,
    public x: number,
    public y: number,
    public color: string,
    public imageUrl?: string,
    public size: TokenSize = "medium",
  ) {}

  /**
   * Create from plain object (deserialization)
   */
  static fromJSON(data: IToken): TokenModel {
    return new TokenModel(
      data.id,
      data.owner,
      data.x,
      data.y,
      data.color,
      data.imageUrl,
      data.size ?? "medium",
    );
  }

  /**
   * Convert to plain object (serialization)
   */
  toJSON(): IToken {
    return {
      id: this.id,
      owner: this.owner,
      x: this.x,
      y: this.y,
      color: this.color,
      imageUrl: this.imageUrl,
      size: this.size,
    };
  }

  /**
   * Move token to new grid position
   */
  moveTo(x: number, y: number): TokenModel {
    return new TokenModel(this.id, this.owner, x, y, this.color, this.imageUrl, this.size);
  }

  /**
   * Change token color
   */
  recolor(newColor: string): TokenModel {
    return new TokenModel(this.id, this.owner, this.x, this.y, newColor, this.imageUrl, this.size);
  }

  /**
   * Snap to grid coordinates
   */
  snapToGrid(gridSize: number): TokenModel {
    const snappedX = Math.round(this.x / gridSize) * gridSize;
    const snappedY = Math.round(this.y / gridSize) * gridSize;
    return new TokenModel(
      this.id,
      this.owner,
      snappedX,
      snappedY,
      this.color,
      this.imageUrl,
      this.size,
    );
  }

  /**
   * Calculate distance to another token (in grid units)
   */
  distanceTo(other: TokenModel): number {
    return Math.sqrt(Math.pow(other.x - this.x, 2) + Math.pow(other.y - this.y, 2));
  }

  /**
   * Check if token is owned by a specific player
   */
  isOwnedBy(uid: string): boolean {
    return this.owner === uid;
  }

  /**
   * Generate a random color (HSL format)
   */
  static randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Assign or clear an image URL
   */
  setImage(url: string | undefined): TokenModel {
    return new TokenModel(this.id, this.owner, this.x, this.y, this.color, url, this.size);
  }

  /**
   * Change token size (Phase 11)
   */
  setSize(newSize: TokenSize): TokenModel {
    return new TokenModel(this.id, this.owner, this.x, this.y, this.color, this.imageUrl, newSize);
  }
}

/**
 * Player domain model
 * Encapsulates player state and behavior
 */
export class PlayerModel {
  constructor(
    public uid: string,
    public name: string,
    public portrait?: string,
    public micLevel?: number,
    public hp?: number,
    public maxHp?: number,
    public tempHp?: number,
    public isDM: boolean = false,
    public statusEffects: string[] = [],
  ) {}

  /**
   * Create from plain object (deserialization)
   */
  static fromJSON(data: IPlayer): PlayerModel {
    return new PlayerModel(
      data.uid,
      data.name,
      data.portrait,
      data.micLevel,
      data.hp,
      data.maxHp,
      data.tempHp,
      data.isDM ?? false,
      Array.isArray(data.statusEffects) ? [...data.statusEffects] : [],
    );
  }

  /**
   * Convert to plain object (serialization)
   */
  toJSON(): IPlayer {
    return {
      uid: this.uid,
      name: this.name,
      portrait: this.portrait,
      micLevel: this.micLevel,
      hp: this.hp,
      maxHp: this.maxHp,
      tempHp: this.tempHp,
      isDM: this.isDM,
      statusEffects: this.statusEffects.length > 0 ? [...this.statusEffects] : undefined,
    };
  }

  /**
   * Update player name
   */
  rename(newName: string): PlayerModel {
    return new PlayerModel(
      this.uid,
      newName,
      this.portrait,
      this.micLevel,
      this.hp,
      this.maxHp,
      this.tempHp,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Update player portrait
   */
  setPortrait(portraitData: string): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      portraitData,
      this.micLevel,
      this.hp,
      this.maxHp,
      this.tempHp,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Update microphone level (0-1)
   */
  setMicLevel(level: number): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      Math.max(0, Math.min(1, level)), // Clamp to 0-1
      this.hp,
      this.maxHp,
      this.tempHp,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Update HP and optionally tempHp
   */
  setHP(hp: number, maxHp?: number, tempHp?: number): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      hp,
      maxHp ?? this.maxHp,
      tempHp ?? this.tempHp,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Take damage (consumes tempHp first, then hp)
   */
  takeDamage(amount: number): PlayerModel {
    const currentTempHp = this.tempHp ?? 0;
    const currentHp = this.hp ?? 0;

    let remainingDamage = amount;
    let newTempHp = currentTempHp;
    let newHp = currentHp;

    // Consume temp HP first
    if (currentTempHp > 0) {
      const tempHpAbsorbed = Math.min(currentTempHp, remainingDamage);
      newTempHp = currentTempHp - tempHpAbsorbed;
      remainingDamage -= tempHpAbsorbed;
    }

    // Apply remaining damage to regular HP
    if (remainingDamage > 0) {
      newHp = Math.max(0, currentHp - remainingDamage);
    }

    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      newHp,
      this.maxHp,
      newTempHp > 0 ? newTempHp : undefined,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Heal (increases hp up to maxHp, does not affect tempHp)
   */
  heal(amount: number): PlayerModel {
    const newHp = Math.min(this.maxHp ?? Infinity, (this.hp ?? 0) + amount);
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      newHp,
      this.maxHp,
      this.tempHp,
      this.isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Check if player is alive
   */
  isAlive(): boolean {
    return this.hp === undefined || this.hp > 0;
  }

  /**
   * Get HP percentage (0-1)
   */
  getHPPercent(): number {
    if (this.hp === undefined || this.maxHp === undefined) return 1;
    return this.hp / this.maxHp;
  }

  /**
   * Check if microphone is active (above threshold)
   */
  isSpeaking(threshold: number = 0.1): boolean {
    return (this.micLevel ?? 0) > threshold;
  }

  /**
   * Toggle DM role flag
   */
  setDMMode(isDM: boolean): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      this.hp,
      this.maxHp,
      this.tempHp,
      isDM,
      [...this.statusEffects],
    );
  }

  /**
   * Replace status effects
   */
  setStatusEffects(effects: string[]): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      this.hp,
      this.maxHp,
      this.tempHp,
      this.isDM,
      [...effects],
    );
  }

  /**
   * Set temporary HP
   */
  setTempHP(tempHp: number): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      this.hp,
      this.maxHp,
      tempHp > 0 ? tempHp : undefined,
      this.isDM,
      [...this.statusEffects],
    );
  }
}

/**
 * Character domain model
 * Represents persistent character data shared between players
 */
export class CharacterModel {
  constructor(
    public id: string,
    public name: string,
    public hp: number,
    public maxHp: number,
    public type: "pc" | "npc" = "pc",
    public portrait?: string,
    public tokenId: string | null = null,
    public ownedByPlayerUID: string | null = null,
    public tokenImage: string | null = null,
    public tempHp?: number,
  ) {}

  /**
   * Create from plain object (deserialization)
   */
  static fromJSON(data: ICharacter): CharacterModel {
    return new CharacterModel(
      data.id,
      data.name,
      data.hp,
      data.maxHp,
      (data.type ?? "pc") === "npc" ? "npc" : "pc",
      data.portrait,
      data.tokenId ?? null,
      data.ownedByPlayerUID ?? null,
      data.tokenImage ?? null,
      data.tempHp,
    );
  }

  /**
   * Convert to plain object (serialization)
   */
  toJSON(): ICharacter {
    return {
      id: this.id,
      name: this.name,
      hp: this.hp,
      maxHp: this.maxHp,
      tempHp: this.tempHp,
      type: this.type,
      portrait: this.portrait,
      tokenId: this.tokenId ?? undefined,
      ownedByPlayerUID: this.ownedByPlayerUID ?? undefined,
      tokenImage: this.tokenImage ?? undefined,
    };
  }

  /**
   * Update HP values and optionally tempHp
   */
  setHP(hp: number, maxHp: number = this.maxHp, tempHp?: number): CharacterModel {
    const normalizedMaxHp = Math.max(0, maxHp);
    const normalizedHp = Math.min(normalizedMaxHp, Math.max(0, hp));

    return new CharacterModel(
      this.id,
      this.name,
      normalizedHp,
      normalizedMaxHp,
      this.type,
      this.portrait,
      this.tokenId,
      this.ownedByPlayerUID,
      this.tokenImage,
      tempHp ?? this.tempHp,
    );
  }

  /**
   * Apply incoming damage (consumes tempHp first, then hp)
   */
  takeDamage(amount: number): CharacterModel {
    const currentTempHp = this.tempHp ?? 0;
    const currentHp = this.hp;

    let remainingDamage = amount;
    let newTempHp = currentTempHp;
    let newHp = currentHp;

    // Consume temp HP first
    if (currentTempHp > 0) {
      const tempHpAbsorbed = Math.min(currentTempHp, remainingDamage);
      newTempHp = currentTempHp - tempHpAbsorbed;
      remainingDamage -= tempHpAbsorbed;
    }

    // Apply remaining damage to regular HP
    if (remainingDamage > 0) {
      newHp = Math.max(0, currentHp - remainingDamage);
    }

    return this.setHP(newHp, this.maxHp, newTempHp > 0 ? newTempHp : undefined);
  }

  /**
   * Heal character
   */
  heal(amount: number): CharacterModel {
    return this.setHP(this.hp + amount);
  }

  /**
   * Link the character to a token on the board
   */
  linkToken(tokenId: string | null): CharacterModel {
    return new CharacterModel(
      this.id,
      this.name,
      this.hp,
      this.maxHp,
      this.type,
      this.portrait,
      tokenId,
      this.ownedByPlayerUID,
      this.tokenImage,
      this.tempHp,
    );
  }

  /**
   * Claim character ownership by a player
   */
  claim(playerUid: string | null): CharacterModel {
    return new CharacterModel(
      this.id,
      this.name,
      this.hp,
      this.maxHp,
      this.type,
      this.portrait,
      this.tokenId,
      playerUid,
      this.tokenImage,
      this.tempHp,
    );
  }

  /**
   * Update base metadata
   */
  update(details: {
    name?: string;
    portrait?: string | null;
    hp?: number;
    maxHp?: number;
    tempHp?: number;
    type?: "pc" | "npc";
    tokenImage?: string | null;
  }): CharacterModel {
    const nextHp = details.hp ?? this.hp;
    const nextMaxHp = Math.max(0, details.maxHp ?? this.maxHp);
    const normalizedHp = Math.min(nextMaxHp, Math.max(0, nextHp));

    return new CharacterModel(
      this.id,
      details.name ?? this.name,
      normalizedHp,
      nextMaxHp,
      details.type ?? this.type,
      details.portrait === undefined ? this.portrait : details.portrait || undefined,
      this.tokenId,
      this.ownedByPlayerUID,
      details.tokenImage === undefined ? this.tokenImage : details.tokenImage?.trim() || null,
      details.tempHp ?? this.tempHp,
    );
  }

  /**
   * Set the token image reference
   */
  setTokenImage(imageUrl: string | null): CharacterModel {
    return new CharacterModel(
      this.id,
      this.name,
      this.hp,
      this.maxHp,
      this.type,
      this.portrait,
      this.tokenId,
      this.ownedByPlayerUID,
      imageUrl && imageUrl.trim().length > 0 ? imageUrl.trim() : null,
      this.tempHp,
    );
  }

  /**
   * Set temporary HP
   */
  setTempHP(tempHp: number): CharacterModel {
    return new CharacterModel(
      this.id,
      this.name,
      this.hp,
      this.maxHp,
      this.type,
      this.portrait,
      this.tokenId,
      this.ownedByPlayerUID,
      this.tokenImage,
      tempHp > 0 ? tempHp : undefined,
    );
  }

  /**
   * Check if character is defeated
   */
  isDead(): boolean {
    return this.hp <= 0;
  }

  /**
   * Percentage HP remaining (0-1)
   */
  getHPPercent(): number {
    if (this.maxHp === 0) return 0;
    return this.hp / this.maxHp;
  }
}
