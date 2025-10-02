// ============================================================================
// ROOM DOMAIN - MODEL
// ============================================================================
// Defines the room state structure and snapshot

import type { RoomSnapshot, Token, Player, Pointer, Drawing, DiceRoll } from "@shared";

/**
 * Room state - holds all game data for a session
 */
export interface RoomState {
  users: string[];              // Connected user UIDs (legacy)
  tokens: Token[];              // All tokens on the map
  players: Player[];            // Player metadata
  mapBackground?: string;       // Background image URL/base64
  pointers: Pointer[];          // Temporary pointer indicators
  drawings: Drawing[];          // Freehand drawings
  gridSize: number;             // Synchronized grid size
  diceRolls: DiceRoll[];        // Dice roll history
}

/**
 * Create an empty room state
 */
export function createEmptyRoomState(): RoomState {
  return {
    users: [],
    tokens: [],
    players: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    diceRolls: [],
  };
}

/**
 * Convert room state to snapshot for client
 */
export function toSnapshot(state: RoomState): RoomSnapshot {
  return {
    users: state.users,
    tokens: state.tokens,
    players: state.players,
    mapBackground: state.mapBackground,
    pointers: state.pointers,
    drawings: state.drawings,
    gridSize: state.gridSize,
    diceRolls: state.diceRolls,
  };
}
