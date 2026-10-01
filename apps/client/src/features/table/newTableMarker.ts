// ============================================================================
// HOST NEXT STEPS — the "I just made this table" marker
// ============================================================================
// Creating a table (▦ New Table, or Save & Go There from the public table)
// ends in a FULL navigation: a fresh page, a fresh socket, the creator arriving
// as an ordinary player. Nothing in memory survives it, so the lobby leaves a
// marker for the table it just made and the app reads it on arrival.
//
// sessionStorage, scoped per table like the room secret beside it
// (roomDirectory.stashRoomSecret): it belongs to THIS tab and to the tab that
// made the table — a player who opens the invite link never has it — and it goes
// when the tab does. It is a prompt, not a permission: the marker grants nothing,
// and the steps it shows are the existing ones (the password dialog, the copy).
//
// It also remembers that the host has HELD the DM seat in this tab ("claimed"): the card
// holds its Invite button until they do — on a table made without a DM password the first
// to enter DM mode sets it and becomes the DM — and once they have, leaving DM mode or a
// restart that clears the elevation must not lock the invitation again.

const KEY_PREFIX = "herobyte-next-steps";
const CLAIMED = "claimed";

const keyFor = (roomId: string) => `${KEY_PREFIX}:${roomId}`;

/** Remember that this tab just created `roomId`. */
export function markNewTable(roomId: string): void {
  try {
    sessionStorage.setItem(keyFor(roomId), "1");
  } catch {
    // Private-mode storage failures just mean the host is not prompted.
  }
}

function read(roomId: string | undefined): string | null {
  if (!roomId) return null;
  try {
    return sessionStorage.getItem(keyFor(roomId));
  } catch {
    return null;
  }
}

/** Whether this tab created `roomId` and the host has not dismissed the steps. */
export function readNewTable(roomId: string | undefined): boolean {
  const stored = read(roomId);
  return stored === "1" || stored === CLAIMED;
}

/** The host has been the DM of `roomId` in this tab. Only a table this tab made can be claimed. */
export function markSeatClaimed(roomId: string | undefined): void {
  if (!roomId || !readNewTable(roomId)) return;
  try {
    sessionStorage.setItem(keyFor(roomId), CLAIMED);
  } catch {
    // Not remembered: the invitation waits for the next time they are the DM.
  }
}

/** Whether the host has held the DM seat of `roomId` in this tab. */
export function seatClaimed(roomId: string | undefined): boolean {
  return read(roomId) === CLAIMED;
}

export function clearNewTable(roomId: string | undefined): void {
  if (!roomId) return;
  try {
    sessionStorage.removeItem(keyFor(roomId));
  } catch {
    // Nothing stored, nothing to forget.
  }
}
