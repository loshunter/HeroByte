// ============================================================================
// CHAT TAB - table talk inside the roll-log panel
// ============================================================================
// A sibling of RollEntry rather than more lines in RollLog, for the same
// reason RollEntry moved out: the shell hosts tabs, the tabs own their own
// bodies.
//
// Riding inside the existing panel is deliberate — the mobile dock is a
// hardcoded 5-column grid (Party/Tools/Dice/Log/View), so a sixth button
// would silently overflow it. A tab costs no dock slot.

import React, { useMemo, useState } from "react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { sanitizeText } from "../../utils/sanitize";

/** Matches the server's STRING_LIMITS.CHAT_TEXT_MAX; the server rejects past it. */
const CHAT_TEXT_MAX = 2000;

const WHOLE_TABLE = "";

export interface ChatTabProps {
  messages: ChatMessage[];
  players: Player[];
  /** The local player, so their own lines can be styled as theirs. */
  currentUid?: string;
  onSendChat: (text: string, to?: string) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({ messages, players, currentUid, onSendChat }) => {
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState<string>(WHOLE_TABLE);

  // Everyone but you — whispering to yourself is not a feature.
  const whisperTargets = useMemo(
    () => players.filter((player) => player.uid !== currentUid),
    [players, currentUid],
  );

  // A target who leaves would otherwise strand the composer in a whisper to
  // nobody, silently. Fall back to the whole table.
  const effectiveTarget =
    target !== WHOLE_TABLE && whisperTargets.some((p) => p.uid === target) ? target : WHOLE_TABLE;

  const nameFor = (uid: string): string =>
    players.find((player) => player.uid === uid)?.name ?? "unknown";

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSendChat(text, effectiveTarget === WHOLE_TABLE ? undefined : effectiveTarget);
    setDraft("");
  };

  return (
    <>
      <JRPGPanel variant="simple" style={{ flex: 1, overflow: "auto", padding: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                        ? `→ ${sanitizeText(nameFor(message.to as string))}`
                        : `${sanitizeText(message.authorName)} →`
                      : sanitizeText(message.authorName)}
                    :{" "}
                  </span>
                  {/* Rendered as React text, never as HTML. */}
                  {sanitizeText(message.text)}
                </div>
              );
            })
          )}
        </div>
      </JRPGPanel>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
        {whisperTargets.length > 0 && (
          <select
            aria-label="Send to"
            value={effectiveTarget}
            onChange={(event) => setTarget(event.target.value)}
            className="jrpg-text-small"
            style={{ background: "var(--jrpg-black)", color: "var(--jrpg-white)", padding: "4px" }}
          >
            <option value={WHOLE_TABLE}>Everyone</option>
            {whisperTargets.map((player) => (
              <option key={player.uid} value={player.uid}>
                Whisper to {player.name}
              </option>
            ))}
          </select>
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
            placeholder={
              effectiveTarget === WHOLE_TABLE ? "Say something..." : "Whisper something..."
            }
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
