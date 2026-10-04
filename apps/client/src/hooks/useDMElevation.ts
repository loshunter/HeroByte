import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

/**
 * Hook for managing DM elevation and revocation with proper state synchronization.
 *
 * Replaces the fire-and-forget pattern with a state-aware approach that:
 * - Tracks loading state while waiting for server confirmation
 * - Monitors snapshot.players[].isDM field for changes
 * - Provides clear success/error feedback
 *
 * @example
 * ```tsx
 * const { isLoading, elevate, revoke, error } = useDMElevation({
 *   snapshot,
 *   uid,
 *   send: sendMessage
 * });
 *
 * // Elevate to DM
 * await elevate("dm-password-123");
 *
 * // Revoke DM status
 * await revoke();
 * ```
 */
/** How long a request may go unanswered before it is given up on, with an error. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * How long after a leave was asked its answer may still arrive. A request the dying socket queued
 * is sent when the socket reconnects, so the roster can confirm it long after the five seconds
 * above have given up on it: the person asked to leave, and is told they have.
 */
const LATE_ANSWER_MS = 60_000;

export function useDMElevation({
  snapshot,
  uid,
  send,
  onRevoked,
  onDMModeEnded,
}: {
  snapshot: RoomSnapshot | null;
  uid: string;
  send: (message: ClientMessage) => void;
  /** The server confirmed a revoke: the roster now lists this seat as no DM. */
  onRevoked?: () => void;
  /** DM mode ended with no leave asked (a server restart clears every elevation). */
  onDMModeEnded?: () => void;
}) {
  const [isElevating, setIsElevating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous isDM state to detect changes
  const prevIsDMRef = useRef<boolean | undefined>(undefined);

  // Get current DM status from snapshot. `seatKnown` is the roster having arrived with this
  // seat in it: a socket close nulls the snapshot while the app stays mounted, and with no
  // roster the flag reads false — "not known", which is not "no longer the DM".
  const seat = snapshot?.players?.find((player) => player.uid === uid);
  const seatKnown = seat !== undefined;
  const currentIsDM = seat?.isDM ?? false;
  const onRevokedRef = useRef(onRevoked);
  onRevokedRef.current = onRevoked;
  const onDMModeEndedRef = useRef(onDMModeEnded);
  onDMModeEndedRef.current = onDMModeEnded;
  // When a leave was last asked, until it is answered or another request withdraws it.
  const leaveAskedAtRef = useRef<number | null>(null);

  // One request in flight, one timer for it. An earlier request's timer must not end a later
  // one early (leave, come back, leave again: the second was told it "timed out" at the first's
  // mark), and a request the roster has answered must leave none running.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const startTimer = useCallback(
    (onTimeout: () => void) => {
      stopTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onTimeout();
      }, REQUEST_TIMEOUT_MS);
    },
    [stopTimer],
  );
  useEffect(() => stopTimer, [stopTimer]);

  // Monitor for DM status changes to detect successful elevation/revocation
  useEffect(() => {
    // A blip confirms nothing, and must not seed the next comparison: a revoke the dying
    // socket never delivered would otherwise read as done, and the seat would still be a DM's.
    if (!seatKnown) return;
    const previousIsDM = prevIsDMRef.current;

    // Initialize on first run
    if (previousIsDM === undefined) {
      prevIsDMRef.current = currentIsDM;
      return;
    }

    // Detect successful elevation (false -> true)
    if (isElevating && !previousIsDM && currentIsDM) {
      stopTimer();
      setIsElevating(false);
      setError(null);
    }

    // Detect successful revocation (true -> false): of the request in flight, or of one whose
    // five seconds ran out a little while ago and which the server has heard since. A demotion
    // nobody asked for (a restart clears every elevation) is neither.
    const askedAt = leaveAskedAtRef.current;
    const answeredLate = !isRevoking && askedAt !== null && Date.now() - askedAt <= LATE_ANSWER_MS;
    if ((isRevoking || answeredLate) && previousIsDM && !currentIsDM) {
      leaveAskedAtRef.current = null;
      if (isRevoking) {
        stopTimer();
        setIsRevoking(false);
      }
      setError(null);
      onRevokedRef.current?.();
    } else if (previousIsDM && !currentIsDM) {
      onDMModeEndedRef.current?.();
    }

    // Update previous state
    prevIsDMRef.current = currentIsDM;
  }, [currentIsDM, seatKnown, isElevating, isRevoking, stopTimer]);

  /**
   * Elevate current player to DM status
   */
  const elevate = useCallback(
    (dmPassword: string) => {
      if (!dmPassword.trim()) {
        setError("Password is required");
        return;
      }

      leaveAskedAtRef.current = null;
      setIsElevating(true);
      setError(null);
      send({ t: "elevate-to-dm", dmPassword: dmPassword.trim() });

      // Set a timeout in case server doesn't respond
      startTimer(() => {
        setIsElevating((prev) => {
          if (prev) {
            setError("Elevation request timed out. Please try again.");
            return false;
          }
          return prev;
        });
      });
    },
    [send, startTimer],
  );

  /**
   * Bootstrap a table that has no DM password yet: set-dm-password on such a
   * table stores the password AND auto-promotes the sender to DM server-side.
   * Success is observed the same way as elevate — isDM flips in the snapshot.
   */
  const bootstrap = useCallback(
    (dmPassword: string) => {
      const trimmed = dmPassword.trim();
      if (trimmed.length < 8) {
        setError("DM password needs at least 8 characters.");
        return;
      }
      if (trimmed.length > 128) {
        setError("DM password must be 128 characters or fewer.");
        return;
      }

      leaveAskedAtRef.current = null;
      setIsElevating(true);
      setError(null);
      send({ t: "set-dm-password", dmPassword: trimmed });

      startTimer(() => {
        setIsElevating((prev) => {
          if (prev) {
            setError("The server did not confirm the DM password. Please try again.");
            return false;
          }
          return prev;
        });
      });
    },
    [send, startTimer],
  );

  /**
   * Surface a server-side elevation failure in the modal (instead of the
   * request silently spinning into the timeout). A null reason clears the
   * pending state without showing an error — used when the failure is being
   * redirected into another flow (e.g. bootstrap mode).
   */
  const notifyElevationFailed = useCallback(
    (reason: string | null) => {
      stopTimer();
      setIsElevating(false);
      setError(reason);
    },
    [stopTimer],
  );

  /** A dialog that opens afresh must not open showing the last request's error. */
  const clearError = useCallback(() => setError(null), []);

  /**
   * Revoke DM status for current player
   */
  const revoke = useCallback(() => {
    leaveAskedAtRef.current = Date.now();
    setIsRevoking(true);
    setError(null);
    send({ t: "revoke-dm" });

    // Set a timeout in case server doesn't respond
    startTimer(() => {
      setIsRevoking((prev) => {
        if (prev) {
          setError("Revocation request timed out. Please try again.");
          return false;
        }
        return prev;
      });
    });
  }, [send, startTimer]);

  return {
    isLoading: isElevating || isRevoking,
    isElevating,
    isRevoking,
    currentIsDM,
    seatKnown,
    elevate,
    bootstrap,
    notifyElevationFailed,
    clearError,
    revoke,
    error,
  };
}
