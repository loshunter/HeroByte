/**
 * useDMContext Hook
 *
 * Combines all DM-specific hooks and actions into a single context.
 * This hook should only be instantiated when isDM is true, preventing
 * unnecessary hook setup for regular players.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 364-470)
 * Purpose: Enable lazy-loading of DM tooling, reducing bundle size for non-DM players
 *
 * This hook consolidates:
 * - NPC management hooks (creation, update, deletion, token placement, visibility)
 * - Prop management hooks (creation, update, deletion)
 * - Session management (save/load)
 * - Combat controls (start, end, clear initiative, turn navigation)
 *
 * @module features/dm/hooks/useDMContext
 */

import { useCallback } from "react";
import type { RoomSnapshot, ClientMessage, Character, Prop } from "@shared";
import { useNpcCreation } from "./useNpcCreation";
import { useNpcUpdate } from "./useNpcUpdate";
import { useNpcDeletion } from "./useNpcDeletion";
import { useNpcTokenPlacement } from "./useNpcTokenPlacement";
import { usePropCreation } from "./usePropCreation";
import { usePropUpdate } from "./usePropUpdate";
import { usePropDeletion } from "./usePropDeletion";
import { useSessionManagement, type ToastManager } from "../../session/useSessionManagement";

export interface UseDMContextOptions {
  /**
   * Current room snapshot containing all game state
   */
  snapshot: RoomSnapshot | null;

  /**
   * WebSocket message sender for client-server communication
   */
  sendMessage: (message: ClientMessage) => void;

  /**
   * Camera state for prop positioning
   */
  cameraState: { x: number; y: number; scale: number };

  /**
   * Toast notification manager
   */
  toast: ToastManager;
}

export interface UseDMContextReturn {
  // NPC Management
  npcManagement: {
    // Creation
    isCreating: boolean;
    createNpc: () => void;
    creationError: string | null;
    // Update
    isUpdating: boolean;
    updateNpc: (id: string, updates: Partial<Character>) => void;
    updateError: string | null;
    updatingNpcId: string | null;
    // Deletion
    isDeleting: boolean;
    deleteNpc: (id: string) => void;
    deletionError: string | null;
    // Token Placement
    isPlacing: boolean;
    placeToken: (id: string) => void;
    tokenPlacementError: string | null;
    placingTokenForNpcId: string | null;
  };

  // Prop Management
  propManagement: {
    // Creation
    isCreating: boolean;
    createProp: () => void;
    creationError: string | null;
    // Update
    isUpdating: boolean;
    updateProp: (id: string, updates: Pick<Prop, "label" | "imageUrl" | "owner" | "size">) => void;
    updateError: string | null;
    updatingPropId: string | null;
    // Deletion
    isDeleting: boolean;
    deleteProp: (id: string) => void;
    deletionError: string | null;
    deletingPropId: string | null;
  };

  // Session Management
  sessionManagement: {
    handleSaveSession: (sessionName: string) => void;
    handleLoadSession: (file: File) => Promise<void>;
  };

  // Combat Controls
  combatControls: {
    handleStartCombat: () => void;
    handleEndCombat: () => void;
    handleClearAllInitiative: () => void;
    handleNextTurn: () => void;
    handlePreviousTurn: () => void;
    handleDeletePlayerToken: (tokenId: string) => void;
  };
}

/**
 * Hook providing all DM-specific functionality.
 *
 * This hook combines all DM-related hooks and actions, and should only be
 * instantiated when the user has DM privileges. By deferring this hook until
 * DM elevation, we avoid loading unnecessary code for regular players.
 *
 * @param options - Hook dependencies
 * @returns All DM-specific actions and state
 *
 * @example
 * ```tsx
 * // In DMMenu component (lazy-loaded)
 * const dmContext = useDMContext({
 *   snapshot,
 *   sendMessage,
 *   cameraState,
 *   toast
 * });
 *
 * // Pass to child components
 * <NPCsTab npcManagement={dmContext.npcManagement} />
 * <PropsTab propManagement={dmContext.propManagement} />
 * ```
 */
