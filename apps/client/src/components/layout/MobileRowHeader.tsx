// ============================================================================
// MOBILE ROW HEADER
// ============================================================================
// A phone party row's portrait, name and role line (its initiative and turn
// beside the role). Moved out of MobilePlayerRow, which sat at the 350-line
// guard, so the row has room for its settings (personal colour, C1).

import type { Player } from "@herobyte/shared";
import type { MobileRowInitiative } from "./MobileRowActions";

interface MobileRowHeaderProps {
  player: Player;
  initiative?: MobileRowInitiative;
}

export function MobileRowHeader({ player, initiative }: MobileRowHeaderProps): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid var(--hero-gold)",
          flexShrink: 0,
        }}
      >
        {player.portrait ? (
          <img
            src={player.portrait}
            alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#aaa",
              fontSize: "20px",
            }}
          >
            ?
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "var(--hero-white)",
            fontWeight: "bold",
            fontSize: "1.1rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        <div
          style={{
            color: player.isDM ? "var(--hero-gold)" : "rgba(255, 255, 255, 0.6)",
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {player.isDM ? "Dungeon Master" : "Adventurer"}
          {initiative?.value !== undefined ? ` · Init ${initiative.value}` : ""}
          {initiative?.isTurn ? " · ▶ Turn" : ""}
        </div>
      </div>
    </div>
  );
}
