// ============================================================================
// INITIATIVE MODAL HOOK
// ============================================================================
// Single responsibility: Manage which character's initiative modal is open
// Separates modal state from presentation and business logic

import { useState, useCallback } from "react";
import type { Character } from "@shared";

/**
 * Custom hook for managing initiative modal state.
 *
 * **Responsibilities**:
 * - Track which character's modal is currently open
 * - Provide open/close functions
 * - Provide computed isOpen state
 *
 * **Does NOT handle**:
 * - Initiative calculation/rolling
 * - Form validation
 * - Server communication
 * - Rendering logic
 */
export function useInitiativeModal() {
  const [character, setCharacter] = useState<Character | null>(null);

  const openModal = useCallback((char: Character) => {
    setCharacter(char);
  }, []);

  const closeModal = useCallback(() => {
    setCharacter(null);
  }, []);

  const isOpen = character !== null;

  return {
    character,
    isOpen,
    openModal,
    closeModal,
  };
}
