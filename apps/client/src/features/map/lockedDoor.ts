// ============================================================================
// LOCKED DOOR — what a player's click on a locked door is answered with
// ============================================================================
// A toast (lockNotice → App) and a latch rattle only the one who tried hears.
// Said before sending when the door sprite can see the lock (DoorsLayer), and on
// the server's `door-refused` when it could not: a view a moment stale, the DM
// having just locked it (useServerEventHandlers).

import { announceLocked } from "../locking/lockNotice";
import { sfxEngine } from "../juice/sfxEngine";

/** What a player's click on a locked door is told (the user guide quotes it). */
export const LOCKED_DOOR_NOTICE = "This door is locked. Only the DM can open it.";

export function announceLockedDoor(): void {
  announceLocked(LOCKED_DOOR_NOTICE);
  sfxEngine.play("doorClunk", { gainScale: 0.6 });
}
