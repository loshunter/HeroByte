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

import { readFileSync, existsSync, renameSync } from "fs";
import { writeFile, rename } from "fs/promises";
import type { Player, Character, SceneObject } from "@herobyte/shared";
import {
  coerceDefaultVisionRadius,
  coerceDiagonalRule,
  coerceMonsterHpDisplay,
  coerceTokenVisionRadii,
} from "@herobyte/shared";
import { resolveServerPath } from "../../../config/serverPaths.js";
import { normalizeAtlasState } from "../atlasState.js";
import type { RoomState } from "../model.js";
import { createSelectionMap } from "../model.js";
import type { StagingZoneManager } from "../staging/StagingZoneManager.js";

/**
 * Default file path for state persistence, anchored to the package root so
 * the store does not fork when the server is launched from a different CWD.
 */
const DEFAULT_STATE_FILE = resolveServerPath("herobyte-state.json");

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
  /** Makes each write's tmp file unique alongside the pid (see saveToDisk). */
  private writeCounter = 0;

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
          stateVersion: typeof data.stateVersion === "number" ? data.stateVersion : 0,
          // Array-guarded like diceRolls below: this array is walked inside the
          // DEBOUNCED broadcast timer, outside route()'s try/catch, in a
          // process with no uncaughtException handler — so a poisoned non-array
          // would kill the process serving every room, and do it again on every
          // restart. Whitelist-coerced on the way in for the same reason
          // diagonalRule is: a hand-edited visionRadius otherwise reaches the
          // vision geometry unchecked, since tokens are copied verbatim.
          //
          // The two guards are now redundant on purpose — `coerceTokenVisionRadii`
          // array-guards as well, so removing the `Array.isArray` here no longer
          // changes behaviour and no test notices. Keep both: they protect
          // different things (a crash, and a poisoned field), and either could
          // be moved or dropped by a later refactor of the other.
          tokens: coerceTokenVisionRadii(Array.isArray(data.tokens) ? data.tokens : []),
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
          // `|| []` alone would keep a poisoned non-array ({} is truthy),
          // reviving the crash on every restart. Anything that is not an
          // array is not a roll log, and not chat.
          diceRolls: Array.isArray(data.diceRolls) ? data.diceRolls : [],
          chatLog: Array.isArray(data.chatLog) ? data.chatLog : [],
          drawingUndoStacks: {},
          drawingRedoStacks: {},
          sceneObjects,
          selectionState: createSelectionMap(),
          playerStagingZone: this.stagingManager.sanitize(data.playerStagingZone),
          combatActive: data.combatActive ?? false,
          currentTurnCharacterId: data.currentTurnCharacterId ?? undefined,
          compiledScene: data.compiledScene ?? undefined,
          mapTerrain: data.mapTerrain ?? undefined,
          mapElements: data.mapElements ?? undefined,
          liveMapDocumentId: data.liveMapDocumentId ?? undefined,
          fogEnabled: data.fogEnabled ?? false,
          // Whitelist, not passthrough: a hand-edited file must not smuggle a
          // fourth mode into a field the recipient filter branches on.
          monsterHpDisplay: coerceMonsterHpDisplay(data.monsterHpDisplay),
          // Same whitelist for the same reason: the measurement maths branches
          // on this, and a file written by an older server has no key at all
          // (which coerces to "5e", the corrected default).
          diagonalRule: coerceDiagonalRule(data.diagonalRule),
          // `=== true`, not truthiness: a capability toggle must not switch on
          // because a hand-edited file carried "yes" or 1. Older files have no
          // key at all, which reads as off — the shipped default.
          playerPropsEnabled: data.playerPropsEnabled === true,
          // `!== false`, the INVERSE of the line above, because this one
          // defaults ON. Coercing it the usual `=== true` way would switch
          // manual entry off for every table on the next restart — every state
          // file already on the production disk predates the key.
          initiativeManualOverride: data.initiativeManualOverride !== false,
          // Clamped rather than passed through: the sweep divides by this, and
          // ABSENT is the normal case — every state file already on the
          // production disk predates the field and must read as no default.
          defaultVisionRadius: coerceDefaultVisionRadius(data.defaultVisionRadius),
          // Poison-proof (`?? []` keeps a truthy `{}`) and shared with the
          // Redis hydrate path — see atlasState.ts.
          ...normalizeAtlasState(data),
        };

        this.setState(loadedState);

        // Trigger scene graph rebuild
        this.onStateLoaded?.();

        console.log("Loaded state from disk");
      } catch (err) {
        console.error("Failed to load state:", err);
        this.quarantineUnreadableStateFile();
      }
    }
  }

  /**
   * Move an unreadable state file aside instead of leaving it in place.
   *
   * Without this, a corrupt file was a PERMANENT loss: the parse failure left
   * the room empty, and the very next broadcast saved that empty room over
   * the only copy of the data. Renaming to `<file>.corrupt` preserves the
   * evidence for manual recovery while letting the room start clean. A fixed
   * suffix (rename-over-existing is atomic on Windows too) keeps at most one
   * quarantined copy — the point is preservation, not archival.
   */
  private quarantineUnreadableStateFile(): void {
    const quarantinePath = `${this.stateFile}.corrupt`;
    try {
      renameSync(this.stateFile, quarantinePath);
      console.error(
        `[StatePersistence] Unreadable state file preserved at ${quarantinePath}; ` +
          `starting from empty state.`,
      );
    } catch (renameErr) {
      console.error("[StatePersistence] Failed to quarantine unreadable state file:", renameErr);
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
   * - combatActive, currentTurnCharacterId (initiative survives a restart)
   *
   * NOT persisted (ephemeral/runtime state):
   * - users (reconnect with new connection)
   * - pointers (expire after 3 seconds)
   * - drawingUndoStacks, drawingRedoStacks (runtime-only)
   * - selectionState (UI state, not game state)
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
      // Chat survives a restart for the same reason initiative does: a crash
      // mid-session must not silently erase what the table said. Whispers are
      // included — this file is server-local, and the per-recipient filter
      // runs on the way OUT, so nothing here reaches the wrong client.
      chatLog: state.chatLog,
      sceneObjects: state.sceneObjects,
      playerStagingZone: state.playerStagingZone,
      compiledScene: state.compiledScene,
      mapTerrain: state.mapTerrain,
      mapElements: state.mapElements,
      liveMapDocumentId: state.liveMapDocumentId,
      fogEnabled: state.fogEnabled,
      monsterHpDisplay: state.monsterHpDisplay,
      diagonalRule: state.diagonalRule,
      playerPropsEnabled: state.playerPropsEnabled,
      initiativeManualOverride: state.initiativeManualOverride,
      defaultVisionRadius: state.defaultVisionRadius,
      stateVersion: state.stateVersion,
      // Combat state survives a restart on purpose (VISION.md calls this a
      // launch gate): a mid-fight crash or redeploy must not lose initiative.
      combatActive: state.combatActive,
      currentTurnCharacterId: state.currentTurnCharacterId,
      // The campaign graph and its suspended scenes are game state.
      atlasNodes: state.atlasNodes,
      atlasLinks: state.atlasLinks,
      sceneStates: state.sceneStates,
    };

    // Serialize NOW (synchronously) so the queued write captures a consistent
    // snapshot of the state as it was when the save was requested. The fields in
    // persistentData are live references into RoomState — if serialization were
    // deferred into the queued .then() callback (as it was previously), any
    // mutations applied while an earlier write was still in flight would leak
    // into this "earlier" save.
    let serialized: string;
    try {
      serialized = JSON.stringify(persistentData, null, 2);
    } catch (err) {
      console.error("Failed to serialize state for save:", err);
      return;
    }

    // Queue writes to avoid overlapping file operations that can corrupt JSON.
    // Each write is tmp+rename: a crash mid-write truncates only the tmp file,
    // never the state file itself, so the last completed save always survives.
    //
    // The tmp path is unique per PROCESS and per write, not the fixed
    // `<file>.tmp` this originally used. The write queue only serializes
    // within one process, and more than one process legitimately targets the
    // same state file here: the dev server, the e2e server (which also
    // defaults to the package root), and parallel vitest workers. With a
    // shared tmp name two of them interleave their bytes into one file and
    // then rename that torn result over the real state — which is exactly
    // how this was found, via a quarantined herobyte-state.json.corrupt.
    // A unique name makes the rename the only shared step, and rename is
    // atomic.
    const tmpPath = `${this.stateFile}.${process.pid}.${(this.writeCounter += 1)}.tmp`;
    this.writeQueue = this.writeQueue
      .catch(() => {
        // Swallow errors from previous writes so the queue can continue.
      })
      .then(async () => {
        await writeFile(tmpPath, serialized);
        await rename(tmpPath, this.stateFile);
      })
      .catch((err) => {
        console.error("Failed to save state:", err);
      });
  }

  /**
   * Waits for all pending writes to complete.
   *
   * This method is primarily intended for testing to ensure that all
   * async write operations have finished before making assertions.
   *
   * @returns Promise that resolves when all pending writes are complete
   *
   * @example
   * ```typescript
   * persistence.saveToDisk();
   * await persistence.awaitPendingWrites(); // Wait for write to finish
   * // Now safe to read and assert on the file content
   * ```
   */
  awaitPendingWrites(): Promise<void> {
    return this.writeQueue;
  }
}
