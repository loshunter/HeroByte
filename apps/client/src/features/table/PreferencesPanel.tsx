// ============================================================================
// PREFERENCES
// ============================================================================
// Personal presentation: how YOUR screen looks and sounds. Two groups, the plan's
// names — Display (the CRT effect) and Sound & motion (what used to be called
// Game Feel and Juice). Nothing here is the table's: each is stored in this
// browser only, under the keys it always used (`herobyte:crt`, `herobyte:juice`),
// so an existing choice survives the move.
//
// CRT arrives as props because the layouts draw the overlay from the same
// value; the sound and motion store is a singleton the control reads itself.

import React from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { JuiceSettingsControl } from "../juice/JuiceSettingsControl";
import "./table.css";

export interface PreferencesPanelProps {
  crtFilter: boolean;
  onCrtFilterChange: (enabled: boolean) => void;
}

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  crtFilter,
  onCrtFilterChange,
}) => (
  <div className="table-prefs">
    <fieldset className="table-prefs__group">
      <legend className="table-menu__title">Display</legend>
      <div className="table-menu__section" style={{ flexDirection: "row", alignItems: "center" }}>
        <JRPGButton
          onClick={() => onCrtFilterChange(!crtFilter)}
          variant={crtFilter ? "primary" : "default"}
          aria-pressed={crtFilter}
          title="Toggle the retro CRT screen effect"
        >
          📺 CRT
        </JRPGButton>
        <span className="table-prefs__state">{crtFilter ? "On" : "Off"}</span>
      </div>
      <p className="table-note table-note--soft">A retro screen effect, for you only.</p>
    </fieldset>

    <fieldset className="table-prefs__group">
      <legend className="table-menu__title">Sound &amp; motion</legend>
      <JuiceSettingsControl />
      <p className="table-note table-note--soft">
        For you only, and kept in this browser. Motion starts Off if your device asks for reduced
        motion.
      </p>
    </fieldset>
  </div>
);
