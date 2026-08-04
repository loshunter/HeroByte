// Shared between RollLog and RollEntry, which were one file until the chat
// tab needed the room. Its own module so neither imports the other.

import type { RollResult } from "./types";

export interface RollLogEntry extends RollResult {
  playerName: string;
}
