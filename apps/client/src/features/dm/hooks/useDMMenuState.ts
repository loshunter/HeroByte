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

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { subscribeDMMenuRequests, takeDMMenuTabRequest } from "../../table/menuRequest";

/**
 * Type for DMMenu tab identifiers
 */
export type DMMenuTab = "map" | "atlas" | "encounter" | "npcs" | "props" | "table";

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
   * Counts the requests ("Table settings…") that opened or moved the menu, 0 when
   * the menu was opened any other way: the tab strip focuses its active tab when
   * this changes to a nonzero value, so focus follows the person to what they
   * asked for. Forgotten when the menu closes.
   */
  focusTabRequest: number;

  /**
   * The currently active tab in the DM menu
   */
  activeTab: DMMenuTab;

  /**
   * Function to set the active tab
   */
  setActiveTab: (tab: DMMenuTab) => void;

  /**
   * The backup file's name (Table → Backups), kept here so it survives a tab switch
   */
  sessionName: string;

  /**
   * Function to set the session name
   */
  setSessionName: (name: string) => void;

  /**
   * Filtered list of NPC characters (excludes PCs)
   */
  npcs: SnapshotCharacter[];
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
  characters: SnapshotCharacter[];
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
  const [sessionName, setSessionName] = useState("table-backup");
  const [focusTabRequest, setFocusTabRequest] = useState(0);

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
   * "Table settings…" in the Table menu asks this menu to open on a tab. A
   * request made before this mounted (the phone's DM screen mounts after the
   * tap) is taken now; later ones arrive through the subscription.
   */
  const isDMRef = useRef(isDM);
  isDMRef.current = isDM;
  // Declared BEFORE the request effect: on mount both run, and the request's ask must win.
  useEffect(() => {
    if (!open) setFocusTabRequest(0);
  }, [open]);
  useEffect(() => {
    const takeRequest = () => {
      // Always taken (so it cannot linger), but honoured for a DM only: a request made for
      // anyone else must not open the menu by itself at the next elevation.
      const tab = takeDMMenuTabRequest();
      if (tab && isDMRef.current) {
        setActiveTab(tab);
        setOpen(true);
        setFocusTabRequest((count) => count + 1);
      }
    };
    takeRequest();
    return subscribeDMMenuRequests(takeRequest);
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
    focusTabRequest,
    activeTab,
    setActiveTab,
    sessionName,
    setSessionName,
    npcs,
  };
}
