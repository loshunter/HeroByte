// ============================================================================
// DICE PANELS — the roller, the log, and a roll opened from it
// ============================================================================
// Extracted from FloatingPanelsLayout (2026-08-04) when S5's extra props
// pushed that file to 356 LOC, six over the structure guard. The three panels
// are one concern — everything the dice surface renders on desktop — so they
// leave together rather than the guard being re-baselined.

import React, { useRef } from "react";
import { useEscapeRoot } from "../features/interaction/useEscapeOwner";
import type { ChatMessage, Player } from "@herobyte/shared";
import { DiceRoller } from "../components/dice/DiceRoller";
import { ResultPanel } from "../components/dice/ResultPanel";
import { RollLog } from "../components/dice/RollLog";
import type { RollLogEntry } from "../components/dice/rollLogTypes";
import type { DiceRollRequest, EnterRollRequest } from "../hooks/useDiceRolling";

export interface DicePanelsProps {
  diceRollerOpen: boolean;
  toggleDiceRoller: (open: boolean) => void;
  /** Ask the server to roll. It answers through the snapshot. */
  handleRoll: (request: DiceRollRequest) => void;
  /** Newest roll authored by this player — how the roller learns its result. */
  latestOwnRoll: RollLogEntry | null;
  /** Record what was thrown on physical dice, fresh or over an existing roll. */
  handleEnterRoll: (request: EnterRollRequest) => void;
  /** Whether this viewer may rewrite that roll — the server enforces it too. */
  canEnterOver: (roll: RollLogEntry | null | undefined) => boolean;
  rollLogOpen: boolean;
  toggleRollLog: (open: boolean) => void;
  rollHistory: RollLogEntry[];
  handleClearLog: () => void;
  viewingRoll: RollLogEntry | null;
  handleViewRoll: (roll: RollLogEntry | null) => void;
  chatMessages: ChatMessage[];
  players: Player[];
  /** Each seated player's colour (C3), for chat and roll log names. */
  playerColors?: ReadonlyMap<string, string>;
  uid: string;
  handleSendChat: (text: string, to?: string) => void;
  /** Clearing the shared roll log is DM-only, server-side. */
  isDM: boolean;
}

export const DicePanels: React.FC<DicePanelsProps> = ({
  diceRollerOpen,
  toggleDiceRoller,
  handleRoll,
  latestOwnRoll,
  handleEnterRoll,
  canEnterOver,
  rollLogOpen,
  toggleRollLog,
  rollHistory,
  handleClearLog,
  viewingRoll,
  handleViewRoll,
  chatMessages,
  players,
  playerColors,
  uid,
  handleSendChat,
  isDM,
}) => {
  const rollLogFrame = useRef<HTMLDivElement>(null);
  const rollLogRoot = useEscapeRoot(rollLogFrame, 1000);
  return (
    <>
      {diceRollerOpen && (
        <DiceRoller
          onRoll={handleRoll}
          latestOwnRoll={latestOwnRoll}
          onEnterRoll={handleEnterRoll}
          onOverrideRoll={(rollId, total) => handleEnterRoll({ rollId, total })}
          onClose={() => toggleDiceRoller(false)}
        />
      )}

      {rollLogOpen && (
        <div
          ref={rollLogFrame}
          style={{
            position: "fixed",
            right: 20,
            top: 200,
            width: 350,
            height: 500,
            zIndex: 1000,
          }}
        >
          <RollLog
            containingRoot={rollLogRoot}
            rolls={rollHistory}
            onClearLog={handleClearLog}
            onViewRoll={(roll) => handleViewRoll(roll)}
            onClose={() => toggleRollLog(false)}
            chatMessages={chatMessages}
            players={players}
            playerColors={playerColors}
            currentUid={uid}
            onSendChat={handleSendChat}
            canClearLog={isDM}
          />
        </div>
      )}

      {/* Clicking a row in the log opens ITS breakdown. This used to mount a
        second, empty DiceRoller — `viewingRoll` was read as a boolean — so the
        desktop "view roll" gesture showed a blank roller instead of the roll,
        and that roller could fire real rolls into a no-op onRoll. */}
      <ResultPanel
        result={viewingRoll}
        onClose={() => handleViewRoll(null)}
        onEnterRoll={
          canEnterOver(viewingRoll) && viewingRoll
            ? (total) => handleEnterRoll({ rollId: viewingRoll.id, total })
            : undefined
        }
      />
    </>
  );
};
