// ============================================================================
// ROLL LOG CONTENT - the tabs, the clear button and the entries
// ============================================================================
// Extracted from RollLog (M4a) so the mobile shell can host the log in a
// MobileScreen while the desktop keeps its DraggableWindow: one content tree,
// two dressings, no drift. The chat tab lives here rather than in a window of
// its own because the mobile dock is a hardcoded 5-column grid — a sixth
// button would overflow it, whereas a tab reaches mobile for free.
//
// First entry opens Chat; an explicit tab choice survives closing the panel
// and moving between the desktop window and phone screen for this player.

import React, { useId, useMemo, useRef } from "react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { RollEntry } from "./RollEntry";
import { ChatTab } from "./ChatTab";
import { nameColors } from "../../features/players/playerColors";
import type { RollLogEntry } from "./rollLogTypes";
import { useLogTab, type LogTab } from "./useLogTab";

export interface RollLogContentProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
  // Chat props are OPTIONAL so every existing render site (and the six
  // render calls in RollLog.formatting.test.tsx) keeps compiling. Without
  // them the panel is exactly what it was, minus the tab strip.
  chatMessages?: ChatMessage[];
  players?: Player[];
  /** Each seated player's colour (C3), for chat and roll log names. */
  playerColors?: ReadonlyMap<string, string>;
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

export const RollLogContent: React.FC<RollLogContentProps> = ({
  rolls,
  onClearLog,
  onViewRoll,
  chatMessages,
  players,
  currentUid,
  onSendChat,
  canClearLog = true,
  playerColors,
}) => {
  const rollNames = useMemo(() => nameColors(playerColors ?? new Map()), [playerColors]);
  const [tab, setTab] = useLogTab(currentUid);
  const tabsId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);
  const chatEnabled = Boolean(onSendChat);
  // Guard the render too: a caller that passes onSendChat but no arrays
  // should get an empty chat, not a crash.
  const activeTab: LogTab = chatEnabled ? tab : "rolls";

  const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, focusedTab: LogTab) => {
    let nextTab: LogTab;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        nextTab = focusedTab === "chat" ? "rolls" : "chat";
        break;
      case "Home":
        nextTab = "chat";
        break;
      case "End":
        nextTab = "rolls";
        break;
      default:
        return;
    }
    event.preventDefault();
    // These keys belong to the tabs, not the table's movement shortcuts.
    event.stopPropagation();
    setTab(nextTab);
    tabListRef.current
      ?.querySelectorAll<HTMLButtonElement>("button")
      [nextTab === "chat" ? 0 : 1]?.focus();
  };

  return (
    <JRPGPanel
      variant="bevel"
      // border-box, or the chat composer falls below the fold of the window
      // around it.
      // There is no global box-sizing reset in this app and that is deliberate
      // (herobyte.css explains why: a global one would drop .mobile-chip under
      // the 44px touch floor). So under the default content-box `height: 100%`
      // sized only the CONTENT, and this panel's 16px of padding plus 6px of
      // border made it 22px TALLER than the box it was filling. The overflow
      // lands at the bottom, which is exactly where the chat input and SEND
      // sit. Precisely: the window ROOT is `overflow: hidden`, but the box that
      // actually contains this panel is DraggableWindow's content div, which is
      // `overflow: auto` — so the 22px became a scroll at scrollTop 0, not a
      // clip. Measured at 1440x900: SEND ended 5px below the visible edge,
      // reachable only by scrolling a window that looked fully open. Scoped to
      // this element for the same reason the dock's is.
      style={{
        padding: "8px",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Both panel containers stay linked; only the active content is mounted. */}
      {chatEnabled && (
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Chat & Rolls"
          aria-orientation="horizontal"
          style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}
        >
          {(["chat", "rolls"] as const).map((name) => (
            <JRPGButton
              key={name}
              role="tab"
              id={`${tabsId}-${name}-tab`}
              aria-controls={`${tabsId}-${name}-panel`}
              aria-selected={activeTab === name}
              tabIndex={activeTab === name ? 0 : -1}
              onClick={(event) => {
                setTab(name);
                event.currentTarget.focus();
              }}
              onKeyDown={(event) => handleTabKey(event, name)}
              variant={activeTab === name ? "primary" : "default"}
              style={{ fontSize: "8px", padding: "6px 12px" }}
            >
              {name.toUpperCase()}
            </JRPGButton>
          ))}
        </div>
      )}

      {chatEnabled && (
        <div
          role="tabpanel"
          id={`${tabsId}-chat-panel`}
          aria-labelledby={`${tabsId}-chat-tab`}
          tabIndex={0}
          hidden={activeTab !== "chat"}
          style={{
            display: activeTab === "chat" ? "flex" : "none",
            flex: 1,
            minHeight: 0,
            flexDirection: "column",
          }}
        >
          {activeTab === "chat" && (
            <ChatTab
              messages={chatMessages ?? []}
              players={players ?? []}
              currentUid={currentUid}
              onSendChat={onSendChat as (text: string, to?: string) => void}
              playerColors={playerColors}
            />
          )}
        </div>
      )}

      <div
        role={chatEnabled ? "tabpanel" : undefined}
        id={chatEnabled ? `${tabsId}-rolls-panel` : undefined}
        aria-labelledby={chatEnabled ? `${tabsId}-rolls-tab` : undefined}
        tabIndex={chatEnabled ? 0 : undefined}
        hidden={activeTab !== "rolls"}
        style={{
          display: activeTab === "rolls" ? "flex" : "none",
          flex: 1,
          minHeight: 0,
          flexDirection: "column",
        }}
      >
        {activeTab === "rolls" && (
          <>
            {canClearLog && rolls.length > 0 && (
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
                    .map((roll) => (
                      <RollEntry
                        key={roll.id}
                        roll={roll}
                        onViewRoll={onViewRoll}
                        nameColor={roll.playerUid ? rollNames.get(roll.playerUid) : undefined}
                      />
                    ))
                )}
              </div>
            </JRPGPanel>
          </>
        )}
      </div>
    </JRPGPanel>
  );
};
