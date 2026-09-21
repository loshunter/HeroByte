// ============================================================================
// FRESH SESSION — the way out of "Held in another window"
// ============================================================================
// A tab lands on CONFLICT when the server holds this uid's seat for a session
// this tab cannot prove: another window or device, or a browser that lost its
// session key. The seat stays held while that session is connected and for
// its whole grace window after (six hours) — a retry cannot shorten that, and
// a tab whose key is gone has no other way in. This gives the browser a new
// identity instead: forget the stored uid and every session token, drop a
// `?sessionUid=` override, and reload so the app boots as a new player.
//
// What it does NOT do, on purpose: touch the old seat, or the server at all.
// The old character and token stay at the table until the DM deletes them
// (the entities panel lets a DM delete any character; the linked token goes
// with it) or the table clears itself (the Main Hall wipes after an hour
// empty; a private table never does). The old player's bare roster row
// outlives a character delete — the DM menu's Players tab lists it with no
// tokens — but not a Main Hall clear, which wipes players too; on a private
// table nothing removes it. The old uid's DM flag stays dormant on
// the server until a tokenless reclaim of that uid resets it; from this
// browser those powers are simply unreachable without the DM password. The
// caller confirms all of that with the user first. A table password this tab
// had stored (per-tab sessionStorage) is untouched, so a returning tab lands
// straight at the table; a tab that never logged in here types it once.
// A SIBLING tab of this browser keeps the uid it already read (App.tsx reads
// it once, on purpose) but its stored token is gone, so its next reconnect
// lands on "Held in another window" and takes its own way out — visible, not
// a silent re-identification mid-session.

import {
  clearSessionUID,
  getSessionUIDOverride,
  readStoredSessionUID,
  SESSION_UID_OVERRIDE_PARAM,
} from "../../utils/session";
import { clearSessionTokens } from "../rooms/roomDirectory";

/** What the user is agreeing to. Kept beside the action so the two cannot drift. */
export const FRESH_SESSION_CONFIRM =
  "Start a fresh session? This cannot be undone: this browser becomes a new player and you will " +
  "not get back into your current character. It and its token stay at the table until the DM " +
  "deletes them (the Main Hall also clears itself after an hour empty). Any DM powers on this " +
  "browser are gone; the DM password is needed again. You may need to enter the table password " +
  "again.";

export interface FreshSessionOptions {
  /** The page's current URL; the override param is stripped from it. */
  href?: string;
  /** How to leave for the new URL — a full load, so the app boots with the new uid. */
  navigate?: (url: string) => void;
}

/**
 * Leave for `url` with a full document load. `location.replace` to the SAME
 * URL with a fragment is a scroll, not a load, so an unchanged URL reloads
 * instead — the storage is already wiped by then, and a page left running
 * would re-mint a uid on its next render.
 */
function fullLoad(url: string): void {
  if (url === window.location.href) window.location.reload();
  else window.location.replace(url);
}

/** Forget this browser's identity and reload as a new player. */
export function startFreshSession(options: FreshSessionOptions = {}): void {
  const href = options.href ?? window.location.href;
  const navigate = options.navigate ?? fullLoad;
  const url = new URL(href);
  // Both identities this tab may be carrying — the override in THIS href and
  // the stored one — can differ. Read them before anything is cleared.
  const abandoned = new Set<string>();
  const override = getSessionUIDOverride(url.search);
  if (override) abandoned.add(override);
  const stored = readStoredSessionUID();
  if (stored) abandoned.add(stored);
  url.searchParams.delete(SESSION_UID_OVERRIDE_PARAM);
  try {
    clearSessionUID();
    clearSessionTokens([...abandoned]);
  } finally {
    // Whatever storage did, leave: a button that does nothing is the one
    // outcome worse than a partial wipe, and the reload re-reads the truth.
    navigate(url.toString());
  }
}
