// ============================================================================
// CHAT TAB - table talk inside the roll-log panel
// ============================================================================
// A sibling of RollEntry rather than more lines in RollLog, for the same
// reason RollEntry moved out: the shell hosts tabs, the tabs own their own
// bodies.
//
// Riding inside the existing panel is deliberate — the mobile dock is a
// hardcoded 5-column grid (Party/Tools/Dice/Chat/View), so a sixth button
// would silently overflow it. A tab costs no dock slot.

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

/** Matches the server's STRING_LIMITS.CHAT_TEXT_MAX; the server rejects past it. */
const CHAT_TEXT_MAX = 2000;

const WHOLE_TABLE = "";
const UNAVAILABLE_TARGET = "unavailable";
const optionValue = (uid: string) => (uid ? `recipient:${uid}` : WHOLE_TABLE);

export interface ChatTabProps {
  messages: ChatMessage[];
  players: Player[];
  /** The local player, so their own lines can be styled as theirs. */
  currentUid?: string;
  onSendChat: (text: string, to?: string) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({ messages, players, currentUid, onSendChat }) => {
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState({ uid: WHOLE_TABLE, name: "Everyone", needsChoice: false });
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Newest message last (chat reads top-to-bottom, unlike the roll log which
  // reverses). Without this the newest entry renders below the fold and the
  // panel never moves: you send a message and watch nothing happen, and
  // incoming messages arrive invisibly.
  // The ref sits on the CONTENT div and we scroll its parent: JRPGPanel is a
  // plain function component and does not forward refs, and the scrolling
  // box (flex:1, overflow:auto) is the panel's own div.
  useEffect(() => {
    const scroller = scrollerRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  // Everyone but you — whispering to yourself is not a feature.
  const whisperTargets = useMemo(
    () => players.filter((player) => player.uid !== currentUid),
    [players, currentUid],
  );

  // Preserve the author's audience and draft when a recipient is removed.
  // Making a private draft public must always require an explicit choice.
  const recipientMissing =
    target.uid !== WHOLE_TABLE && !whisperTargets.some((player) => player.uid === target.uid);
  const targetUnavailable = recipientMissing || target.needsChoice;
  useEffect(() => {
    if (recipientMissing) {
      setTarget((current) =>
        current.uid === target.uid ? { ...current, needsChoice: true } : current,
      );
    }
  }, [recipientMissing, target.uid]);

  const nameFor = (uid: string): string =>
    players.find((player) => player.uid === uid)?.name ?? "unknown";

  const send = () => {
    const text = draft.trim();
    if (!text || targetUnavailable) return;
    onSendChat(text, target.uid === WHOLE_TABLE ? undefined : target.uid);
    setDraft("");
  };

  return (
    <>
      <JRPGPanel variant="simple" style={{ flex: 1, overflow: "auto", padding: "8px" }}>
        <div ref={scrollerRef} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {messages.length === 0 ? (
            <div
              className="jrpg-text-small"
              style={{
                textAlign: "center",
                color: "var(--jrpg-white)",
                opacity: 0.5,
                padding: "20px",
              }}
            >
              No messages yet...
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.authorUid === currentUid;
              const isWhisper = Boolean(message.to);
              const recipientName =
                typeof message.toName === "string" && message.toName.trim()
                  ? message.toName
                  : nameFor(message.to ?? "");
              return (
                <div
                  key={message.id}
                  data-testid="chat-message"
                  className="jrpg-text-small"
                  style={{
                    color: "var(--jrpg-white)",
                    // Whispers read as set apart without relying on colour alone.
                    fontStyle: isWhisper ? "italic" : "normal",
                    opacity: isWhisper ? 0.85 : 1,
                    wordBreak: "break-word",
                  }}
                >
                  <span style={{ color: isMine ? "var(--jrpg-gold)" : "var(--jrpg-cyan)" }}>
                    {isWhisper
                      ? isMine
                        ? `→ ${recipientName}`
                        : `${message.authorName} →`
                      : message.authorName}
                    :{" "}
                  </span>
                  {/* Deliberately NOT sanitizeText. These are React text
                      children, which React escapes by construction — there is
                      no HTML parse here to attack. Running DOMPurify over
                      them adds no safety and actively corrupts the message:
                      any text containing "<" takes DOMPurify's parse path and
                      comes back entity-escaped, so "a < b" renders as
                      "a &lt; b". sanitizeText belongs on innerHTML paths;
                      this is not one. */}
                  {message.text}
                </div>
              );
            })
          )}
        </div>
      </JRPGPanel>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
        {(whisperTargets.length > 0 || targetUnavailable) && (
          <select
            aria-label="Send to"
            value={targetUnavailable ? UNAVAILABLE_TARGET : optionValue(target.uid)}
            onChange={(event) => {
              if (event.target.value === WHOLE_TABLE) {
                setTarget({ uid: WHOLE_TABLE, name: "Everyone", needsChoice: false });
                return;
              }
              const recipient = whisperTargets.find(
                (player) => optionValue(player.uid) === event.target.value,
              );
              if (recipient)
                setTarget({ uid: recipient.uid, name: recipient.name, needsChoice: false });
            }}
            className="jrpg-text-small"
            style={{
              minWidth: 0,
              background: "var(--jrpg-black)",
              color: "var(--jrpg-white)",
              padding: "4px",
            }}
          >
            <option value={WHOLE_TABLE}>Everyone</option>
            {targetUnavailable && (
              <option value={UNAVAILABLE_TARGET} disabled>
                Whisper to {target.name} ({recipientMissing ? "unavailable" : "choose again"})
              </option>
            )}
            {whisperTargets.map((player) => (
              <option key={player.uid} value={optionValue(player.uid)}>
                Whisper to {player.name}
              </option>
            ))}
          </select>
        )}
        {targetUnavailable && (
          <div
            role="status"
            className="jrpg-text-small"
            style={{ color: "var(--jrpg-gold)", fontSize: "11px", lineHeight: 1.6 }}
          >
            {recipientMissing
              ? "Recipient unavailable."
              : "Recipient returned; confirm your choice."}{" "}
            Choose a recipient or Everyone before sending.
          </div>
        )}
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            aria-label="Chat message"
            value={draft}
            maxLength={CHAT_TEXT_MAX}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is left alone so a future multiline
              // composer does not have to relitigate the binding.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={target.uid === WHOLE_TABLE ? "Say something..." : "Whisper something..."}
            className="jrpg-text-small"
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--jrpg-black)",
              color: "var(--jrpg-white)",
              padding: "6px",
            }}
          />
          <JRPGButton
            onClick={send}
            disabled={targetUnavailable}
            variant="primary"
            style={{ fontSize: "8px", padding: "6px 12px" }}
          >
            SEND
          </JRPGButton>
        </div>
      </div>
    </>
  );
};
