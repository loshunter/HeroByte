/**
 * FloatingPanelsLayout Component
 *
 * Renders floating UI panels and overlays that appear above the main canvas:
 * DM menu, context menu, visual effects, dice roller, roll log, and toasts.
 *
 * Part of Phase 15 SOLID Refactor - MainLayout Decomposition
 * Extracted from: MainLayout.tsx lines 663-774
 *
 * @remarks Pure presentation component with no internal state. The DM menu's
 * ~50 props arrive pre-built as ONE value (buildDMMenuProps) — the mapping
 * from the MainLayoutProps bag lives there, shared with the mobile shell,
 * so this layout no longer hand-derives any DM wiring.
 */

import React, { Suspense, lazy } from "react";
import type { RoomSnapshot, ChatMessage } from "@herobyte/shared";
import type { RollLogEntry } from "../components/dice/rollLogTypes";
import type { DiceRollRequest } from "../hooks/useDiceRolling";
import type { DMMenuContainerProps } from "../features/dm/components/DMMenuContainer";
import { DMMenuLoadFailure } from "../features/dm/DMMenuLoadFailure";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ContextMenu } from "../components/ui/ContextMenu";
import { VisualEffects } from "../components/effects/VisualEffects";
import { DicePanels } from "./DicePanels";
import { ToastContainer } from "../components/ui/Toast";
import { Spinner } from "../components/ui/Spinner";
import type { ToastMessage } from "../components/ui/Toast";

// Lazy-load DMMenuContainer to defer DM-specific code until DM elevation
const DMMenuContainer = lazy(() =>
  import("../features/dm/lazy-entry").then((mod) => ({ default: mod.DMMenuContainer })),
);

type ContextMenuState = { x: number; y: number; tokenId: string } | null;

// RollLogEntry lives in components/dice/rollLogTypes and is re-exported here
// for the layouts that already import it from this module. It was a THIRD
// declaration of the same name (the hook had one too); they disagreed about
// whether `formula` existed, which is what let the roll log render a blank
// formula line while the string sat unread on the object.
export type { RollLogEntry };

/**
 * Props for FloatingPanelsLayout
 * Groups: DM/Context(5), Dice(3), RollLog(6), Effects(1), Toast(1)
 */
export interface FloatingPanelsLayoutProps {
  // DM Status & Context Menu
  isDM: boolean;
  contextMenu: ContextMenuState | null;
  deleteToken: (id: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  /** The DM menu's whole prop surface, built once by buildDMMenuProps. */
  dmMenuProps: DMMenuContainerProps;
  // Shared data (DicePanels reads the player roster off it)
  snapshot: RoomSnapshot | null;
  // Dice Roller
  diceRollerOpen: boolean;
  toggleDiceRoller: (open: boolean) => void;
  handleRoll: (request: DiceRollRequest) => void;
  /** Newest roll authored by this player — how the roller learns its result. */
  latestOwnRoll: RollLogEntry | null;
  // Roll Log
  rollLogOpen: boolean;
  rollHistory: RollLogEntry[];
  chatMessages: ChatMessage[];
  handleSendChat: (text: string, to?: string) => void;
  /** Local player's uid — chat styles your own lines and excludes you as a whisper target. */
  uid: string;
  viewingRoll: RollLogEntry | null;
  toggleRollLog: (open: boolean) => void;
  handleClearLog: () => void;
  handleViewRoll: (roll: RollLogEntry | null) => void;
  // Visual Effects
  crtFilter: boolean;
  // Toast Messages
  toast: {
    messages: ToastMessage[];
    dismiss: (id: string) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

/**
 * FloatingPanelsLayout - Renders floating UI panels and overlays
 */
export const FloatingPanelsLayout = React.memo<FloatingPanelsLayoutProps>(
  ({
    isDM,
    contextMenu,
    deleteToken,
    setContextMenu,
    dmMenuProps,
    snapshot,
    diceRollerOpen,
    toggleDiceRoller,
    handleRoll,
    latestOwnRoll,
    rollLogOpen,
    rollHistory,
    chatMessages,
    handleSendChat,
    uid,
    viewingRoll,
    toggleRollLog,
    handleClearLog,
    handleViewRoll,
    crtFilter,
    toast,
  }) => {
    return (
      <>
        {isDM && (
          // Local boundary: the same lazy chunk the mobile screen loads, with
          // the same exposure — a chunk that 404s (a deploy mid-session
          // invalidating hashed names) throws during render, and without this
          // it reaches the app root and replaces the whole table.
          <ErrorBoundary fallback={<DMMenuLoadFailure />}>
            {/* Not `null`: elevating to DM fires a success toast and then,
                while the chunk downloads, nothing visible happens at all —
                which reads as the elevation having failed. */}
            <Suspense
              fallback={
                <div
                  style={{
                    position: "fixed",
                    right: "16px",
                    bottom: "16px",
                    zIndex: 1002,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "var(--jrpg-bg)",
                    border: "2px solid var(--jrpg-border)",
                    borderRadius: "4px",
                    color: "var(--jrpg-text)",
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                  }}
                >
                  <Spinner size={14} />
                  Loading DM tools…
                </div>
              }
            >
              <DMMenuContainer {...dmMenuProps} />
            </Suspense>
          </ErrorBoundary>
        )}

        <ContextMenu
          menu={contextMenu}
          onDelete={deleteToken}
          onClose={() => setContextMenu(null)}
        />

        <VisualEffects crtFilter={crtFilter} />

        <DicePanels
          diceRollerOpen={diceRollerOpen}
          toggleDiceRoller={toggleDiceRoller}
          handleRoll={handleRoll}
          latestOwnRoll={latestOwnRoll}
          rollLogOpen={rollLogOpen}
          toggleRollLog={toggleRollLog}
          rollHistory={rollHistory}
          handleClearLog={handleClearLog}
          viewingRoll={viewingRoll}
          handleViewRoll={handleViewRoll}
          chatMessages={chatMessages}
          players={snapshot?.players ?? []}
          uid={uid}
          handleSendChat={handleSendChat}
          isDM={isDM}
        />

        <ToastContainer messages={toast.messages} onDismiss={toast.dismiss} />
      </>
    );
  },
);

FloatingPanelsLayout.displayName = "FloatingPanelsLayout";
