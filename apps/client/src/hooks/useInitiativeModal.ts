// ============================================================================
// INITIATIVE MODAL HOOK
// ============================================================================
// Single responsibility: Manage which character's initiative modal is open
// Separates modal state from presentation and business logic

import { useState, useCallback, useEffect } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";

/**
 * Custom hook for managing initiative modal state.
 *
 * **Responsibilities**:
 * - Track which character's modal is currently open — by ID, read from the
 *   live `characters` every render, so the dialog follows its character's
 *   current record (a rename shows) and closes when the character is gone. It
 *   used to hold the object it was opened with: a character deleted while its
 *   dialog was open kept a dialog whose Save the server could only ignore.
 * - Tell "gone" from "reconnecting": ANY socket close nulls the snapshot while
 *   the app stays mounted (AuthenticationGate), so `characters` reads empty for
 *   the blip. With `snapshotLoaded` false the dialog keeps the character it last
 *   saw — derived, never latched — and only a snapshot that has arrived can say
 *   the character is gone. Closing on the blip lost the typed value, and a save
 *   in flight vanished with neither its confirm nor its failure shown.
 * - Provide open/close functions
 * - Provide computed isOpen state
 *
 * **Does NOT handle**:
 * - Initiative calculation/rolling
 * - Form validation
 * - Server communication
 * - Rendering logic
 */
export function useInitiativeModal(
  characters: readonly SnapshotCharacter[],
  snapshotLoaded: boolean,
) {
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<SnapshotCharacter | null>(null);
  const live = characterId === null ? null : (characters.find((c) => c.id === characterId) ?? null);
  const held = !snapshotLoaded && lastSeen?.id === characterId ? lastSeen : null;
  const character = live ?? held;

  useEffect(() => {
    if (live) setLastSeen(live);
  }, [live]);

  // Gone is closed: it does not reopen if a character with that id returns.
  useEffect(() => {
    if (characterId !== null && snapshotLoaded && live === null) setCharacterId(null);
  }, [characterId, snapshotLoaded, live]);

  const openModal = useCallback((char: SnapshotCharacter) => {
    setLastSeen(char);
    setCharacterId(char.id);
  }, []);

  const closeModal = useCallback(() => {
    setCharacterId(null);
  }, []);

  const isOpen = character !== null;

  return {
    character,
    isOpen,
    openModal,
    closeModal,
  };
}
