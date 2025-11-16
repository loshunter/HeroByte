/**
 * SnapshotBuilder - Test Utility for Building RoomSnapshots
 *
 * SINGLE RESPONSIBILITY: Build valid RoomSnapshot objects with fluent API for testing.
 *
 * DOES:
 * - Provides sensible defaults for all RoomSnapshot fields
 * - Offers fluent methods to customize specific fields
 * - Returns immutable snapshot objects
 *
 * DOES NOT:
 * - Validate business logic (that's tested in SnapshotLoader.test.ts)
 * - Mutate existing snapshots (only builds new ones)
 * - Handle assertions (use test framework assertions)
 * - Manage WebSocket communication (see MockWebSocketClient)
 *
 * Example usage:
 * ```ts
 * const snapshot = new SnapshotBuilder()
 *   .withGridSize(60)
 *   .withCharacter({ id: "char-1", name: "Gandalf" })
 *   .withToken({ id: "token-1", characterId: "char-1", x: 10, y: 10 })
 *   .build();
 * ```
 *
 * Following SOLID principles:
 * - SRP: Only builds snapshots (doesn't validate, assert, or communicate)
 * - OCP: Extensible via new with* methods without modifying core logic
 * - LSP: N/A (not using inheritance)
 * - ISP: Single focused interface (builder methods + build)
 * - DIP: Depends on @shared types (abstractions), not concrete implementations
 */

import type {
  RoomSnapshot,
  Character,
  Token,
  Player,
  Prop,
  Drawing,
  SceneObject,
  DiceRoll,
  Pointer,
  PlayerStagingZone,
} from "@shared";

export class SnapshotBuilder {
  private snapshot: RoomSnapshot;

  constructor() {
    // Sensible defaults for minimal valid snapshot
    this.snapshot = {
      users: [],
      tokens: [],
      players: [],
      characters: [],
      props: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      gridSquareSize: 5,
      diceRolls: [],
      sceneObjects: [],
      combatActive: false,
    };
  }

  /**
   * Set grid size (in pixels per grid square)
   */
  withGridSize(gridSize: number): this {
    this.snapshot.gridSize = gridSize;
    return this;
  }

  /**
   * Set grid square size (feet per square, usually 5ft for D&D)
   */
  withGridSquareSize(gridSquareSize: number): this {
    this.snapshot.gridSquareSize = gridSquareSize;
    return this;
  }

  /**
   * Add a character to the snapshot
   * Provides defaults for all required fields
   */
  withCharacter(partial: Partial<Character> & { id: string; name: string }): this {
    const character: Character = {
      type: "pc",
      hp: 100,
      maxHp: 100,
      ownedByPlayerUID: null,
      ...partial,
    };
    this.snapshot.characters.push(character);
    return this;
  }

  /**
   * Add multiple characters at once
   */
  withCharacters(characters: Array<Partial<Character> & { id: string; name: string }>): this {
    characters.forEach((char) => this.withCharacter(char));
    return this;
  }

  /**
   * Add a token to the snapshot
   * Provides defaults for all required fields
   */
  withToken(partial: Partial<Token> & { id: string; x: number; y: number; owner?: string }): this {
    const token: Token = {
      owner: "player-default",
      color: "hsl(120, 70%, 50%)",
      ...partial,
    };
    this.snapshot.tokens.push(token);
    return this;
  }

  /**
   * Add multiple tokens at once
   */
  withTokens(tokens: Array<Partial<Token> & { id: string; x: number; y: number }>): this {
    tokens.forEach((token) => this.withToken(token));
    return this;
  }

  /**
   * Add a player to the snapshot
   * Provides defaults for all required fields
   */
  withPlayer(partial: Partial<Player> & { uid: string; name: string }): this {
    const player: Player = {
      portrait: "",
      micLevel: 0,
      lastHeartbeat: Date.now(),
      hp: 100,
      maxHp: 100,
      isDM: false,
      statusEffects: [],
      ...partial,
    };
    this.snapshot.players.push(player);
    return this;
  }

  /**
   * Add multiple players at once
   */
  withPlayers(players: Array<Partial<Player> & { uid: string; name: string }>): this {
    players.forEach((player) => this.withPlayer(player));
    return this;
  }

  /**
   * Add a prop to the snapshot
   */
  withProp(partial: Partial<Prop> & { id: string; label: string; x: number; y: number }): this {
    const prop: Prop = {
      imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E",
      owner: null,
      size: "medium",
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      ...partial,
    };
    this.snapshot.props = this.snapshot.props || [];
    this.snapshot.props.push(prop);
    return this;
  }

  /**
   * Add a drawing to the snapshot
   */
  withDrawing(
    partial: Partial<Drawing> & { id: string; type: Drawing["type"]; points: Drawing["points"] },
  ): this {
    const drawing: Drawing = {
      color: "#000000",
      width: 2,
      opacity: 1,
      owner: "player-default",
      ...partial,
    };
    this.snapshot.drawings.push(drawing);
    return this;
  }

  /**
   * Add a scene object to the snapshot
   * Note: Due to SceneObject being a discriminated union with required type-specific data,
   * you must provide the complete object. Use the specific scene data builders for convenience.
   */
  withSceneObject(sceneObject: SceneObject): this {
    this.snapshot.sceneObjects = this.snapshot.sceneObjects || [];
    this.snapshot.sceneObjects.push(sceneObject);
    return this;
  }

  /**
   * Add a dice roll to the snapshot
   */
  withDiceRoll(
    partial: Partial<DiceRoll> & {
      id: string;
      playerUid: string;
      playerName: string;
      formula: string;
    },
  ): this {
    const diceRoll: DiceRoll = {
      timestamp: Date.now(),
      breakdown: [{ tokenId: "default-token", subtotal: 10 }],
      total: 10,
      ...partial,
    };
    this.snapshot.diceRolls.push(diceRoll);
    return this;
  }

  /**
   * Add a pointer to the snapshot
   */
  withPointer(partial: Partial<Pointer> & { id: string; uid: string; name: string }): this {
    const pointer: Pointer = {
      x: 0,
      y: 0,
      timestamp: Date.now(),
      ...partial,
    };
    this.snapshot.pointers.push(pointer);
    return this;
  }

  /**
   * Set the map background image
   */
  withMapBackground(mapBackground: string): this {
    this.snapshot.mapBackground = mapBackground;
    return this;
  }

  /**
   * Set the player staging zone
   */
  withPlayerStagingZone(stagingZone: PlayerStagingZone): this {
    this.snapshot.playerStagingZone = stagingZone;
    return this;
  }

  /**
   * Set combat active state
   */
  withCombatActive(active: boolean): this {
    this.snapshot.combatActive = active;
    return this;
  }

  /**
   * Set the current turn character ID
   */
  withCurrentTurnCharacter(characterId: string): this {
    this.snapshot.currentTurnCharacterId = characterId;
    return this;
  }

  /**
   * Add legacy user UIDs (deprecated, but still supported)
   */
  withUsers(users: string[]): this {
    this.snapshot.users = users;
    return this;
  }

  /**
   * Build and return the final snapshot
   * Returns a deep copy to prevent mutation
   */
  build(): RoomSnapshot {
    // Deep copy to prevent mutation of builder state
    return JSON.parse(JSON.stringify(this.snapshot));
  }

  /**
   * Reset the builder to initial state (useful for building multiple snapshots)
   */
  reset(): this {
    this.snapshot = {
      users: [],
      tokens: [],
      players: [],
      characters: [],
      props: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      gridSquareSize: 5,
      diceRolls: [],
      sceneObjects: [],
      combatActive: false,
    };
    return this;
  }
}
