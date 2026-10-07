import { activatePanelLauncher } from "../../interaction/useExplicitDismissal";
// ============================================================================
// CARD CONTROLS COMPONENT
// ============================================================================
// Portrait load and microphone toggle controls

import React, { useId } from "react";
import { claimMicNotice, useMicNotice } from "../../../hooks/micNotice";

interface CardControlsProps {
  /**
   * Which of the player's cards this is (the character's id). REQUIRED: a player with several
   * characters has several mic controls, and a notice claimed by one is shown beside it.
   */
  controlId: string;
  canControlMic: boolean;
  canOpenSettings: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  onOpenSettings: () => void;
}

export const CardControls: React.FC<CardControlsProps> = ({
  controlId,
  canControlMic,
  canOpenSettings,
  micEnabled,
  onToggleMic,
  onOpenSettings,
}) => {
  const noticeId = useId();
  const micNotice = useMicNotice(controlId);
  if (!canControlMic && !canOpenSettings) {
    return <div style={{ height: "30px" }} />;
  }

  return (
    <div className="player-card-controls">
      {canControlMic && (
        <button
          className={micEnabled ? "btn btn-danger" : "btn btn-success"}
          style={{
            fontSize: "var(--player-card-control-font-size, 0.7rem)",
            padding: "var(--player-card-control-padding, 4px 8px)",
          }}
          onClick={() => {
            claimMicNotice(controlId);
            onToggleMic();
          }}
          title={micEnabled ? "Mute mic" : "Unmute mic"}
          aria-label={micEnabled ? "Mute mic" : "Unmute mic"}
          aria-describedby={micNotice ? noticeId : undefined}
        >
          {micEnabled ? "🔇" : "🎤"}
        </button>
      )}
      {canOpenSettings && (
        <button
          className="btn btn-secondary"
          style={{
            fontSize: "var(--player-card-control-font-size, 0.7rem)",
            padding: "var(--player-card-control-padding, 4px 8px)",
          }}
          onClick={(event) => activatePanelLauncher(event, onOpenSettings)}
          title="Open player settings"
          aria-label="Open player settings"
        >
          ⚙️
        </button>
      )}
      {/* Mounted before it has anything to say: a live region added already filled is not
          reliably announced. The card's button only mutes, which cannot fail; a mic that will
          not start is told beside Join voice (VoiceControl). This region shows a notice only
          while this card holds the claim. */}
      {canControlMic && (
        <p id={noticeId} role="status" className="player-card-mic-notice jrpg-text-tiny">
          {micNotice}
        </p>
      )}
    </div>
  );
};
