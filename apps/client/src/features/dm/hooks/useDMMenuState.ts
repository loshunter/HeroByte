// ============================================================================
// USE DM MENU STATE HOOK
// ============================================================================
// Manages the state for the DMMenu component, including:
// - Open/closed state
// - Active tab selection
// - Session name
// - Filtered NPCs list
// - Auto-close on DM mode exit
//
// Extracted from: apps/client/src/features/dm/components/DMMenu.tsx (lines 127-139)
// Extraction date: 2025-10-21

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Character } from "@shared";

/**
 * Type for DMMenu tab identifiers
 */
export type DMMenuTab = "map" | "npcs" | "props" | "session";

/**
 * State object returned by useDMMenuState hook
 */
export interface DMMenuState {
  /**
   * Whether the DM menu is currently open
   */
  open: boolean;

  /**
   * Function to set the open state directly
   */
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  /**
   * Toggle function to open/close the menu
   */
  toggleOpen: () => void;

  /**
   * The currently active tab in the DM menu
   */
  activeTab: DMMenuTab;

  /**
   * Function to set the active tab
   */
  setActiveTab: (tab: DMMenuTab) => void;

  /**
   * The current session name (used for save/load operations)
   */
  sessionName: string;

  /**
   * Function to set the session name
   */
  setSessionName: (name: string) => void;

  /**
   * Filtered list of NPC characters (excludes PCs)
   */
  npcs: Character[];
}

/**
 * Options for useDMMenuState hook
 */
export interface UseDMMenuStateOptions {
  /**
   * Whether the current user has DM privileges
   */
  isDM: boolean;

  /**
   * All characters in the game (PCs and NPCs)
   */
  characters: Character[];
}

/**
 * Hook to manage DM menu state
 *
 * Encapsulates all state management for the DM menu component:
 * - Open/closed state with toggle function
 * - Active tab selection
 * - Session name for save/load operations
 * - Filtered NPCs list (derived from characters)
 * - Auto-close behavior when DM mode is disabled
 *
 * @param options - Configuration options
 * @param options.isDM - Whether the current user has DM privileges
 * @param options.characters - All characters in the game (PCs and NPCs)
 * @returns DMMenuState object containing all state and setters
 *
 * @example
 * ```tsx
 * const {
 *   open,
 *   setOpen,
 *   toggleOpen,
 *   activeTab,
 *   setActiveTab,
 *   sessionName,
 *   setSessionName,
 *   npcs
 * } = useDMMenuState({ isDM, characters });
 *
 * // Toggle menu
 * <button onClick={toggleOpen}>DM Menu</button>
 *
 * // Switch tabs
 * <button onClick={() => setActiveTab("npcs")}>NPCs</button>
 *
 * // Use filtered NPCs
 * npcs.forEach(npc => {
 *   // Render NPC
 * });
 * ```
 */
export function useDMMenuState({ isDM, characters }: UseDMMenuStateOptions): DMMenuState {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
  const [sessionName, setSessionName] = useState("session");

  /**
   * Memoized list of NPCs filtered from all characters
   * Only includes characters with type === "npc"
   */
  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

  /**
   * Toggle the open state
   */
  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  /**
   * Auto-close the menu when DM mode is disabled
   * Ensures the menu is not visible to non-DM users
   */
  useEffect(() => {
    if (!isDM) {
      setOpen(false);
    }
  }, [isDM]);

  return {
    open,
    setOpen,
    toggleOpen,
    activeTab,
    setActiveTab,
    sessionName,
    setSessionName,
    npcs,
  };
}
