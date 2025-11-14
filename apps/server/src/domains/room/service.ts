// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import type { WebSocket } from "ws";
import type { Player, RoomSnapshot, Character, SceneObject, PlayerStagingZone } from "@shared";
import type { RoomState } from "./model.js";
import { createEmptyRoomState, createSelectionMap, toSnapshot } from "./model.js";
import { StagingZoneManager } from "./staging/StagingZoneManager.js";
import { StatePersistence } from "./persistence/StatePersistence.js";

/**
 * Room service - manages session state and persistence
 */
export class RoomService {
  private state: RoomState;
  private stagingManager: StagingZoneManager;
  private persistence: StatePersistence;

  constructor() {
    this.state = createEmptyRoomState();
    this.stagingManager = new StagingZoneManager(this.state, () => this.rebuildSceneGraph());
    this.persistence = new StatePersistence(
      () => this.state,
      (newState) => { this.state = newState; },
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
    // Merge players: Keep currently connected players, update their data if they exist in snapshot
    const loadedPlayers = (snapshot.players ?? []).map((player) => ({
      ...player,
      isDM: player.isDM ?? false,
      statusEffects: Array.isArray(player.statusEffects) ? [...player.statusEffects] : [],
    }));
    const loadedCharacters = (snapshot.characters ?? []).map((character) => ({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenId: character.tokenId ?? null,
      tokenImage: character.tokenImage ?? null,
    }));
    const mergedPlayers = this.state.players.map((currentPlayer) => {
      // Find matching player in loaded snapshot by UID
      const savedPlayer = loadedPlayers.find((p: Player) => p.uid === currentPlayer.uid);
      if (savedPlayer) {
        // Merge: Keep current connection data (lastHeartbeat, micLevel), restore saved data
        return {
          ...savedPlayer,
          lastHeartbeat: currentPlayer.lastHeartbeat, // Keep current heartbeat
          micLevel: currentPlayer.micLevel, // Keep current mic level
        };
      }
      // Player is currently connected but wasn't in saved session - keep them
      return { ...currentPlayer, isDM: currentPlayer.isDM ?? false };
    });

    // Get UIDs of currently connected players
    const currentPlayerUIDs = new Set(this.state.players.map((p) => p.uid));

    // Preserve characters belonging to currently connected players
    const currentPlayerCharacters = this.state.characters.filter(
      (char) => char.ownedByPlayerUID && currentPlayerUIDs.has(char.ownedByPlayerUID),
    );

    // Get IDs of preserved characters to avoid duplicates
    const preservedCharacterIds = new Set(currentPlayerCharacters.map((c) => c.id));

    // Add loaded characters that don't conflict with preserved ones
    const mergedCharacters = [
      ...currentPlayerCharacters,
      ...loadedCharacters.filter((char) => !preservedCharacterIds.has(char.id)),
    ];

    // Preserve tokens belonging to currently connected players
    const currentPlayerTokens = this.state.tokens.filter((token) =>
      currentPlayerUIDs.has(token.owner),
    );

    // Get IDs of preserved tokens to avoid duplicates
    const preservedTokenIds = new Set(currentPlayerTokens.map((t) => t.id));

    // Add loaded tokens that don't conflict with preserved ones
    const mergedTokens = [
      ...currentPlayerTokens,
      ...(snapshot.tokens ?? []).filter((token) => !preservedTokenIds.has(token.id)),
    ];

    const currentGridSquareSize = this.state.gridSquareSize ?? 5;

    // If snapshot has sceneObjects, don't load legacy drawings array
    // (rebuildSceneGraph will recreate drawings from sceneObjects if needed)
    const hasSceneObjects = snapshot.sceneObjects && snapshot.sceneObjects.length > 0;

    this.state = {
      users: this.state.users, // Keep current WebSocket connections
      tokens: mergedTokens,
      players: mergedPlayers,
      characters: mergedCharacters,
      props: snapshot.props ?? [],
      mapBackground: snapshot.mapBackground,
      pointers: [], // Clear pointers on load
      drawings: hasSceneObjects ? [] : (snapshot.drawings ?? []),
      gridSize: snapshot.gridSize ?? 50,
      gridSquareSize: snapshot.gridSquareSize ?? currentGridSquareSize,
      diceRolls: snapshot.diceRolls ?? [],
      drawingUndoStacks: {},
      drawingRedoStacks: {},
      sceneObjects: snapshot.sceneObjects ?? this.state.sceneObjects,
      selectionState: createSelectionMap(),
      playerStagingZone: this.stagingManager.sanitize(snapshot.playerStagingZone),
      combatActive: snapshot.combatActive ?? false,
      currentTurnCharacterId: snapshot.currentTurnCharacterId ?? undefined,
    };
    this.rebuildSceneGraph();
    console.log(
      `Loaded session snapshot from client - merged ${mergedPlayers.length} players, ` +
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
    const actor = this.state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    if (!isDM) {
      return 0;
    }

    let lockCount = 0;
    for (const id of objectIds) {
      const object = this.state.sceneObjects.find((candidate) => candidate.id === id);
      if (object) {
        object.locked = true;
        lockCount++;
      }
    }

    return lockCount;
  }

  /**
   * Unlock multiple scene objects (DM only)
   * Returns number of objects successfully unlocked
   */
  unlockSelectedObjects(actorUid: string, objectIds: string[]): number {
    const actor = this.state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    if (!isDM) {
      return 0;
    }

    let unlockCount = 0;
    for (const id of objectIds) {
      const object = this.state.sceneObjects.find((candidate) => candidate.id === id);
      if (object) {
        object.locked = false;
        unlockCount++;
      }
    }

    return unlockCount;
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
    const object = this.state.sceneObjects.find((candidate) => candidate.id === id);
    if (!object) {
      return false;
    }

    const actor = this.state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    // Handle locked state change (DM only)
    if (typeof changes.locked === "boolean") {
      if (!isDM) return false;
      object.locked = changes.locked;
      return true;
    }

    if (object.locked && !isDM) {
      return false;
    }

    const applyRotation = (value: number | undefined) => {
      if (typeof value === "number") {
        object.transform.rotation = value;
      }
    };

    const applyScale = (value: { x: number; y: number } | undefined) => {
      if (value) {
        object.transform.scaleX = value.x;
        object.transform.scaleY = value.y;
      }
    };

    const applyPosition = (value: { x: number; y: number } | undefined) => {
      if (value) {
        object.transform.x = value.x;
        object.transform.y = value.y;
      }
    };

    switch (object.type) {
      case "map": {
        if (!isDM) return false;
        applyPosition(changes.position);
        applyScale(changes.scale);
        applyRotation(changes.rotation);
        return true;
      }

      case "token": {
        const tokenId = object.id.replace(/^token:/, "");
        const token = this.state.tokens.find((candidate) => candidate.id === tokenId);
        if (!token) return false;
        if (!isDM && token.owner !== actorUid) return false;

        if (changes.position) {
          token.x = changes.position.x;
          token.y = changes.position.y;
        }

        applyPosition(changes.position);
        applyScale(changes.scale);
        applyRotation(changes.rotation);
        return true;
      }

      case "staging-zone": {
        if (!isDM) return false;
        if (!this.state.playerStagingZone) return false;

        console.log("[DEBUG] Staging zone transform:", {
          position: changes.position,
          scale: changes.scale,
          rotation: changes.rotation,
          currentTransform: object.transform,
          currentZone: this.state.playerStagingZone,
        });

        if (changes.position) {
          this.state.playerStagingZone.x = changes.position.x;
          this.state.playerStagingZone.y = changes.position.y;
          applyPosition(changes.position);
        }

        if (changes.scale) {
          // Persist scale to the staging zone state
          this.state.playerStagingZone.scaleX = changes.scale.x;
          this.state.playerStagingZone.scaleY = changes.scale.y;
          // Apply scale to transform (don't bake into width/height)
          // The width/height remain as "base" values, and we scale them via transform
          applyScale(changes.scale);

          console.log("[DEBUG] Staging zone scale applied:", {
            baseWidth: this.state.playerStagingZone.width,
            baseHeight: this.state.playerStagingZone.height,
            scaleX: changes.scale.x,
            scaleY: changes.scale.y,
            finalWidth: this.state.playerStagingZone.width * changes.scale.x,
            finalHeight: this.state.playerStagingZone.height * changes.scale.y,
          });
        }

        if (typeof changes.rotation === "number") {
          this.state.playerStagingZone.rotation = changes.rotation;
          applyRotation(changes.rotation);
          if (object.type === "staging-zone") {
            object.data.rotation = changes.rotation;
          }
        }

        return true;
      }

      case "drawing": {
        const drawingId = object.id.replace(/^drawing:/, "");
        const drawing = this.state.drawings.find((candidate) => candidate.id === drawingId);
        const canEdit = isDM || drawing?.owner === actorUid;
        if (!drawing || !canEdit) return false;

        applyPosition(changes.position);
        applyScale(changes.scale);
        applyRotation(changes.rotation);
        return true;
      }

      case "prop": {
        // Find the source prop entity
        const propId = object.id.replace(/^prop:/, "");
        const prop = this.state.props.find((candidate) => candidate.id === propId);
        if (!prop) return false;

        // Permission check: DM can always edit, owner="*" means everyone, or specific owner
        const canEdit = isDM || prop.owner === "*" || prop.owner === actorUid;
        if (!canEdit) return false;

        // Update source Prop entity
        if (changes.position) {
          prop.x = changes.position.x;
          prop.y = changes.position.y;
        }
        if (changes.scale) {
          prop.scaleX = changes.scale.x;
          prop.scaleY = changes.scale.y;
        }
        if (typeof changes.rotation === "number") {
          prop.rotation = changes.rotation;
        }

        // Apply to SceneObject
        applyPosition(changes.position);
        applyScale(changes.scale);
        applyRotation(changes.rotation);
        return true;
      }

      case "pointer": {
        // Pointers are ephemeral and follow owner interactions only
        if (object.owner !== actorUid) return false;
        applyPosition(changes.position);
        return true;
      }

      default:
        return false;
    }
  }

  private rebuildSceneGraph(): void {
    const existing = new Map<string, SceneObject>(
      this.state.sceneObjects.map((obj) => [obj.id, obj]),
    );
    const next: SceneObject[] = [];

    // Map background -> scene object
    if (this.state.mapBackground) {
      const mapId = "map";
      const prev = existing.get(mapId);
      next.push({
        id: mapId,
        type: "map",
        owner: null,
        locked: prev?.locked ?? true,
        zIndex: prev?.zIndex ?? -100,
        transform: prev?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          imageUrl: this.state.mapBackground,
          width: prev?.type === "map" ? prev.data.width : undefined,
          height: prev?.type === "map" ? prev.data.height : undefined,
        },
      });
    }

    // Tokens -> scene objects
    for (const token of this.state.tokens) {
      const id = `token:${token.id}`;
      const prev = existing.get(id);
      const transform = prev?.transform ?? {
        x: token.x,
        y: token.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };
      transform.x = token.x;
      transform.y = token.y;

      next.push({
        id,
        type: "token",
        owner: token.owner,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 10,
        transform: { ...transform },
        data: {
          characterId: prev?.type === "token" ? prev.data.characterId : undefined,
          color: token.color,
          imageUrl: token.imageUrl,
          size: token.size ?? "medium",
        },
      });
    }

    // Drawings -> scene objects
    for (const drawing of this.state.drawings) {
      const id = `drawing:${drawing.id}`;
      const prev = existing.get(id);
      next.push({
        id,
        type: "drawing",
        owner: drawing.owner ?? null,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 5,
        transform: prev?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { drawing },
      });
    }

    // Props -> scene objects
    for (const prop of this.state.props) {
      const id = `prop:${prop.id}`;
      const prev = existing.get(id);
      next.push({
        id,
        type: "prop",
        owner: prop.owner,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 7, // Above drawings (5), below tokens (10)
        transform: {
          x: prop.x,
          y: prop.y,
          scaleX: prop.scaleX,
          scaleY: prop.scaleY,
          rotation: prop.rotation,
        },
        data: {
          imageUrl: prop.imageUrl,
          label: prop.label,
          size: prop.size,
        },
      });
    }

    // Player staging zone
    if (this.state.playerStagingZone) {
      const zone = this.state.playerStagingZone;
      const id = "staging-zone";
      const prev = existing.get(id);
      next.push({
        id,
        type: "staging-zone",
        owner: null,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 1,
        transform: {
          x: zone.x,
          y: zone.y,
          scaleX: zone.scaleX ?? 1,
          scaleY: zone.scaleY ?? 1,
          rotation: zone.rotation ?? 0,
        },
        data: {
          width: zone.width,
          height: zone.height,
          rotation: zone.rotation ?? 0,
          label:
            prev?.type === "staging-zone" && prev.data.label
              ? prev.data.label
              : "Player Staging Zone",
        },
      });
    }

    // Pointers (ephemeral)
    for (const pointer of this.state.pointers) {
      const pointerKey = pointer.id ?? pointer.uid;
      const id = `pointer:${pointerKey}`;
      const prev = existing.get(id);
      next.push({
        id,
        type: "pointer",
        owner: pointer.uid,
        locked: true,
        zIndex: prev?.zIndex ?? 20,
        transform: prev?.transform ?? {
          x: pointer.x,
          y: pointer.y,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
        data: { uid: pointer.uid, pointerId: pointerKey, name: pointer.name },
      });
    }

    this.state.sceneObjects = next;

    // Debug: Check for duplicate IDs
    const ids = next.map((obj) => obj.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.error(`[rebuildSceneGraph] DUPLICATE IDs FOUND:`, duplicates);
    }
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
