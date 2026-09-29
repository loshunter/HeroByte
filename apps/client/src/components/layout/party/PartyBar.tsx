// ============================================================================
// PARTY BAR
// ============================================================================
// The Party panel's always-visible strip: its name, the Roster/Cards view
// switch, the combat turn summary, the launcher dock (World, Props, DM MENU —
// reserved layout space, so they can never cover a card; IA-15) and Hide.
// It stays up while the panel is hidden, so the launchers and the turn
// controls never disappear with the cards.

import { JRPGButton } from "../../ui/JRPGPanel";
import { TurnNavigationControls } from "../../../features/initiative/components/TurnNavigationControls";

export type PartyLayout = "roster" | "cards";

export interface PartyCombatSummary {
  /** 0-based index of the combatant holding the turn, or -1 while nobody does. */
  turnIndex: number;
  total: number;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
}

interface PartyBarProps {
  layout: PartyLayout;
  onLayoutChange: (layout: PartyLayout) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  launcherDockRef: (node: HTMLDivElement | null) => void;
  combat: PartyCombatSummary | null;
}

export function PartyBar({
  layout,
  onLayoutChange,
  collapsed,
  onToggleCollapsed,
  launcherDockRef,
  combat,
}: PartyBarProps): JSX.Element {
  return (
    <div className="party-bar">
      <h3 className="party-bar__title jrpg-text-command jrpg-text-highlight">Party</h3>
      {!collapsed && (
        <div role="group" aria-label="Party view" className="party-bar__views">
          <JRPGButton
            variant={layout === "roster" ? "primary" : "default"}
            aria-pressed={layout === "roster"}
            onClick={() => onLayoutChange("roster")}
            title="One compact row per character; select one for its details"
          >
            ☰ Roster
          </JRPGButton>
          <JRPGButton
            variant={layout === "cards" ? "primary" : "default"}
            aria-pressed={layout === "cards"}
            onClick={() => onLayoutChange("cards")}
            title="Every character's full card at once"
          >
            ▦ Cards
          </JRPGButton>
        </div>
      )}
      {combat && (
        <div className="party-bar__combat" role="group" aria-label="Combat">
          <span className="party-bar__combat-label">⚔️ Combat Active</span>
          {combat.total > 0 && (
            <span className="party-bar__turn">
              {/* "—" while nobody holds the turn (a combatant cleared its own
                  initiative on its turn drops the pointer): the bar must not
                  claim turn 1 while no row wears the mark. */}
              Turn {combat.turnIndex >= 0 ? combat.turnIndex + 1 : "—"} of {combat.total}
            </span>
          )}
          {combat.onNextTurn && combat.onPreviousTurn && (
            <TurnNavigationControls
              combatActive={true}
              onNextTurn={combat.onNextTurn}
              onPreviousTurn={combat.onPreviousTurn}
            />
          )}
        </div>
      )}
      <div className="party-bar__dock" ref={launcherDockRef} />
      <JRPGButton
        className="party-bar__hide"
        variant={collapsed ? "default" : "primary"}
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        {collapsed ? "▲ Show party" : "▼ Hide party"}
      </JRPGButton>
    </div>
  );
}
