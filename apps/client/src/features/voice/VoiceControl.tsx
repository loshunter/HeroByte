// ============================================================================
// VOICE CONTROL
// ============================================================================
// Join / Mute / Leave for the table's voice call, the same three presses on a
// phone and a PC. Where it sits decides only how much it says:
//  - "header": the desktop header, always there.
//  - "chip": the phone's top stack, shown only while a call is running or you
//    are in one, so an idle table keeps its map clear.
//  - "panel": the phone Party screen, always there (the way to start a call),
//    with who is in the call written out (a phone has no hover titles).
// The connections are invisible: a person you cannot reach shows as one plain
// line ("Can't reach Sam"), and the mesh keeps calling them again.

import React, { useId } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { claimMicNotice, useMicNotice } from "../../hooks/micNotice";
import { useVoiceContext } from "./VoiceContext";
import "./voice.css";

/**
 * The mic-notice owner for one placement: a failure shows beside the Join that
 * was pressed, not in every voice control on screen (the phone's chip and its
 * Party screen can both be up).
 */
export const voiceNoticeOwner = (variant: Variant) => `voice-control:${variant}`;

export type Variant = "header" | "chip" | "panel";

const SMALL: React.CSSProperties = { fontSize: "8px", padding: "4px 10px" };

export function VoiceControl({ variant }: { variant: Variant }): JSX.Element | null {
  const voice = useVoiceContext();
  const notice = useMicNotice(voiceNoticeOwner(variant));
  const noticeId = useId();
  if (!voice) return null;
  const { state, inCall, links, audioBlocked, selfUid } = voice;
  const inVoice = state === "live" || state === "muted";
  const others = inCall.filter((person) => person.uid !== selfUid);
  // The chip stays while it has something to say (why you left the call).
  if (variant === "chip" && !inVoice && state !== "joining" && others.length === 0 && !notice) {
    return null;
  }

  const count = inVoice ? inCall.length : others.length;
  const countText = count === 1 ? "1 in call" : `${count} in call`;
  const names = inCall
    .map(
      (person) =>
        `${person.uid === selfUid ? "You" : person.name}${person.muted ? " (muted)" : ""}`,
    )
    .join(", ");
  const unreachable = others.filter((person) => links[person.uid] === "failing").map((p) => p.name);
  const connected = Object.values(links).filter((link) => link === "connected").length;
  const buttonStyle = variant === "header" ? SMALL : undefined;

  return (
    <div
      role="group"
      aria-label="Voice chat"
      className={`voice-control voice-control--${variant}`}
      data-voice-state={state}
      data-voice-connected={connected}
    >
      {inVoice ? (
        <>
          <JRPGButton
            variant={state === "muted" ? "danger" : "default"}
            style={buttonStyle}
            onClick={voice.toggleMute}
            title={
              state === "muted" ? "Unmute your mic" : "Mute your mic (you still hear everyone)"
            }
          >
            {state === "muted" ? "🔇 Unmute" : "🎤 Mute"}
          </JRPGButton>
          <JRPGButton style={buttonStyle} onClick={voice.leave} title="Leave the voice call">
            Leave voice
          </JRPGButton>
        </>
      ) : (
        <JRPGButton
          variant="success"
          style={buttonStyle}
          aria-busy={state === "joining"}
          aria-describedby={notice ? noticeId : undefined}
          onClick={() => {
            claimMicNotice(voiceNoticeOwner(variant));
            void voice.join();
          }}
          title="Join the table's voice call (your browser asks for the mic the first time)"
        >
          {state === "joining" ? "Joining…" : "🎤 Join voice"}
        </JRPGButton>
      )}
      {count > 0 ? (
        <span className="voice-control__count" title={names}>
          {countText}
        </span>
      ) : null}
      {variant === "panel" && count > 0 ? (
        <span className="voice-control__names">In the call: {names}</span>
      ) : null}
      {audioBlocked ? (
        <JRPGButton variant="primary" style={buttonStyle} onClick={voice.resumeAudio}>
          🔊 Tap to hear voice
        </JRPGButton>
      ) : null}
      {/* Mounted before it has anything to say (a live region added already
          filled is not reliably announced): why the mic would not start, that
          the browser paused the voices, and who cannot be reached. */}
      <p
        id={noticeId}
        role="status"
        className="player-card-mic-notice jrpg-text-tiny voice-control__notice"
      >
        {notice ? <span>{notice}</span> : null}
        {audioBlocked ? <span>The browser paused the voices. </span> : null}
        {inVoice && unreachable.length > 0 ? (
          <span className="voice-control__trouble">{`Can't reach ${unreachable.join(", ")}`}</span>
        ) : null}
      </p>
    </div>
  );
}
