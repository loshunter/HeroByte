// ============================================================================
// PLAYER STATE — what a character file holds
// ============================================================================
// Split out of the shared barrel (index.ts), which sits on the structure
// baseline. The client writes and reads these (utils/playerPersistence).

import type { Drawing } from "./drawing.js";
import type { TokenFrame } from "./frames/types.js";
import type { TokenSize } from "./index.js";

/**
 * PlayerState: Serialized player data for persistence
 */
export interface PlayerState {
  name: string;
  hp: number;
  maxHp: number;
  tempHp?: number; // Temporary hit points (absorbed before regular HP)
  portrait?: string | null;
  tokenImage?: string | null; // Legacy support (deprecated in favor of token.imageUrl)
  color?: string; // Legacy support (mirrors token.color)
  token?: PlayerStateTokenSnapshot;
  statusEffects?: string[];
  drawings?: Drawing[];
  initiativeModifier?: number; // Initiative modifier saved with player state
}

export interface PlayerStateTokenSnapshot {
  id?: string;
  color?: string;
  imageUrl?: string | null;
  position?: { x: number; y: number };
  size?: TokenSize;
  rotation?: number;
  scale?: { x: number; y: number };
  /** The token's frame; null = saved without one. Read through coerceTokenFrame (C5a). */
  frame?: TokenFrame | null;
}
