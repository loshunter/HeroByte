/**
 * useNpcTokenPlacement Hook
 *
 * Manages NPC token placement with loading state and server confirmation.
 * Monitors the snapshot to detect when a token has been placed by the server,
 * providing loading feedback and preventing the UI from appearing unresponsive.
 *
 * This hook solves the state synchronization issue where clicking "Place on Map"
 * would appear to do nothing until the token actually appeared.
 *
 * @module hooks/useNpcTokenPlacement
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

export interface UseNpcTokenPlacementOptions {
  /**
   * Current room snapshot containing all scene objects (including tokens)
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface UseNpcTokenPlacementReturn {
  /**
   * Whether a token placement is in progress
   */
  isPlacing: boolean;

  /**
   * Initiate NPC token placement with loading state
   */
  placeToken: (npcId: string) => void;

  /**
   * Error message if placement failed, null otherwise
   */
  error: string | null;

  /**
   * ID of the NPC whose token is currently being placed, null otherwise
   */
  placingTokenForNpcId: string | null;
}

/**
 * Hook to manage NPC token placement with server confirmation.
 *
 * @example
 * ```tsx
 * const { isPlacing, placeToken, error, placingTokenForNpcId } = useNpcTokenPlacement({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // Place a token for an NPC
 * <button
 *   onClick={() => placeToken(npcId)}
 *   disabled={isPlacing && placingTokenForNpcId === npcId}
 * >
 *   {isPlacing && placingTokenForNpcId === npcId ? 'Placing...' : 'Place on Map'}
 * </button>
 * ```
 */
export function useNpcTokenPlacement(
  options: UseNpcTokenPlacementOptions,
): UseNpcTokenPlacementReturn {
  const { snapshot, sendMessage } = options;

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placingTokenForNpcId, setPlacingTokenForNpcId] = useState<string | null>(null);

  // Track previous token IDs to detect new tokens
  const prevTokenIdsRef = useRef<Set<string>>(new Set());

  // Update the previous token IDs whenever tokens change (but not during placement)
  useEffect(() => {
    if (!isPlacing) {
      const tokens = snapshot?.sceneObjects?.filter((obj) => obj.type === "token") || [];
      prevTokenIdsRef.current = new Set(tokens.map((t) => t.id));
    }
  }, [snapshot?.sceneObjects, isPlacing]);

  // Monitor snapshot for token placement
  useEffect(() => {
    if (!isPlacing || !placingTokenForNpcId) {
      return;
    }

    const currentTokens = snapshot?.sceneObjects?.filter((obj) => obj.type === "token") || [];

    // Check if a new token with our NPC's characterId appeared
    const newToken = currentTokens.find(
      (token) =>
        token.type === "token" &&
        token.data.characterId === placingTokenForNpcId &&
        !prevTokenIdsRef.current.has(token.id),
    );

    if (newToken) {
      console.log("[useNpcTokenPlacement] Token placement confirmed:", {
        npcId: placingTokenForNpcId,
        tokenId: newToken.id,
      });

      // Success! Update ref and clear loading state
      const updatedTokenIds = new Set(currentTokens.map((t) => t.id));
      prevTokenIdsRef.current = updatedTokenIds;

      setIsPlacing(false);
      setError(null);
      setPlacingTokenForNpcId(null);
    }
  }, [snapshot?.sceneObjects, isPlacing, placingTokenForNpcId]);

  /**
   * Initiate NPC token placement
   */
  const placeToken = useCallback(
    (npcId: string) => {
      if (isPlacing) {
        console.warn("[useNpcTokenPlacement] Token placement already in progress");
        return;
      }

      const npc = snapshot?.characters?.find((c) => c.id === npcId);
      if (!npc) {
        console.error("[useNpcTokenPlacement] NPC not found:", npcId);
        setError("NPC not found");
        return;
      }

      console.log("[useNpcTokenPlacement] Starting token placement:", npcId);

      // Set loading state BEFORE sending message
      setIsPlacing(true);
      setError(null);
      setPlacingTokenForNpcId(npcId);

      // Send the placement message
      sendMessage({ t: "place-npc-token", id: npcId });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsPlacing((prev) => {
          if (prev) {
            // Only set error if STILL placing
            console.error("[useNpcTokenPlacement] Token placement timed out");
            setError("Token placement timed out. Please try again.");
            setPlacingTokenForNpcId(null);
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isPlacing, sendMessage, snapshot?.characters],
  );

  return {
    isPlacing,
    placeToken,
    error,
    placingTokenForNpcId,
  };
}
