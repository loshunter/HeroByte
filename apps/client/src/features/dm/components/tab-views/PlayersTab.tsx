// ============================================================================
// PLAYERS TAB COMPONENT
// ============================================================================
// Composition component for the Players tab view in DMMenu.
// Extracted as part of "Select All Player Tokens" feature implementation.
//
// This component is responsible for:
// - Displaying a list of all players in the session
// - Showing each player's token count, and whether they are connected
// - Providing "Select All Tokens" button for each player
// - Providing REMOVE for a player who is not connected (their seat goes)
// - Handling the case where players have no tokens
//
// Mostly a composition component over JRPGPanel/JRPGButton; the one piece of
// logic it owns is REMOVE's preview — the seat's token count and the heartbeat
// grace — which mirrors the server's rule (removePlayer.ts) rather than
// deciding anything: the server decides, the tab only says so first.

import { useEffect, useState } from "react";
import { MONSTER_HP_DISPLAY_MODES } from "@herobyte/shared";
import type { Player, SceneObject, MonsterHpDisplay } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { TurnNavigationControls } from "../../../initiative/components/TurnNavigationControls";
import { REMOVE_PLAYER_GRACE_MS, getSeatTokenCount, removePlayerConfirm } from "./seatRemoval";
import type { SeatCharacter } from "./seatRemoval";

// REMOVE's preview rules live in ./seatRemoval; re-exported so the tab stays the one import.
export { REMOVE_PLAYER_GRACE_MS, getSeatTokenCount, removePlayerConfirm } from "./seatRemoval";
export type { SeatCharacter } from "./seatRemoval";

/**
 * Props for the PlayersTab component
 */
interface PlayersTabProps {
  /** Array of all players in the session */
  players: Player[];
  /** Scene objects to count tokens per player */
  sceneObjects: SceneObject[];
  /** The table's characters — a token still standing under any character that survives stays. */
  characters: readonly SeatCharacter[];
  /** Callback to select all tokens owned by a player */
  onSelectPlayerTokens: (playerUid: string) => void;
  /**
   * The AUTHENTICATED roster (snapshot.users). A player outside it is shown as
   * "not at the table" — not "not connected": a browser parked on the password
   * form has a live socket the server counts as here, and answers REMOVE with
   * a refusal — and, with onRemovePlayer, gets REMOVE, unless their last
   * heartbeat is under REMOVE_PLAYER_GRACE_MS old, when the row reads "dropped
   * just now" and waits. Without the roster nothing can be told apart, so
   * nobody gets it.
   */
  connectedUids?: readonly string[];
  /** The DM clears a player who is not connected: their row, characters and tokens. */
  onRemovePlayer?: (playerUid: string) => void;
  /** The clock for the grace window; tests pin it. */
  nowMs?: () => number;
  /** Whether combat is currently active */
  combatActive?: boolean;
  /** Callback to start combat */
  onStartCombat?: () => void;
  /** Callback to end combat */
  onEndCombat?: () => void;
  /** Callback to clear all initiative values */
  onClearAllInitiative?: () => void;
  /** Callback to advance to next turn */
  onNextTurn?: () => void;
  /** Callback to go to previous turn */
  onPreviousTurn?: () => void;
  /** Current monster HP display mode (S4) */
  monsterHpDisplay?: MonsterHpDisplay;
  /** Callback to change how much monster HP players see (S4) */
  onMonsterHpDisplayChange?: (mode: MonsterHpDisplay) => void;
}

/**
 * Get count of tokens owned by a player
 */
function getPlayerTokenCount(playerUid: string, sceneObjects: SceneObject[]): number {
  return sceneObjects.filter(
    (obj) => obj.type === "token" && obj.owner === playerUid && !obj.locked,
  ).length;
}

/**
 * PlayersTab component - Displays and manages player token selection shortcuts
 *
 * Renders a tab view containing:
 * - A header with the tab title
 * - A list of players with their token counts
 * - "Select All Tokens" button for each player (disabled if no tokens)
 *
 * @param props - Component props
 * @returns The rendered Players tab view
 */
