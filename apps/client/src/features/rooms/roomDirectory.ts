// ============================================================================
// ROOM DIRECTORY
// ============================================================================
// The client's memory of tables: which room this tab is joining (from the
// ?room= URL parameter) and which rooms this browser has visited before
// (localStorage). The server intentionally exposes no room listing — your
// shelf of tables is yours alone.

const STORAGE_KEY = "herobyte-room-directory";
const MAX_REMEMBERED = 12;

/**
 * sessionStorage key PREFIX for the room password the auth gate auto-submits on
 * load. Shared so the "create table" flow can pre-seed it before navigating,
 * letting the freshly-minted room authenticate the creator without a prompt.
 *
 * SCOPED PER TABLE, and that scoping is the whole point. It used to be one flat
 * key holding "the" password. Switching tables is a same-tab navigation, so the
 * gate would auto-submit the PREVIOUS table's password against the new room and
 * land the user on a red "Invalid table password" they never caused — having
 * typed nothing at all.
 */
export const ROOM_SECRET_STORAGE_KEY = "herobyte-room-secret";

/** The per-table storage key. `undefined` roomId means the default table. */
function roomSecretKey(roomId: string | undefined): string {
  return roomId ? `${ROOM_SECRET_STORAGE_KEY}:${roomId}` : ROOM_SECRET_STORAGE_KEY;
}

/**
 * Pre-seed the room password that `roomId`'s next page load auto-authenticates
 * with. `roomId` is explicit because the create-table flow stashes BEFORE
 * navigating, when the URL still names the old table.
 */
export function stashRoomSecret(
  secret: string,
  roomId: string | undefined = currentRoomId(),
): void {
  try {
    sessionStorage.setItem(roomSecretKey(roomId), secret);
  } catch {
    // Private-mode storage failures just mean the creator re-enters the password.
  }
}

/** The stashed password for a table, or "" if there is none. */
export function readRoomSecret(roomId: string | undefined = currentRoomId()): string {
  try {
    return sessionStorage.getItem(roomSecretKey(roomId)) ?? "";
  } catch {
    return "";
  }
}

/** Forget a table's stashed password (used when its auth is rejected). */
export function clearRoomSecret(roomId: string | undefined = currentRoomId()): void {
  try {
    sessionStorage.removeItem(roomSecretKey(roomId));
  } catch {
    // Nothing to do — a password we cannot clear is one we could not read either.
  }
}

/** Mirrors the server's room-id rule so bad ids fail before a connection. */
export const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export interface RememberedRoom {
  roomId: string;
  lastJoined: number;
}

/** The room this tab targets, or undefined for the server's default table. */
export function currentRoomId(search: string = window.location.search): string | undefined {
  const room = new URLSearchParams(search).get("room")?.trim();
  return room && ROOM_ID_PATTERN.test(room) ? room : undefined;
}

export function listRememberedRooms(): RememberedRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is RememberedRoom =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RememberedRoom).roomId === "string" &&
          ROOM_ID_PATTERN.test((entry as RememberedRoom).roomId) &&
          typeof (entry as RememberedRoom).lastJoined === "number",
      )
      .sort((a, b) => b.lastJoined - a.lastJoined)
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

export function rememberRoom(roomId: string): void {
  if (!ROOM_ID_PATTERN.test(roomId)) return;
  try {
    const rooms = listRememberedRooms().filter((room) => room.roomId !== roomId);
    rooms.unshift({ roomId, lastJoined: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.slice(0, MAX_REMEMBERED)));
  } catch {
    // Private-mode storage failures just mean no shelf memory.
  }
}

export function forgetRoom(roomId: string): void {
  try {
    const rooms = listRememberedRooms().filter((room) => room.roomId !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Ignore storage failures.
  }
}

/** A fresh, unguessable-enough table id, e.g. "table-k3f9x2". */
export function generateRoomId(): string {
  let suffix = "";
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/l/i lookalikes
  const random = new Uint32Array(6);
  crypto.getRandomValues(random);
  for (const value of random) {
    suffix += alphabet[value % alphabet.length];
  }
  return `table-${suffix}`;
}

/** The current page URL pointed at a room (or at the default table). */
export function roomUrl(roomId: string | undefined, href: string = window.location.href): string {
  const url = new URL(href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  return url.toString();
}

/** Full navigation: a room switch needs a fresh socket and a fresh auth. */
export function navigateToRoom(roomId: string | undefined): void {
  window.location.assign(roomUrl(roomId));
}
