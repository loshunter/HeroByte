// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import { writeFileSync, readFileSync, existsSync } from "fs";
import type { WebSocket } from "ws";
import type { Player, RoomSnapshot, Character } from "@shared";
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
        };
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
    };
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
    return toSnapshot(this.state);
  }
}