export default function PlayersTab({
  players,
  sceneObjects,
  characters,
  onSelectPlayerTokens,
  connectedUids,
  onRemovePlayer,
  nowMs = Date.now,
  combatActive = false,
  onStartCombat,
  onEndCombat,
  onClearAllInitiative,
  onNextTurn,
  onPreviousTurn,
  monsterHpDisplay = "exact",
  onMonsterHpDisplayChange,
}: PlayersTabProps) {
  const now = nowMs();
  const isAway = (player: Player) =>
    connectedUids !== undefined && !connectedUids.includes(player.uid);
  // A clock that runs behind the server's makes `now - lastHeartbeat` negative:
  // that is not "recent", so the button shows and the server (which decides)
  // answers with its own refusal if it disagrees.
  const droppedJustNow = (player: Player) =>
    player.lastHeartbeat !== undefined &&
    now - player.lastHeartbeat >= 0 &&
    now - player.lastHeartbeat < REMOVE_PLAYER_GRACE_MS;
  const anyDroppedJustNow = players.some((p) => isAway(p) && droppedJustNow(p));
  // A "dropped just now" row turns removable by the clock alone, with no
  // snapshot to re-render on; tick while any row is in the window.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!anyDroppedJustNow) return;
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [anyDroppedJustNow]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Combat Controls Section */}
      <div>
        <h4 className="jrpg-text-command" style={{ margin: 0, marginBottom: "8px" }}>
          Combat Controls
        </h4>
        <p
          className="jrpg-text-small"
          style={{ margin: 0, marginBottom: "12px", color: "var(--jrpg-white)" }}
        >
          Manage initiative tracking and combat turns
        </p>

        <JRPGPanel variant="simple">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Combat State Controls */}
            <div style={{ display: "flex", gap: "8px" }}>
              <JRPGButton
                onClick={onStartCombat}
                variant={!combatActive ? "primary" : "default"}
                disabled={combatActive}
                style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
              >
                ⚔️ Start Combat
              </JRPGButton>
              <JRPGButton
                onClick={onEndCombat}
                variant={combatActive ? "primary" : "default"}
                disabled={!combatActive}
                style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
              >
                🏁 End Combat
              </JRPGButton>
            </div>

            {/* Clear Initiative */}
            {/*
              Not gated on combatActive: the server handler has no such
              precondition, and clearing BEFORE combat is the only way to
              re-roll a pre-combat initiative — "Roll all Initiative" skips
              anyone who already has a value. Disabling it here meant the DM
              had to start combat purely in order to clear it.
            */}
            <JRPGButton
              onClick={onClearAllInitiative}
              variant="default"
              style={{ width: "100%", fontSize: "10px", padding: "6px 8px" }}
            >
              🗑️ Clear All Initiative
            </JRPGButton>

            {/* Turn Navigation */}
            {onNextTurn && onPreviousTurn && (
              <TurnNavigationControls
                combatActive={combatActive}
                onNextTurn={onNextTurn}
                onPreviousTurn={onPreviousTurn}
              />
            )}
          </div>
        </JRPGPanel>
      </div>

      {/* Monster HP Display Section (S4) — enforced server-side; this is the dial */}
      {onMonsterHpDisplayChange && (
        <div>
          <h4 className="jrpg-text-command" style={{ margin: 0, marginBottom: "8px" }}>
            Monster HP Display
          </h4>
          <p
            className="jrpg-text-small"
            style={{ margin: 0, marginBottom: "12px", color: "var(--jrpg-white)" }}
          >
            How much of a monster&apos;s health players can see. Hidden and Bloodied strip the
            numbers from their connection entirely.
          </p>
          <JRPGPanel variant="simple">
            <div style={{ display: "flex", gap: "8px" }}>
              {MONSTER_HP_DISPLAY_MODES.map((mode) => (
                <JRPGButton
                  key={mode}
                  onClick={() => onMonsterHpDisplayChange(mode)}
                  variant={monsterHpDisplay === mode ? "primary" : "default"}
                  style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
                >
                  {mode === "exact" ? "Exact" : mode === "bloodied" ? "Bloodied" : "Hidden"}
                </JRPGButton>
              ))}
            </div>
          </JRPGPanel>
        </div>
      )}

      {/* Player Token Shortcuts Section */}
      <div>
        <h4 className="jrpg-text-command" style={{ margin: 0, marginBottom: "8px" }}>
          Player Token Shortcuts
        </h4>
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          Select all tokens owned by a player. Previous selection is saved for undo. A player who is
          not at the table can be removed: their seat, character sheets and tokens go (a browser
          still open on a login screen, or at another table, counts as here). A seat dropped in the
          last minute waits.
        </p>
      </div>

      {players.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No players connected yet.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {players.map((player) => {
            const tokenCount = getPlayerTokenCount(player.uid, sceneObjects);
            const hasTokens = tokenCount > 0;
            const away = isAway(player);
            const recent = away && droppedJustNow(player);
            const seatTokens = getSeatTokenCount(player.uid, sceneObjects, characters);

            return (
              <JRPGPanel key={player.uid} variant="simple">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="jrpg-text-small"
                      style={{
                        fontWeight: "bold",
                        color: "var(--jrpg-white)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {player.name}
                      {player.isDM && " (DM)"}
                    </div>
                    <div
                      className="jrpg-text-tiny"
                      style={{ color: "var(--jrpg-white)", opacity: 0.7 }}
                    >
                      {tokenCount} token{tokenCount === 1 ? "" : "s"}
                      {away ? (recent ? " · dropped just now" : " · not at the table") : ""}
                    </div>
                  </div>
                  {away && !recent && onRemovePlayer ? (
                    <JRPGButton
                      onClick={() => {
                        if (window.confirm(removePlayerConfirm(player.name, seatTokens))) {
                          onRemovePlayer(player.uid);
                        }
                      }}
                      variant="danger"
                      style={{ fontSize: "10px", padding: "4px 8px", whiteSpace: "nowrap" }}
                    >
                      Remove
                    </JRPGButton>
                  ) : null}
                  <JRPGButton
                    onClick={() => onSelectPlayerTokens(player.uid)}
                    variant={hasTokens ? "primary" : "default"}
                    disabled={!hasTokens}
                    style={{ fontSize: "10px", padding: "4px 8px", whiteSpace: "nowrap" }}
                  >
                    Select All
                  </JRPGButton>
                </div>
              </JRPGPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
