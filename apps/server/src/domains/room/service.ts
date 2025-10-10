// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import { writeFileSync, readFileSync, existsSync } from "fs";
import type { WebSocket } from "ws";
import type { Player, RoomSnapshot, Character, SceneObject } from "@shared";
import type { RoomState } from "./model.js";
import { createEmptyRoomState, toSnapshot } from "./model.js";

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
          diceRolls: data.diceRolls || [],
          drawingRedoStacks: {},
          sceneObjects,
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
        diceRolls: this.state.diceRolls,
        sceneObjects: this.state.sceneObjects,
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

    this.state = {
      users: this.state.users, // Keep current WebSocket connections
      tokens: snapshot.tokens ?? [],
      players: mergedPlayers,
      characters: loadedCharacters,
      mapBackground: snapshot.mapBackground,
      pointers: [], // Clear pointers on load
      drawings: snapshot.drawings ?? [],
      gridSize: snapshot.gridSize ?? 50,
      diceRolls: snapshot.diceRolls ?? [],
      drawingRedoStacks: {},
      sceneObjects: snapshot.sceneObjects ?? this.state.sceneObjects,
    };
    this.rebuildSceneGraph();
    console.log(`Loaded session snapshot from client - merged ${mergedPlayers.length} players`);
  }

  /**
   * Clean up expired pointers (older than 2 seconds)
   */
  cleanupPointers(): void {
    const now = Date.now();
    this.state.pointers = this.state.pointers.filter((p) => now - p.timestamp < 2000);
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

    // Pointers (ephemeral)
    for (const pointer of this.state.pointers) {
      const id = `pointer:${pointer.uid}`;
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
        data: { uid: pointer.uid },
      });
    }

    this.state.sceneObjects = next;
  }
}