export function useDMContext({
  snapshot,
  sendMessage,
  cameraState,
  toast,
}: UseDMContextOptions): UseDMContextReturn {
  // NPC Management Hooks
  const {
    isCreating: isCreatingNpc,
    createNpc,
    error: npcCreationError,
  } = useNpcCreation({
    snapshot,
    sendMessage,
  });

  const {
    isUpdating: isUpdatingNpc,
    updateNpc,
    error: npcUpdateError,
    targetNpcId: updatingNpcId,
  } = useNpcUpdate({
    snapshot,
    sendMessage,
  });

  const {
    isDeleting: isDeletingNpc,
    deleteNpc,
    error: npcDeletionError,
  } = useNpcDeletion({
    snapshot,
    sendMessage,
  });

  const {
    isPlacing: isPlacingToken,
    placeToken,
    error: tokenPlacementError,
    placingTokenForNpcId,
  } = useNpcTokenPlacement({
    snapshot,
    sendMessage,
  });

  // Note: toggleNpcVisibility hook removed - feature not currently used in DMMenu

  // Prop Management Hooks
  const {
    isCreating: isCreatingProp,
    createProp,
    error: propCreationError,
  } = usePropCreation({
    snapshot,
    sendMessage,
    cameraState,
  });

  const {
    isUpdating: isUpdatingProp,
    updateProp,
    error: propUpdateError,
    targetPropId: updatingPropId,
  } = usePropUpdate({
    snapshot,
    sendMessage,
  });

  const {
    isDeleting: isDeletingProp,
    deleteProp,
    error: propDeletionError,
    deletingPropId,
  } = usePropDeletion({
    snapshot,
    sendMessage,
  });

  // Session Management Hook
  const { handleSaveSession, handleLoadSession } = useSessionManagement({
    snapshot,
    sendMessage,
    toast,
  });

  // Combat Controls (simple message senders)
  const handleStartCombat = useCallback(() => {
    sendMessage({ t: "start-combat" });
  }, [sendMessage]);

  const handleEndCombat = useCallback(() => {
    sendMessage({ t: "end-combat" });
  }, [sendMessage]);

  const handleClearAllInitiative = useCallback(() => {
    sendMessage({ t: "clear-all-initiative" });
  }, [sendMessage]);

  const handleNextTurn = useCallback(() => {
    sendMessage({ t: "next-turn" });
  }, [sendMessage]);

  const handlePreviousTurn = useCallback(() => {
    sendMessage({ t: "previous-turn" });
  }, [sendMessage]);

  const handleDeletePlayerToken = useCallback(
    (tokenId: string) => {
      sendMessage({ t: "delete-token", id: tokenId });
    },
    [sendMessage],
  );

  // Return grouped context
  return {
    npcManagement: {
      isCreating: isCreatingNpc,
      createNpc,
      creationError: npcCreationError,
      isUpdating: isUpdatingNpc,
      updateNpc,
      updateError: npcUpdateError,
      updatingNpcId,
      isDeleting: isDeletingNpc,
      deleteNpc,
      deletionError: npcDeletionError,
      isPlacing: isPlacingToken,
      placeToken,
      tokenPlacementError,
      placingTokenForNpcId,
    },
    propManagement: {
      isCreating: isCreatingProp,
      createProp,
      creationError: propCreationError,
      isUpdating: isUpdatingProp,
      updateProp,
      updateError: propUpdateError,
      updatingPropId,
      isDeleting: isDeletingProp,
      deleteProp,
      deletionError: propDeletionError,
      deletingPropId,
    },
    sessionManagement: {
      handleSaveSession,
      handleLoadSession,
    },
    combatControls: {
      handleStartCombat,
      handleEndCombat,
      handleClearAllInitiative,
      handleNextTurn,
      handlePreviousTurn,
      handleDeletePlayerToken,
    },
  };
}
