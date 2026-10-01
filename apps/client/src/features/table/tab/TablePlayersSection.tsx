// ============================================================================
// PLAYERS AT THIS TABLE
// ============================================================================
// The Table tab's roster section (U9; it was the Players tab, which held combat
// controls until U8 and is now one section of Table). It is responsible for:
// - Listing every player at the table, with their token count and whether they
//   are connected
// - "Select All" for each player's tokens
// - REMOVE for a player who is not connected (their seat goes)
//
// Mostly a composition component over JRPGPanel/JRPGButton; the one piece of
// logic it owns is REMOVE's preview — the seat's token count and the heartbeat
// grace — which mirrors the server's rule (removePlayer.ts) rather than
// deciding anything: the server decides, the section only says so first. An
// absent seat is not a deleted character: the confirm names what goes.

import { useEffect, useState } from "react";
import type { Player, SceneObject } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../components/ui/JRPGPanel";
import { REMOVE_PLAYER_GRACE_MS, getSeatTokenCount, removePlayerConfirm } from "./seatRemoval";
import type { SeatCharacter } from "./seatRemoval";

// REMOVE's preview rules live in ./seatRemoval; re-exported so the section stays the one import.
export { REMOVE_PLAYER_GRACE_MS, getSeatTokenCount, removePlayerConfirm } from "./seatRemoval";
export type { SeatCharacter } from "./seatRemoval";

/**
 * Props for the TablePlayersSection component
 */
interface TablePlayersSectionProps {
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
 * TablePlayersSection - who is at this table, with the DM's two shortcuts
 *
 * @param props - Component props
 * @returns The rendered section
 */
export default function TablePlayersSection({
  players,
  sceneObjects,
  characters,
  onSelectPlayerTokens,
  connectedUids,
  onRemovePlayer,
  nowMs = Date.now,
}: TablePlayersSectionProps) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
        Select All puts a player&rsquo;s tokens in your selection. Remove clears a player who has
        left: their seat, characters and tokens go, and it asks first.
      </p>

      {players.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          Nobody has joined this table yet.
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
