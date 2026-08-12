// ============================================================================
// DEFAULT VISION CONTROL
// ============================================================================
// "This dungeon is dark" as a TABLE setting. Every token carrying no sight
// radius of its own sees this far; a token the DM darkened individually keeps
// its own value, including an explicit 0. Both halves of the app resolve the
// fallback at READ time, so changing this loosens or tightens the whole table
// at once instead of re-opening a per-token chore.
//
// It lives beside FogControl rather than in Session settings because it is a
// sight setting: without fog it has nothing to do, and the panel says so.

import { JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { VisionRadiusField } from "../../../players/components/VisionRadiusField";

export interface DefaultVisionControlProps {
  /** Feet; undefined means the table sets no default (sight is unlimited). */
  defaultVisionRadius?: number;
  /** null clears the table default back to unlimited. */
  onDefaultVisionRadiusChange: (radiusFeet: number | null) => void;
  /** The default only bites once fog is on, so the copy explains itself. */
  fogEnabled: boolean;
}

export function DefaultVisionControl({
  defaultVisionRadius,
  onDefaultVisionRadiusChange,
  fogEnabled,
}: DefaultVisionControlProps) {
  return (
    <JRPGPanel variant="simple" title="Table Sight Default" style={{ padding: "12px" }}>
      <VisionRadiusField
        value={defaultVisionRadius}
        onChange={onDefaultVisionRadiusChange}
        label="Default Sight Radius"
        subject="A token with no radius of its own"
        inputAriaLabel="Default sight radius in feet"
      />
      <span
        className="jrpg-text-body"
        style={{ opacity: 0.85, display: "block", marginTop: "8px" }}
      >
        {fogEnabled
          ? "Applies to every token without its own sight radius. A token you set individually keeps that value."
          : "Turn fog on above for this to have any effect."}
      </span>
    </JRPGPanel>
  );
}
