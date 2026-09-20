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

/**
 * localStorage key PREFIX for the session token the server hands back on
 * `auth-ok`. Presenting it on a reconnect is what proves this browser is the
 * SAME session that logged in — so a reload or a network blip resumes as-is
 * (DM elevation included) and can take over from its own stale socket, while
 * someone else holding only the room password can do neither.
 *
 * SCOPED PER TABLE AND PER UID. Per table for the reason the room secret is
 * (a same-tab table switch must not present table A's token to table B); per
 * uid because two tabs in one browser can carry different `?sessionUid=`
 * identities — the e2e and two-client-review setups do exactly that — and a
 * flat per-table key would let one tab's login overwrite the other's proof.
 *
 * localStorage, NOT sessionStorage, on purpose: sessionStorage is per tab, so a
 * second tab (or a browser reopened after a crash) would never hold the token
 * and could never reclaim its own session. The token is only as durable as the
 * server's record of it — it dies with the server's grace window or its next
 * restart — so a browser left logged in on a shared machine is not a standing
 * key past that.
 */
export const SESSION_TOKEN_STORAGE_KEY = "herobyte-session-token";

/** Per-table, per-uid key. `undefined` roomId means the default table. */
function sessionTokenKey(roomId: string | undefined, uid: string): string {
  return roomId
    ? `${SESSION_TOKEN_STORAGE_KEY}:${roomId}:${uid}`
    : `${SESSION_TOKEN_STORAGE_KEY}:${uid}`;
}

/** Remember the session token the server minted for this uid at this table. */
export function stashSessionToken(
  token: string,
  uid: string,
  roomId: string | undefined = currentRoomId(),
): void {
  try {
    localStorage.setItem(sessionTokenKey(roomId, uid), token);
  } catch {
    // Storage failures just mean the next reconnect logs in as a fresh session.
  }
}

/** The stashed session token for this uid at a table, or undefined if none. */
export function readSessionToken(
  uid: string,
  roomId: string | undefined = currentRoomId(),
): string | undefined {
  try {
    return localStorage.getItem(sessionTokenKey(roomId, uid)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Mirrors the server's room-id rule so bad ids fail before a connection. */
export const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export interface RememberedRoom {
  roomId: string;
  lastJoined: number;
  /** Display name, once we've learned it. Codes alone are unrecognisable. */
  name?: string;
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
      .map((entry) => ({
        ...entry,
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : undefined,
      }))
      .sort((a, b) => b.lastJoined - a.lastJoined)
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

export function rememberRoom(roomId: string, name?: string): void {
  if (!ROOM_ID_PATTERN.test(roomId)) return;
  try {
    const previous = listRememberedRooms().find((room) => room.roomId === roomId);
    const rooms = listRememberedRooms().filter((room) => room.roomId !== roomId);
    // Keep a name we already knew when this call doesn't carry one — joining by
    // code shouldn't downgrade a table back to an unrecognisable string.
    rooms.unshift({ roomId, lastJoined: Date.now(), name: name?.trim() || previous?.name });
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
