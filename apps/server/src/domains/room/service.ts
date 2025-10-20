// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import { writeFileSync, readFileSync, existsSync } from "fs";
import type { WebSocket } from "ws";
import type { Player, RoomSnapshot, Character, SceneObject, PlayerStagingZone } from "@shared";
import type { RoomState } from "./model.js";
import { createEmptyRoomState, createSelectionMap, toSnapshot } from "./model.js";

const STATE_FILE = "./herobyte-state.json";

/**
 * Room service - manages session state and persistence
 */
export class RoomService {
  private state: RoomState;

  constructor() {
    this.state = createEmptyRoomState();
    this.rebuildSceneGraph();
  }

  private sanitizeStagingZone(zone: unknown): PlayerStagingZone | undefined {
    if (!zone || typeof zone !== "object") {
      return undefined;
    }
    const candidate = zone as Partial<PlayerStagingZone>;
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    const width = Number(candidate.width);
    const height = Number(candidate.height);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return undefined;
    }
    const normalized: PlayerStagingZone = {
      x,
      y,
      width: Math.max(1, Math.abs(width)),
      height: Math.max(1, Math.abs(height)),
      rotation:
        candidate.rotation !== undefined && Number.isFinite(Number(candidate.rotation))
          ? Number(candidate.rotation)
          : 0,
    };
    return normalized;
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
    if (existsSync(STATE_FILE)) {
      try {
        const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
        const sceneObjects: SceneObject[] = data.sceneObjects || [];

        this.state = {
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
            tokenImage: character.tokenImage ?? null,
            tokenId: character.tokenId ?? null,
          })),
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
          playerStagingZone: this.sanitizeStagingZone(data.playerStagingZone),
        };
        this.rebuildSceneGraph();
        console.log("Loaded state from disk");
      } catch (err) {
        console.error("Failed to load state:", err);
      }
    }
  }

  /**
   * Save game state to disk (called after every state change)
   */
  saveState(): void {
    try {
      const persistentData = {
        tokens: this.state.tokens,
        players: this.state.players,
        characters: this.state.characters,
        mapBackground: this.state.mapBackground,
        drawings: this.state.drawings,
        gridSize: this.state.gridSize,
        gridSquareSize: this.state.gridSquareSize,
        diceRolls: this.state.diceRolls,
        sceneObjects: this.state.sceneObjects,
        playerStagingZone: this.state.playerStagingZone,
      };
      writeFileSync(STATE_FILE, JSON.stringify(persistentData, null, 2));
    } catch (err) {
      console.error("Failed to save state:", err);
    }
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

    const currentGridSquareSize = this.state.gridSquareSize ?? 5;

    // If snapshot has sceneObjects, don't load legacy drawings array
    // (rebuildSceneGraph will recreate drawings from sceneObjects if needed)
    const hasSceneObjects = snapshot.sceneObjects && snapshot.sceneObjects.length > 0;

    this.state = {
      users: this.state.users, // Keep current WebSocket connections
      tokens: snapshot.tokens ?? [],
      players: mergedPlayers,
      characters: loadedCharacters,
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
      playerStagingZone: this.sanitizeStagingZone(snapshot.playerStagingZone),
    };
    this.rebuildSceneGraph();
    console.log(`Loaded session snapshot from client - merged ${mergedPlayers.length} players`);
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
        if (!isDM && object.owner && object.owner !== actorUid) return false;
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
          scaleX: prev?.type === "staging-zone" ? prev.transform.scaleX : 1,
          scaleY: prev?.type === "staging-zone" ? prev.transform.scaleY : 1,
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
    const sanitized = this.sanitizeStagingZone(zone);
    this.state.playerStagingZone = sanitized;
    this.rebuildSceneGraph();
    return true;
  }

  /**
   * Pick a spawn position for a player token.
   * Uses the staging zone if available; otherwise defaults to (0,0).
   */
  getPlayerSpawnPosition(): { x: number; y: number } {
    const zone = this.state.playerStagingZone;
    if (!zone) {
      return { x: 0, y: 0 };
    }

    const angle = ((zone.rotation ?? 0) * Math.PI) / 180;
    const halfWidth = zone.width / 2;
    const halfHeight = zone.height / 2;

    const randomX = Math.random() * zone.width - halfWidth;
    const randomY = Math.random() * zone.height - halfHeight;

    const rotatedX = randomX * Math.cos(angle) - randomY * Math.sin(angle);
    const rotatedY = randomX * Math.sin(angle) + randomY * Math.cos(angle);

    return {
      x: zone.x + rotatedX,
      y: zone.y + rotatedY,
    };
  }
}
