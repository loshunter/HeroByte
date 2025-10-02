// ============================================================================
// NAME EDITOR COMPONENT
// ============================================================================
// Inline name editing for player cards

import React from "react";

interface NameEditorProps {
  isEditing: boolean;
  isMe: boolean;
  playerName: string;
  playerUid: string;
  nameInput: string;
  tokenColor?: string;
  onNameInputChange: (value: string) => void;
  onNameEdit: (uid: string, name: string) => void;
  onNameSubmit: (value: string) => void;
}

export const NameEditor: React.FC<NameEditorProps> = ({
  isEditing,
  isMe,
  playerName,
  playerUid,
  nameInput,
  tokenColor,
  onNameInputChange,
  onNameEdit,
  onNameSubmit,
}) => {
  if (isMe && isEditing) {
    return (
      <input
        type="text"
        value={nameInput}
        onChange={(e) => onNameInputChange(e.target.value)}
        onBlur={() => onNameSubmit(nameInput)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onNameSubmit(nameInput);
          }
        }}
        autoFocus
        style={{
          width: "100%",
          fontSize: "0.7rem",
          background: "#111",
          color: "var(--hero-blue)",
          border: "1px solid var(--hero-gold)",
          padding: "2px",
          textAlign: "center",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => {
        if (isMe) {
          onNameEdit(playerUid, playerName);
        }
      }}
      style={{
        cursor: isMe ? "pointer" : "default",
        color: tokenColor || "var(--hero-gold-light)",
        fontWeight: "bold",
        textShadow: "0 0 6px rgba(240, 226, 195, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8)",
      }}
    >
      {playerName}
    </span>
  );
};
