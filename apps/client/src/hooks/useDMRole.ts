// ============================================================================
// USE DM ROLE HOOK
// ============================================================================
// Determines whether the current player has DM mode enabled and exposes
// a helper to toggle the flag via WebSocket.

import { useMemo, useCallback } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

interface UseDMRoleOptions {
  snapshot: RoomSnapshot | null;
  uid: string;
  send: (message: ClientMessage) => void;
}

interface UseDMRoleReturn {
  isDM: boolean;
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

  const elevateToDM = useCallback(
    (dmPassword: string) => {
      send({ t: "elevate-to-dm", dmPassword });
    },
    [send],
  );

  return { isDM, elevateToDM };
}
