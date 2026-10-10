// ============================================================================
// NAME EDITOR COMPONENT
// ============================================================================
// Inline name editing for player cards

import React from "react";
import { readableOn } from "@herobyte/shared";
import { sanitizeText } from "../../../utils/sanitize";
import { CARD_TOP } from "../playerColors";

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
  /** The server's name limit, where the caller knows it. */
  maxLength?: number;
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
  maxLength,
}) => {
  if (isMe && isEditing) {
    return (
      <input
        type="text"
        value={nameInput}
        maxLength={maxLength}
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
          boxSizing: "border-box",
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
        display: "block",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: isMe ? "pointer" : "default",
        // The card's colour, lifted to 4.5:1 on the card's lightest stop.
        color: tokenColor
          ? (readableOn(tokenColor, CARD_TOP) ?? tokenColor)
          : "var(--hero-gold-light)",
        fontWeight: "bold",
        // The cream glow suits the gold name. Behind a lifted colour it lightens the
        // very ground the lift was measured on (to about 2.4:1), so a coloured name
        // gets a dark halo, which only adds contrast.
        textShadow: tokenColor
          ? "0 0 4px rgba(11, 11, 22, 0.9), 1px 1px 2px rgba(0, 0, 0, 0.8)"
          : "0 0 6px rgba(240, 226, 195, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8)",
      }}
    >
      {sanitizeText(playerName)}
    </span>
  );
};
