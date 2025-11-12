// ============================================================================
// CHARACTER CREATION MODAL COMPONENT
// ============================================================================
// Modal for creating a new player character with loading state feedback

import React, { useState, useCallback, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";

interface CharacterCreationModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Function to create the character. Returns true if creation initiated.
   */
  onCreateCharacter: (name: string) => boolean;

  /**
   * Whether character creation is in progress
   */
  isCreating: boolean;

  /**
   * Function to close the modal
   */
  onClose: () => void;
}

/**
 * Modal for creating a new player character.
 * Shows loading state while waiting for server confirmation.
 */
export function CharacterCreationModal({
  isOpen,
  onCreateCharacter,
  isCreating,
  onClose,
}: CharacterCreationModalProps): JSX.Element | null {
  const [characterName, setCharacterName] = useState("");
  const [wasCreating, setWasCreating] = useState(false);

  // Auto-close when creation completes
  useEffect(() => {
    if (wasCreating && !isCreating) {
      // Creation finished successfully
      console.log("[CharacterCreationModal] Creation completed, closing modal");
      onClose();
    }
    setWasCreating(isCreating);
  }, [isCreating, wasCreating, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCharacterName("");
    }
  }, [isOpen]);

  const handleCreate = useCallback(() => {
    const trimmedName = characterName.trim();
    if (!trimmedName) {
      return;
    }
    onCreateCharacter(trimmedName);
  }, [characterName, onCreateCharacter]);

  const handleCancel = useCallback(() => {
    if (!isCreating) {
      onClose();
    }
  }, [isCreating, onClose]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isCreating && characterName.trim()) {
        handleCreate();
      } else if (e.key === "Escape" && !isCreating) {
        handleCancel();
      }
    },
    [handleCreate, handleCancel, isCreating, characterName],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={handleCancel}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <JRPGPanel title="Add Character" style={{ width: "400px", maxWidth: "90vw" }}>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Explanation */}
            <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-text-dim)" }}>
              Create a new character with its own HP, portrait, and token that you control.
            </p>

            {/* Name Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                Character Name:
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter character name..."
                disabled={isCreating}
                autoFocus
                style={{
                  padding: "8px",
                  fontSize: "14px",
                  border: "2px solid var(--jrpg-border)",
                  borderRadius: "4px",
                  backgroundColor: isCreating ? "var(--jrpg-bg-dark)" : "var(--jrpg-bg)",
                  color: "var(--jrpg-text)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Loading/Status Message */}
            {isCreating && (
              <div
                className="jrpg-text-small"
                style={{
                  color: "var(--jrpg-gold)",
                  textAlign: "center",
                  padding: "8px",
                }}
              >
                Creating character...
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <JRPGButton onClick={handleCancel} disabled={isCreating}>
                Cancel
              </JRPGButton>
              <JRPGButton
                onClick={handleCreate}
                variant="primary"
                disabled={isCreating || !characterName.trim()}
              >
                {isCreating ? "Creating..." : "Create"}
              </JRPGButton>
            </div>
          </div>
        </JRPGPanel>
      </div>
    </div>
  );
}
