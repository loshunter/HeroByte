// ============================================================================
// PLAYERS TAB COMPONENT
// ============================================================================
// Composition component for the Players tab view in DMMenu.
// Extracted as part of "Select All Player Tokens" feature implementation.
//
// This component is responsible for:
// - Displaying a list of all players in the session
// - Showing each player's token count
// - Providing "Select All Tokens" button for each player
// - Handling the case where players have no tokens
//
// This is a pure composition component that arranges existing UI components
// (JRPGPanel, JRPGButton) without implementing business logic.

import type { Player, SceneObject } from "@shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";

/**
 * Props for the PlayersTab component
 */
interface PlayersTabProps {
  /** Array of all players in the session */
  players: Player[];
  /** Scene objects to count tokens per player */
  sceneObjects: SceneObject[];
  /** Callback to select all tokens owned by a player */
  onSelectPlayerTokens: (playerUid: string) => void;
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
  onSelectPlayerTokens,
}: PlayersTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <h4 className="jrpg-text-command" style={{ margin: 0, marginBottom: "8px" }}>
          Player Token Shortcuts
        </h4>
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          Select all tokens owned by a player. Previous selection is saved for undo.
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
                    </div>
                  </div>
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
