/**
 * StatePersistence
 *
 * Handles file I/O operations for game state persistence. Manages loading state
 * from disk on server startup and saving state after every change.
 *
 * Extracted from: apps/server/src/domains/room/service.ts (lines 14, 47-88, 94-113)
 * Extraction date: 2025-11-14
 *
 * @module domains/room/persistence/StatePersistence
 */

import { readFileSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import type { Player, Character, SceneObject } from "@shared";
import type { RoomState } from "../model.js";
import { createSelectionMap } from "../model.js";
import type { StagingZoneManager } from "../staging/StagingZoneManager.js";

/**
 * Default file path for state persistence
 */
const DEFAULT_STATE_FILE = "./herobyte-state.json";

/**
 * Manages room state persistence to/from disk.
 *
 * Features:
 * - Synchronous load on startup (blocking)
 * - Asynchronous save during runtime (non-blocking, fire-and-forget)
 * - Data normalization during load
 * - Selective field persistence (excludes ephemeral data)
 */
export class StatePersistence {
  private readonly stateFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  /**
   * Creates a new StatePersistence instance.
   *
   * @param getState - Function to get current room state
   * @param setState - Function to update room state
   * @param stagingManager - Staging zone manager for zone sanitization
   * @param onStateLoaded - Callback to invoke after state is loaded (e.g., to rebuild scene graph)
   * @param stateFile - Optional custom state file path (defaults to "./herobyte-state.json")
   */
  constructor(
    private getState: () => RoomState,
    private setState: (state: RoomState) => void,
    private stagingManager: StagingZoneManager,
    private onStateLoaded?: () => void,
    stateFile: string = DEFAULT_STATE_FILE,
  ) {
    this.stateFile = stateFile;
  }

  /**
   * Loads game state from disk synchronously.
   *
   * Called during server startup to restore previous session data.
   * Uses blocking I/O (readFileSync) which is acceptable only on cold start.
   *
   * Behavior:
   * - If file doesn't exist: Silent no-op, state remains as initialized
   * - If JSON is corrupted: Logs error, state remains unchanged
   * - Normalizes player/character data during deserialization
   * - Always resets ephemeral fields (users, pointers, undo/redo stacks, selections)
   * - Calls onStateLoaded callback after loading (typically rebuilds scene graph)
   *
   * @example
   * ```typescript
   * const persistence = new StatePersistence(state, stagingManager, () => rebuildSceneGraph());
   * persistence.loadFromDisk(); // Blocks until file is read
   * ```
   */
  loadFromDisk(): void {
    if (existsSync(this.stateFile)) {
      try {
        const data = JSON.parse(readFileSync(this.stateFile, "utf-8"));
        const sceneObjects: SceneObject[] = data.sceneObjects || [];

        // Replace entire state with loaded data
        const loadedState: RoomState = {
          users: [], // Don't persist users - they reconnect
          tokens: data.tokens || [],
          players: (data.players || []).map((player: Player) => ({
            ...player,
            isDM: player.isDM ?? false,
            statusEffects: Array.isArray(player.statusEffects) ? [...player.statusEffects] : [],
          })),
          characters: (data.characters || []).map((character: Character) => ({
            ...character,
            type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
            tokenImage: character.tokenImage ?? undefined,
            tokenId: character.tokenId ?? undefined,
          })),
          props: data.props || [],
          mapBackground: data.mapBackground,
          pointers: [], // Don't persist pointers - they expire
          drawings: data.drawings || [],
          gridSize: data.gridSize || 50,
          gridSquareSize: data.gridSquareSize || 5,
          diceRolls: data.diceRolls || [],
          drawingUndoStacks: {},
          drawingRedoStacks: {},
          sceneObjects,
          selectionState: createSelectionMap(),
          playerStagingZone: this.stagingManager.sanitize(data.playerStagingZone),
          combatActive: data.combatActive ?? false,
          currentTurnCharacterId: data.currentTurnCharacterId ?? undefined,
        };

        this.setState(loadedState);

        // Trigger scene graph rebuild
        this.onStateLoaded?.();

        console.log("Loaded state from disk");
      } catch (err) {
        console.error("Failed to load state:", err);
      }
    }
  }

  /**
   * Saves game state to disk asynchronously.
   *
   * Called after every state change (via broadcast). Uses fire-and-forget pattern
   * to prevent blocking the event loop during gameplay.
   *
   * Persisted fields:
   * - tokens, players, characters, props
   * - mapBackground, drawings
   * - gridSize, gridSquareSize
   * - diceRolls, sceneObjects
   * - playerStagingZone
   *
   * NOT persisted (ephemeral/runtime state):
   * - users (reconnect with new connection)
   * - pointers (expire after 3 seconds)
   * - drawingUndoStacks, drawingRedoStacks (runtime-only)
   * - selectionState (UI state, not game state)
   * - combatActive, currentTurnCharacterId (session-specific)
   *
   * Error handling:
   * - Logs errors to console
   * - Does not throw or propagate errors
   * - Game continues even if save fails
   *
   * @example
   * ```typescript
   * const persistence = new StatePersistence(state, stagingManager);
   * persistence.saveToDisk(); // Returns immediately, file writes in background
   * ```
   */
  saveToDisk(): void {
    const state = this.getState();
    const persistentData = {
      tokens: state.tokens,
      players: state.players,
      characters: state.characters,
      props: state.props,
      mapBackground: state.mapBackground,
      drawings: state.drawings,
      gridSize: state.gridSize,
      gridSquareSize: state.gridSquareSize,
      diceRolls: state.diceRolls,
      sceneObjects: state.sceneObjects,
      playerStagingZone: state.playerStagingZone,
    };

    // Queue writes to avoid overlapping file operations that can corrupt JSON.
    this.writeQueue = this.writeQueue
      .catch(() => {
        // Swallow errors from previous writes so the queue can continue.
      })
      .then(() => writeFile(this.stateFile, JSON.stringify(persistentData, null, 2)))
      .catch((err) => {
        console.error("Failed to save state:", err);
      });
  }
}
