// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import type { WebSocket } from "ws";
import type { RoomSnapshot, PlayerStagingZone } from "@shared";
import type { RoomState } from "./model.js";
import { createEmptyRoomState, toSnapshot } from "./model.js";
import { StagingZoneManager } from "./staging/StagingZoneManager.js";
import { StatePersistence } from "./persistence/StatePersistence.js";
import { SceneGraphBuilder } from "./scene/SceneGraphBuilder.js";
import { SnapshotLoader } from "./snapshot/SnapshotLoader.js";
import { TransformHandler } from "./transform/TransformHandler.js";
import { LockingHandler } from "./locking/LockingHandler.js";

/**
 * Room service - manages session state and persistence
 */
export class RoomService {
  private state: RoomState;
  private stagingManager: StagingZoneManager;
  private persistence: StatePersistence;
  private sceneGraphBuilder: SceneGraphBuilder;
  private snapshotLoader: SnapshotLoader;
  private transformHandler: TransformHandler;
  private lockingHandler: LockingHandler;

  constructor() {
    this.state = createEmptyRoomState();
    this.sceneGraphBuilder = new SceneGraphBuilder();
    this.snapshotLoader = new SnapshotLoader();
    this.transformHandler = new TransformHandler();
    this.lockingHandler = new LockingHandler();
    this.stagingManager = new StagingZoneManager(this.state, () => this.rebuildSceneGraph());
    this.persistence = new StatePersistence(
      () => this.state,
      (newState) => {
        this.state = newState;
      },
      this.stagingManager,
      () => this.rebuildSceneGraph(),
    );
    this.rebuildSceneGraph();
  }

  /**
   * Get current room state
   */
  getState(): RoomState {
    return this.state;
  }

  /**
   * Update room state
   */
  setState(newState: Partial<RoomState>): void {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Load game state from disk on server startup
   */
  loadState(): void {
    this.persistence.loadFromDisk();
  }

  /**
   * Save game state to disk (called after every state change)
   * Uses async file write to prevent blocking the event loop
   */
  saveState(): void {
    this.persistence.saveToDisk();
  }

  /**
   * Load a snapshot from client (from saved session file)
   * Merges loaded data with currently connected players
   */
  loadSnapshot(snapshot: RoomSnapshot): void {
    // Count before merging for logging
    const currentPlayerUIDs = new Set(this.state.players.map((p) => p.uid));
    const currentPlayerCharacters = this.state.characters.filter(
      (char) => char.ownedByPlayerUID && currentPlayerUIDs.has(char.ownedByPlayerUID),
    );
    const currentPlayerTokens = this.state.tokens.filter((token) =>
      currentPlayerUIDs.has(token.owner),
    );

    // Merge snapshot with current state
    this.state = this.snapshotLoader.mergeSnapshot(snapshot, this.state, this.stagingManager);
    this.rebuildSceneGraph();

    console.log(
      `Loaded session snapshot from client - merged ${this.state.players.length} players, ` +
        `preserved ${currentPlayerCharacters.length} current characters, ` +
        `preserved ${currentPlayerTokens.length} current tokens`,
    );
  }

  /**
   * Clean up expired pointers (older than 3 seconds)
   */
  cleanupPointers(): void {
    const now = Date.now();
    this.state.pointers = this.state.pointers.filter((p) => now - p.timestamp < 3000);
  }

  /**
   * Broadcast current room state to all connected clients
   */
  broadcast(clients: Set<WebSocket>): void {
    const snapshot = this.createSnapshot();
    const json = JSON.stringify(snapshot);

    clients.forEach((client) => {
      if (client.readyState === 1) {
        // OPEN
        client.send(json);
      }
    });

    this.saveState();
  }

  /**
   * Create a snapshot of the current room state without sending it
   */
  createSnapshot(): RoomSnapshot {
    this.cleanupPointers();
    this.rebuildSceneGraph();
    return toSnapshot(this.state);
  }

  /**
   * Lock multiple scene objects (DM only)
   * Returns number of objects successfully locked
   */
  lockSelectedObjects(actorUid: string, objectIds: string[]): number {
    return this.lockingHandler.lockObjects(actorUid, objectIds, this.state);
  }

  /**
   * Unlock multiple scene objects (DM only)
   * Returns number of objects successfully unlocked
   */
  unlockSelectedObjects(actorUid: string, objectIds: string[]): number {
    return this.lockingHandler.unlockObjects(actorUid, objectIds, this.state);
  }

  applySceneObjectTransform(
    id: string,
    actorUid: string,
    changes: {
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
      locked?: boolean;
    },
  ): boolean {
    return this.transformHandler.applyTransform(id, actorUid, changes, this.state);
  }

  private rebuildSceneGraph(): void {
    this.state.sceneObjects = this.sceneGraphBuilder.rebuild(this.state);
  }

  /**
   * Set or clear the player staging zone
   */
  setPlayerStagingZone(zone: PlayerStagingZone | undefined): boolean {
    return this.stagingManager.setZone(zone);
  }

  /**
   * Pick a spawn position for a player token.
   * Uses the staging zone if available; otherwise defaults to (0,0).
   */
  getPlayerSpawnPosition(): { x: number; y: number } {
    return this.stagingManager.getSpawnPosition();
  }
}
