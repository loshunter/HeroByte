// ============================================================================
// ROLL LOG CONTENT - the tabs, the clear button and the entries
// ============================================================================
// Extracted from RollLog (M4a) so the mobile shell can host the log in a
// MobileScreen while the desktop keeps its DraggableWindow: one content tree,
// two dressings, no drift. The chat tab lives here rather than in a window of
// its own because the mobile dock is a hardcoded 5-column grid — a sixth
// button would overflow it, whereas a tab reaches mobile for free.
//
// ROLLS IS THE DEFAULT TAB ON PURPOSE: apps/e2e/dice.spec.ts asserts on
// data-testid="roll-log-entry" being present when the panel opens.

import React, { useState } from "react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { RollEntry } from "./RollEntry";
import { ChatTab } from "./ChatTab";
import type { RollLogEntry } from "./rollLogTypes";

export interface RollLogContentProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
  // Chat props are OPTIONAL so every existing render site (and the six
  // render calls in RollLog.formatting.test.tsx) keeps compiling. Without
  // them the panel is exactly what it was, minus the tab strip.
  chatMessages?: ChatMessage[];
  players?: Player[];
  currentUid?: string;
  onSendChat?: (text: string, to?: string) => void;
  /**
   * Whether this viewer may wipe the log. DM-only server-side, so offering the
   * button to a player would be offering one that silently does nothing.
   * Defaults true so existing render sites (and the formatting tests) are
   * unchanged.
   */
  canClearLog?: boolean;
}

type LogTab = "rolls" | "chat";

export const RollLogContent: React.FC<RollLogContentProps> = ({
  rolls,
  onClearLog,
  onViewRoll,
  chatMessages,
  players,
  currentUid,
  onSendChat,
  canClearLog = true,
}) => {
  const [tab, setTab] = useState<LogTab>("rolls");
  const chatEnabled = Boolean(onSendChat);
  // Guard the render too: a caller that passes onSendChat but no arrays
  // should get an empty chat, not a crash.
  const activeTab: LogTab = chatEnabled ? tab : "rolls";

  return (
    <JRPGPanel
      variant="bevel"
      style={{ padding: "8px", height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Tab strip — matches the DMMenuTabs idiom (JRPGButton variant swap).
          Hidden entirely when chat is not wired, so nothing changes for a
          caller that has not adopted it. */}
      {chatEnabled && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
          <JRPGButton
            onClick={() => setTab("rolls")}
            variant={activeTab === "rolls" ? "primary" : "default"}
            style={{ fontSize: "8px", padding: "6px 12px" }}
          >
            ROLLS
          </JRPGButton>
          <JRPGButton
            onClick={() => setTab("chat")}
            variant={activeTab === "chat" ? "primary" : "default"}
            style={{ fontSize: "8px", padding: "6px 12px" }}
          >
            CHAT
          </JRPGButton>
        </div>
      )}

      {/* Clear button — roll-specific, so it must not offer to clear rolls
          while the chat tab is showing. */}
      {activeTab === "rolls" && canClearLog && rolls.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <JRPGButton
            onClick={onClearLog}
            variant="danger"
            style={{ fontSize: "8px", padding: "6px 12px" }}
          >
            CLEAR
          </JRPGButton>
        </div>
      )}

      {activeTab === "chat" ? (
        <ChatTab
          messages={chatMessages ?? []}
          players={players ?? []}
          currentUid={currentUid}
          onSendChat={onSendChat as (text: string, to?: string) => void}
        />
      ) : (
        /* Roll entries */
        <JRPGPanel variant="simple" style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {rolls.length === 0 ? (
              <div
                className="jrpg-text-small"
                style={{
                  textAlign: "center",
                  color: "var(--jrpg-white)",
                  opacity: 0.5,
                  padding: "20px",
                }}
              >
                No rolls yet...
              </div>
            ) : (
              rolls
                .slice()
                .reverse()
                .map((roll) => <RollEntry key={roll.id} roll={roll} onViewRoll={onViewRoll} />)
            )}
          </div>
        </JRPGPanel>
      )}
    </JRPGPanel>
  );
};
