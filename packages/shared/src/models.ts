// ============================================================================
// DOMAIN MODELS
// ============================================================================
// Domain model classes that encapsulate business logic and behavior.
// These complement the plain interfaces used for serialization.

import type { Token as IToken, Player as IPlayer, Character as ICharacter } from "./index.js";

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
  ) {}

  /**
   * Create from plain object (deserialization)
   */
  static fromJSON(data: IToken): TokenModel {
    return new TokenModel(data.id, data.owner, data.x, data.y, data.color);
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
    };
  }

  /**
   * Move token to new grid position
   */
  moveTo(x: number, y: number): TokenModel {
    return new TokenModel(this.id, this.owner, x, y, this.color);
  }

  /**
   * Change token color
   */
  recolor(newColor: string): TokenModel {
    return new TokenModel(this.id, this.owner, this.x, this.y, newColor);
  }

  /**
   * Snap to grid coordinates
   */
  snapToGrid(gridSize: number): TokenModel {
    const snappedX = Math.round(this.x / gridSize) * gridSize;
    const snappedY = Math.round(this.y / gridSize) * gridSize;
    return new TokenModel(this.id, this.owner, snappedX, snappedY, this.color);
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
    public isDM: boolean = false,
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
      data.isDM ?? false,
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
      isDM: this.isDM,
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
      this.isDM,
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
      this.isDM,
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
      this.isDM,
    );
  }

  /**
   * Update HP
   */
  setHP(hp: number, maxHp?: number): PlayerModel {
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      hp,
      maxHp ?? this.maxHp,
      this.isDM,
    );
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): PlayerModel {
    const newHp = Math.max(0, (this.hp ?? 0) - amount);
    return new PlayerModel(
      this.uid,
      this.name,
      this.portrait,
      this.micLevel,
      newHp,
      this.maxHp,
      this.isDM,
    );
  }

  /**
   * Heal
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
      this.isDM,
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
      isDM,
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
    public type: "pc" = "pc",
    public portrait?: string,
    public tokenId: string | null = null,
    public ownedByPlayerUID: string | null = null,
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
      (data.type ?? "pc") as "pc",
      data.portrait,
      data.tokenId ?? null,
      data.ownedByPlayerUID ?? null,
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
      type: this.type,
      portrait: this.portrait,
      tokenId: this.tokenId ?? undefined,
      ownedByPlayerUID: this.ownedByPlayerUID ?? undefined,
    };
  }

  /**
   * Update HP values
   */
  setHP(hp: number, maxHp: number = this.maxHp): CharacterModel {
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
    );
  }

  /**
   * Apply incoming damage
   */
  takeDamage(amount: number): CharacterModel {
    return this.setHP(this.hp - amount);
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
