// ============================================================================
// USE PLAYER EDITING HOOK
// ============================================================================
// Manages player name and max HP editing state

import { useState, useCallback } from "react";

interface UsePlayerEditingReturn {
  editingPlayerUID: string | null;
  nameInput: string;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  startNameEdit: (uid: string, currentName: string) => void;
  updateNameInput: (name: string) => void;
  submitNameEdit: (onSubmit: (name: string) => void) => void;
  startMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  updateMaxHpInput: (maxHp: string) => void;
  submitMaxHpEdit: (onSubmit: (maxHp: number) => void) => void;
}

/**
 * Hook to manage player editing state (name and max HP)
 *
 * Tracks which player is being edited and the current input values.
 * Provides helpers for starting/submitting edits.
 *
 * Example usage:
 * ```tsx
 * const {
 *   editingPlayerUID, nameInput,
 *   startNameEdit, updateNameInput, submitNameEdit
 * } = usePlayerEditing();
 * ```
 */
export function usePlayerEditing(): UsePlayerEditingReturn {
  // Player name editing
  const [editingPlayerUID, setEditingPlayerUID] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Max HP editing
  const [editingMaxHpUID, setEditingMaxHpUID] = useState<string | null>(null);
  const [maxHpInput, setMaxHpInput] = useState("");

  const startNameEdit = useCallback((uid: string, currentName: string) => {
    setEditingPlayerUID(uid);
    setNameInput(currentName);
  }, []);

  const updateNameInput = useCallback((name: string) => {
    setNameInput(name);
  }, []);

  const submitNameEdit = useCallback((onSubmit: (name: string) => void) => {
    if (nameInput.trim()) {
      onSubmit(nameInput.trim());
    }
    setEditingPlayerUID(null);
    setNameInput("");
  }, [nameInput]);

  const startMaxHpEdit = useCallback((uid: string, currentMaxHp: number) => {
    setEditingMaxHpUID(uid);
    setMaxHpInput(String(currentMaxHp));
  }, []);

  const updateMaxHpInput = useCallback((maxHp: string) => {
    setMaxHpInput(maxHp);
  }, []);

  const submitMaxHpEdit = useCallback((onSubmit: (maxHp: number) => void) => {
    const parsed = parseInt(maxHpInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onSubmit(parsed);
    }
    setEditingMaxHpUID(null);
    setMaxHpInput("");
  }, [maxHpInput]);

  return {
    editingPlayerUID,
    nameInput,
    editingMaxHpUID,
    maxHpInput,
    startNameEdit,
    updateNameInput,
    submitNameEdit,
    startMaxHpEdit,
    updateMaxHpInput,
    submitMaxHpEdit,
  };
}
