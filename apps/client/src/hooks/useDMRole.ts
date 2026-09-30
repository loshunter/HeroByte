// ============================================================================
// USE DM ROLE HOOK
// ============================================================================
// Determines whether the current player has DM mode enabled and exposes
// a helper to toggle the flag via WebSocket.

import { useMemo, useCallback, useEffect } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

interface UseDMRoleOptions {
  snapshot: RoomSnapshot | null;
  uid: string;
  send: (message: ClientMessage) => void;
}

interface UseDMRoleReturn {
  isDM: boolean;
  /**
   * The viewer's seat is in the roster — the app's own test that the snapshot
   * has arrived. A socket close nulls the snapshot while the app stays mounted,
   * and for that blip `isDM` reads false: anything that JUDGES the role (Leave
   * DM mode, a demotion) must wait for this.
   */
  roleKnown: boolean;
  elevateToDM: (dmPassword: string) => void;
}

/**
 * Hook to compute DM role state for the current player.
 *
 * @param snapshot - Latest room snapshot from the server
 * @param uid - Current player's UID
 * @param send - WebSocket send helper
 */
export function useDMRole({ snapshot, uid, send }: UseDMRoleOptions): UseDMRoleReturn {
  const isDM = useMemo(() => {
    return snapshot?.players?.find((player) => player.uid === uid)?.isDM ?? false;
  }, [snapshot?.players, uid]);

  const roleKnown = useMemo(
    () => Boolean(snapshot?.players?.some((player) => player.uid === uid)),
    [snapshot?.players, uid],
  );

  const elevateToDM = useCallback(
    (dmPassword: string) => {
      send({ t: "elevate-to-dm", dmPassword });
    },
    [send],
  );

  return { isDM, roleKnown, elevateToDM };
}

/**
 * App caches the last DM-visible snapshot so a DM's NPCs and tokens do not vanish while a
 * reconnect is in flight (every socket close nulls the snapshot, and for that blip the
 * viewer reads as a player). The cache has to end with the role: once the roster HAS
 * arrived (`roleKnown`) and says this seat is no DM — a restart or a revoke cleared the
 * elevation — a later blip would otherwise paint the pre-demotion snapshot, hidden NPCs
 * included, over what is now a player's screen. A local Leave clears it on its own.
 */
export function useClearOnDemotion<T>(
  serverIsDM: boolean,
  roleKnown: boolean,
  cache: T | null,
  setCache: (next: null) => void,
): void {
  useEffect(() => {
    if (roleKnown && !serverIsDM && cache !== null) setCache(null);
  }, [roleKnown, serverIsDM, cache, setCache]);
}
