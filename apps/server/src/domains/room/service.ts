// ============================================================================
// ROOM DOMAIN - SERVICE
// ============================================================================
// Handles room state management, persistence, and broadcasting

import { writeFileSync, readFileSync, existsSync } from "fs";
import type { WebSocket } from "ws";
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
          users: [],  // Don't persist users - they reconnect
          tokens: data.tokens || [],
          players: data.players || [],
          mapBackground: data.mapBackground,
          pointers: [],  // Don't persist pointers - they expire
          drawings: data.drawings || [],
          gridSize: data.gridSize || 50,
          diceRolls: data.diceRolls || [],
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
    this.cleanupPointers();

    const snapshot = toSnapshot(this.state);
    const json = JSON.stringify(snapshot);

    clients.forEach((client) => {
      if (client.readyState === 1) {  // OPEN
        client.send(json);
      }
    });

    this.saveState();
  }
}
