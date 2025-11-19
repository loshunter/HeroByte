import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

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
export function useDMElevation({
  snapshot,
  uid,
  send,
}: {
  snapshot: RoomSnapshot | null;
  uid: string;
  send: (message: ClientMessage) => void;
}) {
  const [isElevating, setIsElevating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous isDM state to detect changes
  const prevIsDMRef = useRef<boolean | undefined>(undefined);

  // Get current DM status from snapshot
  const currentIsDM = snapshot?.players?.find((player) => player.uid === uid)?.isDM ?? false;

  // Monitor for DM status changes to detect successful elevation/revocation
  useEffect(() => {
    const previousIsDM = prevIsDMRef.current;

    // Initialize on first run
    if (previousIsDM === undefined) {
      prevIsDMRef.current = currentIsDM;
      return;
    }

    // Detect successful elevation (false -> true)
    if (isElevating && !previousIsDM && currentIsDM) {
      setIsElevating(false);
      setError(null);
    }

    // Detect successful revocation (true -> false)
    if (isRevoking && previousIsDM && !currentIsDM) {
      setIsRevoking(false);
      setError(null);
    }

    // Update previous state
    prevIsDMRef.current = currentIsDM;
  }, [currentIsDM, isElevating, isRevoking]);

  /**
   * Elevate current player to DM status
   */
  const elevate = useCallback(
    (dmPassword: string) => {
      if (!dmPassword.trim()) {
        setError("Password is required");
        return;
      }

      setIsElevating(true);
      setError(null);
      send({ t: "elevate-to-dm", dmPassword: dmPassword.trim() });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsElevating((prev) => {
          if (prev) {
            setError("Elevation request timed out. Please try again.");
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [send],
  );

  /**
   * Revoke DM status for current player
   */
  const revoke = useCallback(() => {
    setIsRevoking(true);
    setError(null);
    console.trace("[useDMElevation] revoke() sending revoke-dm");
    send({ t: "revoke-dm" });

    // Set a timeout in case server doesn't respond
    setTimeout(() => {
      setIsRevoking((prev) => {
        if (prev) {
          setError("Revocation request timed out. Please try again.");
          return false;
        }
        return prev;
      });
    }, 5000);
  }, [send]);

  return {
    isLoading: isElevating || isRevoking,
    isElevating,
    isRevoking,
    currentIsDM,
    elevate,
    revoke,
    error,
  };
}
