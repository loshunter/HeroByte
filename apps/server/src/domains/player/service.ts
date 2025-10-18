// ============================================================================
// PLAYER DOMAIN - SERVICE
// ============================================================================
// Handles player-related business logic

import type { Player } from "@shared";
import type { RoomState } from "../room/model.js";

/**
 * Player service - manages player data and actions
 */
export class PlayerService {
  /**
   * Find player by UID
   */
  findPlayer(state: RoomState, uid: string): Player | undefined {
    return state.players.find((p) => p.uid === uid);
  }

  /**
   * Create new player if they don't exist
   */
  createPlayer(state: RoomState, uid: string): Player {
    const existingPlayer = this.findPlayer(state, uid);
    if (existingPlayer) {
      return existingPlayer;
    }

    const playerNumber = state.players.length + 1;
    const newPlayer: Player = {
      uid,
      name: `Player ${playerNumber}`,
      hp: 100,
      maxHp: 100,
      lastHeartbeat: Date.now(), // Initialize heartbeat timestamp
      isDM: false,
      statusEffects: [],
    };

    state.players.push(newPlayer);
    return newPlayer;
  }

  /**
   * Update player portrait
   */
  setPortrait(state: RoomState, uid: string, portraitData: string): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      console.log(`[PlayerService] Setting portrait for ${player.name} (${uid}): ${portraitData.substring(0, 50)}...`);
      player.portrait = portraitData;
      return true;
    }
    console.warn(`[PlayerService] Player not found for UID: ${uid}`);
    return false;
  }

  /**
   * Rename player
   */
  rename(state: RoomState, uid: string, name: string): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      player.name = name;
      return true;
    }
    return false;
  }

  /**
   * Update player microphone level
   */
  setMicLevel(state: RoomState, uid: string, level: number): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      player.micLevel = level;
      return true;
    }
    return false;
  }

  /**
   * Update player HP
   */
  setHP(state: RoomState, uid: string, hp: number, maxHp: number): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      player.hp = hp;
      player.maxHp = maxHp;
      return true;
    }
    return false;
  }

  /**
   * Toggle DM mode flag
   */
  setDMMode(state: RoomState, uid: string, isDM: boolean): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      player.isDM = isDM;
      return true;
    }
    return false;
  }

  /**
   * Replace the player's status effects array
   */
  setStatusEffects(state: RoomState, uid: string, effects: string[]): boolean {
    const player = this.findPlayer(state, uid);
    if (player) {
      player.statusEffects = [...effects];
      return true;
    }
    return false;
  }

  /**
   * Remove player from state (but keep for reconnection in production)
   */
  removePlayer(state: RoomState, uid: string): boolean {
    const index = state.players.findIndex((p) => p.uid === uid);
    if (index !== -1) {
      state.players.splice(index, 1);
      return true;
    }
    return false;
  }
}
