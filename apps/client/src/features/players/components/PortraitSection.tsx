import { activatePanelLauncher } from "../../interaction/useExplicitDismissal";
// ============================================================================
// PORTRAIT SECTION COMPONENT
// ============================================================================
// A character's portrait (a player's, the DM's or an NPC's) with class icon and
// mic level animation

import React, { useId, useMemo } from "react";
import { textOn } from "@herobyte/shared";
import "./portraitSection.css";
import { STATUS_OPTIONS } from "../constants/statusOptions";
import { speakingGlow } from "../playerColors";

interface PortraitSectionProps {
  portrait?: string;
  micLevel?: number;
  isEditable?: boolean;
  onRequestChange?: () => void;
  statusEffects: string[];
  tokenColor?: string;
  onFocusToken?: () => void;
  initiative?: number;
  onInitiativeClick?: () => void;
  isCurrentTurn?: boolean;
}

export const PortraitSection: React.FC<PortraitSectionProps> = ({
  portrait,
  micLevel = 0,
  isEditable = false,
  onRequestChange,
  statusEffects,
  tokenColor = "#5AFFAD",
  onFocusToken,
  initiative,
  onInitiativeClick,
  isCurrentTurn = false,
}) => {
  const hintId = useId();
  const handlePortraitClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Click portrait to change image (when editable)
    if (isEditable && onRequestChange) {
      activatePanelLauncher(event, onRequestChange);
    }
  };

  const handleStatusIconClick = (e: React.MouseEvent) => {
    // Click status icon to focus on token
    e.stopPropagation(); // Prevent portrait click
    if (onFocusToken) {
      onFocusToken();
    }
  };

  // Get emojis for active status effects (up to 3)
  const displayEffects = statusEffects.slice(0, 3).map((effectValue) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === effectValue);
    return option
      ? { emoji: option.emoji, label: option.label }
      : { emoji: "", label: effectValue };
  });

  const hasMoreEffects = statusEffects.length > 3;
  const overflowLabels = statusEffects.slice(3).map((effectValue) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === effectValue);
    return option?.label ?? effectValue;
  });

  // Memoised: the card re-renders with every mic level while someone speaks.
  const glow = useMemo(() => speakingGlow(tokenColor), [tokenColor]);
  const animatedBoxShadow = micLevel > 0.1 ? `0 0 12px ${glow}` : "0 0 6px rgba(8, 12, 24, 0.6)";
  const placeholderText = textOn(tokenColor);
  const currentTurnGlow = "0 0 18px rgba(255, 215, 0, 0.85), 0 0 32px rgba(255, 215, 0, 0.35)";

  const frameStyles: React.CSSProperties = {
    position: "relative",
    flex: 1,
    width: "100%",
    border: "2px solid var(--jrpg-border-gold)",
    borderRadius: "8px",
    overflow: "hidden",
    background: "var(--jrpg-navy)",
    transform: micLevel > 0.1 ? `scale(${1 + micLevel * 0.15})` : "scale(1)",
    transition: "transform 0.1s ease-out, box-shadow 0.2s ease",
    boxShadow: isCurrentTurn ? currentTurnGlow : animatedBoxShadow,
    aspectRatio: "1 / 1",
    padding: 0,
    cursor: isEditable ? "pointer" : "default",
    outline: "none",
    borderColor: isCurrentTurn ? "var(--jrpg-gold)" : "var(--jrpg-border-gold)",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        width: "100%",
      }}
    >
      {/* Icon column: Camera snap + Initiative button */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="jrpg-icon"
          onClick={handleStatusIconClick}
          style={{
            position: "relative",
            width: "26px",
            height: "26px",
            background: "linear-gradient(135deg, var(--jrpg-dice-blue) 0%, var(--jrpg-gold) 100%)",
            border: "2px solid var(--jrpg-border-gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: statusEffects.length === 0 ? "14px" : "10px",
            boxShadow: "0 0 6px var(--jrpg-border-gold)",
            cursor: onFocusToken ? "pointer" : "default",
            padding: 0,
            lineHeight: 1,
          }}
          title={
            statusEffects.length > 0
              ? displayEffects.map((e) => e.label).join(", ") +
                (hasMoreEffects ? `, +${statusEffects.length - 3} more` : "")
              : onFocusToken
                ? "Focus on token"
                : "No status effects"
          }
          disabled={!onFocusToken}
          aria-label={onFocusToken ? "Focus camera on token" : "Status effects"}
        >
          {statusEffects.length === 0 ? (
            "⚔️"
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1px",
              }}
            >
              {displayEffects.map((effect, i) => (
                <span key={i} style={{ lineHeight: 0.8 }}>
                  {effect.emoji}
                </span>
              ))}
              {hasMoreEffects && (
                <span style={{ fontSize: "8px", lineHeight: 1 }}>+{statusEffects.length - 3}</span>
              )}
            </div>
          )}
        </button>

        {/* Initiative badge: READS for every viewer (the number is drawn nowhere
            else), ACTS only where the roll would land — the owner's card, or any
            card for a DM (the caller decides by handing a handler). A player
            reading the DM's ally's 18 must still see the 18. */}
        {(onInitiativeClick || initiative !== undefined) && (
          <button
            type="button"
            className="jrpg-icon jrpg-text-small"
            disabled={!onInitiativeClick}
            onClick={(e) => {
              e.stopPropagation();
              onInitiativeClick?.();
            }}
            style={{
              position: "relative",
              width: "40px",
              height: "22px",
              background:
                initiative !== undefined
                  ? "linear-gradient(135deg, var(--jrpg-gold) 0%, var(--jrpg-dice-blue) 100%)"
                  : "var(--jrpg-navy)",
              border: "2px solid var(--jrpg-border-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "bold",
              boxShadow:
                initiative !== undefined
                  ? "0 0 8px var(--jrpg-gold)"
                  : "0 0 4px var(--jrpg-border-gold)",
              cursor: onInitiativeClick ? "pointer" : "default",
              padding: 0,
              color: "var(--jrpg-white)",
            }}
            title={initiative !== undefined ? `Initiative: ${initiative}` : "Set Initiative"}
            aria-label={onInitiativeClick ? "Set Initiative" : `Initiative ${initiative}`}
          >
            {initiative !== undefined ? initiative : "Init"}
          </button>
        )}
      </div>

      <button
        type="button"
        className="jrpg-portrait-frame"
        style={frameStyles}
        onClick={handlePortraitClick}
        aria-label={isEditable ? "Change portrait" : "Portrait"}
        // The empty frame's instruction stays available when a narrow card
        // hides its line (portraitSection.css).
        aria-describedby={isEditable && !portrait ? hintId : undefined}
        disabled={!isEditable}
        tabIndex={isEditable ? 0 : -1}
      >
        {portrait ? (
          <img
            key={portrait.substring(0, 100)}
            src={portrait}
            alt="Portrait"
            className="jrpg-portrait-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
            }}
            draggable={false}
            onError={(e) => {
              console.error("[PortraitSection] Failed to load portrait image:", portrait);
              console.error("[PortraitSection] Error event:", e);
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            data-testid="portrait-placeholder"
            className="portrait-placeholder"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              backgroundColor: tokenColor,
              // Black or white on the colour, whichever reads (white was 1.3:1 on the default green).
              color: placeholderText,
              textAlign: "center",
              padding: "6px",
              textShadow: placeholderText === "#000000" ? "none" : "0 1px 3px rgba(0, 0, 0, 0.45)",
              pointerEvents: "none",
              // The frame is a <button>, and the global button rule set this
              // in uppercase pixel type, which clipped the instruction in a
              // card-sized square (IA-20). Readable body type that wraps.
              fontFamily: "var(--font-body)",
              textTransform: "none",
              letterSpacing: "normal",
              overflowWrap: "anywhere",
              lineHeight: 1.25,
            }}
          >
            <span className="portrait-placeholder__title" style={{ fontWeight: 700 }}>
              {/* Not "Portrait Pending": nothing is on its way; there is none. */}
              {isEditable ? "+ Add portrait" : "No portrait yet"}
            </span>
            {isEditable ? (
              <span
                id={hintId}
                className="portrait-placeholder__hint"
                style={{ fontSize: "0.68rem", fontWeight: 400, opacity: 0.9 }}
              >
                Upload or paste a link
              </span>
            ) : null}
          </div>
        )}
        {statusEffects.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              display: "flex",
              gap: "4px",
              pointerEvents: "auto",
            }}
          >
            {displayEffects.map((effect, index) => (
              <div
                key={`${effect.label}-${index}`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "1px solid var(--jrpg-border-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  pointerEvents: "auto",
                }}
                title={effect.label}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {effect.emoji || "?"}
              </div>
            ))}
            {hasMoreEffects && (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "1px solid var(--jrpg-border-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "var(--jrpg-white)",
                  pointerEvents: "auto",
                }}
                title={`+${statusEffects.length - 3} more: ${overflowLabels.join(", ")}`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                +{statusEffects.length - 3}
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
};
