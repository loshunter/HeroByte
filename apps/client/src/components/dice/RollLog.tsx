// ============================================================================
// ROLL LOG - scrollable history of rolls, plus the chat tab
// ============================================================================
// The panel is a shell over two tabs. Chat lives here rather than in a window
// of its own because the mobile dock is a hardcoded 5-column grid — a sixth
// button would overflow it, whereas a tab inside the existing "Log" panel
// reaches mobile for free.
//
// ROLLS IS THE DEFAULT TAB ON PURPOSE: apps/e2e/dice.spec.ts asserts on
// data-testid="roll-log-entry" being present when the panel opens.

import React, { useState } from "react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { DraggableWindow } from "./DraggableWindow";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { RollEntry } from "./RollEntry";
import { ChatTab } from "./ChatTab";
import type { RollLogEntry } from "./rollLogTypes";

interface RollLogProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
  onClose?: () => void;
  // Chat props are OPTIONAL so every existing render site (and the six
  // render calls in RollLog.formatting.test.tsx) keeps compiling. Without
  // them the panel is exactly what it was, minus the tab strip.
  chatMessages?: ChatMessage[];
  players?: Player[];
  currentUid?: string;
  onSendChat?: (text: string, to?: string) => void;
}

type LogTab = "rolls" | "chat";

export const RollLog: React.FC<RollLogProps> = ({
  rolls,
  onClearLog,
  onViewRoll,
  onClose,
  chatMessages,
  players,
  currentUid,
  onSendChat,
}) => {
  const [tab, setTab] = useState<LogTab>("rolls");
  const chatEnabled = Boolean(onSendChat);
  // Guard the render too: a caller that passes onSendChat but no arrays
  // should get an empty chat, not a crash.
  const activeTab: LogTab = chatEnabled ? tab : "rolls";

  return (
    <DraggableWindow
      title="⚂ ROLL LOG"
      onClose={onClose}
      initialX={window.innerWidth - 420}
      initialY={100}
      width={400}
      minWidth={350}
      maxWidth={500}
      height={600}
      storageKey="roll-log"
      zIndex={999}
    >
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
        {activeTab === "rolls" && rolls.length > 0 && (
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
    </DraggableWindow>
  );
};
