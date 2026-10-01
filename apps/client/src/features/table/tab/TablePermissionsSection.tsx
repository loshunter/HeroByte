// ============================================================================
// TABLE PERMISSIONS
// ============================================================================
// What players may do at this table, stated as what happens rather than how it
// is built (U9). Both were "table policy" in the Session tab; they keep their
// messages and their server-side enforcement — this only says, beside each box,
// who may do what.
//
// The two defaults differ, and that asymmetry is where it would go wrong:
// player props default OFF, hand-entered rolls default ON. The caller derives
// the second with `!== false` because the snapshot carries its key only when it
// is off, so an omitted prop here means ON.

import { JRPGPanel } from "../../../components/ui/JRPGPanel";

interface TablePermissionsSectionProps {
  /** Whether players may create/edit/delete their own props. */
  playerPropsEnabled?: boolean;
  onPlayerPropsEnabledChange?: (enabled: boolean) => void;
  /**
   * Whether players may enter a roll by hand instead of taking the server's die.
   * Defaults to TRUE, unlike playerPropsEnabled: a table that has never touched
   * this setting has it ON.
   */
  initiativeManualOverride?: boolean;
  onInitiativeManualOverrideChange?: (enabled: boolean) => void;
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--jrpg-white)",
  cursor: "pointer",
};

const noteStyle: React.CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-body)",
  fontSize: "11px",
  lineHeight: 1.5,
  color: "var(--jrpg-white)",
  opacity: 0.8,
};

export default function TablePermissionsSection({
  playerPropsEnabled = false,
  onPlayerPropsEnabledChange,
  initiativeManualOverride = true,
  onInitiativeManualOverrideChange,
}: TablePermissionsSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Only the players' OWN props open up — never the map editor; that
          distinction is the whole reason this toggle is safe to offer. */}
      {onPlayerPropsEnabledChange && (
        <JRPGPanel variant="simple">
          <label className="jrpg-text-small" style={labelStyle}>
            <input
              type="checkbox"
              checked={playerPropsEnabled}
              onChange={(e) => onPlayerPropsEnabledChange(e.target.checked)}
            />
            Players can add props
          </label>
          <div style={noteStyle}>
            Players can place, edit and remove their own props (furniture, chests, scene dressing).
            They never get map tools, and you can change or delete anything they add.
          </div>
        </JRPGPanel>
      )}

      {/* ON by default: typing the real number in is what the control exists to
          serve — a bad roll, you allow a physical re-roll, the real number goes in. */}
      {onInitiativeManualOverrideChange && (
        <JRPGPanel variant="simple">
          <label className="jrpg-text-small" style={labelStyle}>
            <input
              type="checkbox"
              data-testid="initiative-manual-override-toggle"
              checked={initiativeManualOverride}
              onChange={(e) => onInitiativeManualOverrideChange(e.target.checked)}
            />
            Players can enter rolls by hand
          </label>
          <div style={noteStyle}>
            {initiativeManualOverride
              ? "Players can type what they rolled at a real table — for initiative, in the dice roller, or over a server roll. You can always enter rolls by hand."
              : "Players get the server's die only. You can still enter rolls by hand."}{" "}
            Every hand-entered number shows in the roll log marked <strong>BY HAND</strong>.
          </div>
        </JRPGPanel>
      )}
    </div>
  );
}
