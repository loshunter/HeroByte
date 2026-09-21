// ============================================================================
// CONFLICT ESCAPE — the gate's two ways out of "Held in another window"
// ============================================================================
// CONFLICT is terminal on the client (nothing auto-retries), so the gate sits
// on screen until the user picks a way out. There are two:
//
// - Retry — Try Again, the Enter Table button, or Enter in the password
//   field; every one of them reconnects. A conflict right after a deploy or a
//   fast reload self-heals on the first retry (the server reaps the tab's own
//   zombie socket), and from the same browser as the live session a retry
//   presents the newest token and takes the seat back.
// - Start a fresh session (features/auth/freshSession.ts). Irreversible for
//   the old seat, so it is offered only once a retry in THIS conflict has
//   failed — a player mid-campaign is not handed "abandon your character"
//   before "try again" — and it sits behind a native confirm that names the
//   cost, as the table lobby and the token library do for their own
//   destructive steps.
//
// A retry is counted by the TRANSITION out of CONFLICT, not by which control
// started it: the first version counted only the Try Again click, and a user
// who retried with the gold Enter Table button (or Enter in the autofocused
// field) could never reach the fresh-session button at all — while each of
// those attempts spent a non-refunded auth-work token from their network's
// budget. The episode ends when the user gets in or the connection leaves for
// another terminal state — not on a rejected password, since the budget
// refusal arrives the same way.

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthState, ConnectionState } from "../../services/websocket";
import { FRESH_SESSION_CONFIRM, startFreshSession } from "./freshSession";

export interface ConflictEscape {
  /** The gate's retry: reconnects. Counting happens on the state transition. */
  onRetry: () => void;
  /** Present only in CONFLICT after a failed retry; confirms, then acts. */
  onStartFresh?: () => void;
}

export function useConflictEscape(
  connectionState: ConnectionState,
  authState: AuthState,
  onConnect: () => void,
): ConflictEscape {
  const [conflictRetries, setConflictRetries] = useState(0);
  const wasConflict = useRef(false);

  useEffect(() => {
    // Only getting in ends the episode. A FAILED auth is not evidence the
    // conflict is over: the per-IP budget refusal ("Too many attempts") also
    // arrives as auth-failed, and the retries that drained it are exactly the
    // user who needs the way out. A wrong password merely keeps the count —
    // at worst the button shows one retry early, behind its confirm.
    if (authState === AuthState.AUTHENTICATED) {
      wasConflict.current = false;
      setConflictRetries(0);
      return;
    }
    if (connectionState === ConnectionState.CONFLICT) {
      wasConflict.current = true;
      return;
    }
    if (
      connectionState === ConnectionState.REPLACED ||
      connectionState === ConnectionState.DISCONNECTED ||
      connectionState === ConnectionState.FAILED
    ) {
      wasConflict.current = false;
      setConflictRetries(0);
      return;
    }
    // CONNECTING / RECONNECTING / CONNECTED straight out of a conflict: that
    // is the retry, whichever control started it.
    if (wasConflict.current) {
      wasConflict.current = false;
      setConflictRetries((n) => n + 1);
    }
  }, [connectionState, authState]);

  const startFresh = useCallback(() => {
    if (!window.confirm(FRESH_SESSION_CONFIRM)) return;
    startFreshSession();
  }, []);

  return {
    onRetry: onConnect,
    onStartFresh:
      connectionState === ConnectionState.CONFLICT && conflictRetries > 0 ? startFresh : undefined,
  };
}
