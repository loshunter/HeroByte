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
import { BroadcastMetricsLogger } from "./metrics/BroadcastMetricsLogger.js";

export const SNAPSHOT_SIZE_LIMIT_BYTES = 750 * 1024; // 750KB per snapshot
import { InMemoryRoomStore, type RoomStore } from "./store/RoomStore.js";

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
  private metricsLogger: BroadcastMetricsLogger;
  private store: RoomStore;
  private readonly roomId: string;

  constructor(
    options: { metricsLogger?: BroadcastMetricsLogger; store?: RoomStore; roomId?: string } = {},
  ) {
    this.store = options.store ?? new InMemoryRoomStore();
    this.roomId = options.roomId ?? "default-room";
    const existingState = this.store.get(this.roomId);
    this.state = existingState ?? createEmptyRoomState();
    if (!existingState) {
      this.store.set(this.roomId, this.state);
    }
    this.sceneGraphBuilder = new SceneGraphBuilder();
    this.snapshotLoader = new SnapshotLoader();
    this.transformHandler = new TransformHandler();
    this.lockingHandler = new LockingHandler();
    this.metricsLogger = options.metricsLogger ?? new BroadcastMetricsLogger();
    this.stagingManager = new StagingZoneManager(this.state, () => this.rebuildSceneGraph());

    // Support custom state file path via ROOM_STATE_FILE env var for parallel E2E tests
    const stateFilePath = process.env.ROOM_STATE_FILE;

    this.persistence = new StatePersistence(
      () => this.state,
      (newState) => {
        this.state = newState;
        this.store.set(this.roomId, this.state);
      },
      this.stagingManager,
      () => this.rebuildSceneGraph(),
      stateFilePath, // Pass custom path if provided
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
    this.store.set(this.roomId, this.state);
  }

  /**
   * Increment and return the next state version.
   */
  bumpStateVersion(): number {
    this.state.stateVersion = (this.state.stateVersion ?? 0) + 1;
    return this.state.stateVersion;
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
   * Wait for all pending state saves to complete.
   * Primarily for testing to ensure writes finish before assertions.
   */
  awaitPendingWrites(): Promise<void> {
    return this.persistence.awaitPendingWrites();
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
    this.store.set(this.roomId, this.state);
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
   * Generates per-player snapshots with visibility filtering
   * @param clients - Set of authenticated WebSocket clients
   * @param uidToWs - Map of player UID to WebSocket (for looking up player info)
   * @param options - Additional metadata for telemetry/logging
   */
  broadcast(
    clients: Set<WebSocket>,
    uidToWs?: Map<string, WebSocket>,
    options?: { reason?: string; skipVersionBump?: boolean },
  ): void {
    this.cleanupPointers();
    if (!options?.skipVersionBump) {
      this.bumpStateVersion();
    }
    this.rebuildSceneGraph();

    const start = performance.now();
    let sentClients = 0;
    let totalBytes = 0;

    clients.forEach((client) => {
      if (client.readyState !== 1) return; // Skip if not OPEN

      // Find player UID for this client by reverse lookup
      const playerUid = uidToWs
        ? Array.from(uidToWs.entries()).find(([_, ws]) => ws === client)?.[0]
        : undefined;

      // Determine if this client is a DM
      const isDM = playerUid
        ? (this.state.players.find((p) => p.uid === playerUid)?.isDM ?? false)
        : false;

      // Generate snapshot with appropriate visibility filtering
      const snapshot = toSnapshot(this.state, isDM);
      const payload = JSON.stringify(snapshot);
      const payloadBytes = Buffer.byteLength(payload, "utf8");
      this.guardSnapshotSize(payloadBytes, options?.reason);
      totalBytes += payloadBytes;
      client.send(payload);
      sentClients += 1;
    });

    this.saveState();

    const durationMs = performance.now() - start;
    this.metricsLogger.log({
      clientCount: sentClients,
      snapshotBytes: totalBytes,
      durationMs,
      reason: options?.reason ?? "room-service.broadcast",
    });
  }

  private guardSnapshotSize(bytes: number, reason?: string): void {
    if (bytes <= SNAPSHOT_SIZE_LIMIT_BYTES) {
      return;
    }
    const readableSize = `${(bytes / 1024).toFixed(1)}kb`;
    const readableLimit = `${(SNAPSHOT_SIZE_LIMIT_BYTES / 1024).toFixed(1)}kb`;
    console.warn(
      `[RoomService] Snapshot size ${readableSize} exceeded guard ${readableLimit} (reason=${reason ?? "unspecified"})`,
    );
  }

  /**
   * Create a snapshot of the current room state without sending it
   */
  createSnapshot(): RoomSnapshot {
    return this.createSnapshotForPlayer();
  }

  /**
   * Create a snapshot tailored for a specific recipient.
   * Applies DM visibility rules based on the player's role.
   */
  createSnapshotForPlayer(playerUid?: string): RoomSnapshot {
    this.cleanupPointers();
    this.rebuildSceneGraph();

    const isDM = playerUid
      ? Boolean(this.state.players.find((player) => player.uid === playerUid)?.isDM)
      : true;

    return toSnapshot(this.state, isDM);
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
