// Shared between RollLog and RollEntry, which were one file until the chat
// tab needed the room. Its own module so neither imports the other.
//
// This is THE roll-log entry type. useDiceRolling used to declare a second,
// subtly different interface of the same name; the two disagreed about whether
// `formula` existed, which is how the log came to render a blank formula line
// while the server's string sat unread on the object.

import type { RollResult } from "./types";

export interface RollLogEntry extends RollResult {
  playerName: string;
}
