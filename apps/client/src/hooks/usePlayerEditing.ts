// ============================================================================
// USE PLAYER EDITING HOOK
// ============================================================================
// Manages player name and max HP editing state

import { useState, useCallback } from "react";

interface UsePlayerEditingReturn {
  editingPlayerUID: string | null;
  nameInput: string;
  editingHpUID: string | null;
  hpInput: string;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  startNameEdit: (uid: string, currentName: string) => void;
  updateNameInput: (name: string) => void;
  submitNameEdit: (onSubmit: (name: string) => void) => void;
  startHpEdit: (uid: string, currentHp: number) => void;
  updateHpInput: (hp: string) => void;
  submitHpEdit: (onSubmit: (hp: number) => void) => void;
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

  // Current HP editing
  const [editingHpUID, setEditingHpUID] = useState<string | null>(null);
  const [hpInput, setHpInput] = useState("");

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

  const submitNameEdit = useCallback(
    (onSubmit: (name: string) => void) => {
      if (nameInput.trim()) {
        onSubmit(nameInput.trim());
      }
      setEditingPlayerUID(null);
      setNameInput("");
    },
    [nameInput],
  );

  const startHpEdit = useCallback((uid: string, currentHp: number) => {
    setEditingHpUID(uid);
    setHpInput(String(currentHp));
  }, []);

  const updateHpInput = useCallback((hp: string) => {
    setHpInput(hp);
  }, []);

  const submitHpEdit = useCallback(
    (onSubmit: (hp: number) => void) => {
      const parsed = parseInt(hpInput, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        onSubmit(parsed);
      }
      setEditingHpUID(null);
      setHpInput("");
    },
    [hpInput],
  );

  const startMaxHpEdit = useCallback((uid: string, currentMaxHp: number) => {
    setEditingMaxHpUID(uid);
    setMaxHpInput(String(currentMaxHp));
  }, []);

  const updateMaxHpInput = useCallback((maxHp: string) => {
    setMaxHpInput(maxHp);
  }, []);

  const submitMaxHpEdit = useCallback(
    (onSubmit: (maxHp: number) => void) => {
      const parsed = parseInt(maxHpInput, 10);
      if (!isNaN(parsed) && parsed > 0) {
        onSubmit(parsed);
      }
      setEditingMaxHpUID(null);
      setMaxHpInput("");
    },
    [maxHpInput],
  );

  return {
    editingPlayerUID,
    nameInput,
    editingHpUID,
    hpInput,
    editingMaxHpUID,
    maxHpInput,
    startNameEdit,
    updateNameInput,
    submitNameEdit,
    startHpEdit,
    updateHpInput,
    submitHpEdit,
    startMaxHpEdit,
    updateMaxHpInput,
    submitMaxHpEdit,
  };
}
