// ============================================================================
// NPC STANCE SELECT
// ============================================================================
// Where an existing NPC stands with the party, in the DM's NPC editor. Its own
// file because NPCEditor sits a handful of lines under the 350-line guard, and
// because the commit shape belongs next to the control that decides it: the
// editor mounts this in one line and hands it the same commitUpdate every
// other field uses.
//
// A <select>, not three buttons: inside a mobile surface the phone's coarse
// -pointer floor lifts a <select> to 44px for free, and three chips would need
// a rule of their own.

import { useId } from "react";
import type { NpcDisposition } from "@herobyte/shared";
import { npcDispositionLook } from "../../players/components/npcDisposition";

const STANCES: NpcDisposition[] = ["hostile", "neutral", "friendly"];

interface NpcStanceSelectProps {
  /** The NPC's stance as the snapshot holds it; absent = hostile. */
  value?: NpcDisposition;
  disabled?: boolean;
  onChange: (updates: { disposition: NpcDisposition }) => void;
}

export function NpcStanceSelect({ value, disabled = false, onChange }: NpcStanceSelectProps) {
  const id = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label htmlFor={id} className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        Stance
      </label>
      <select
        id={id}
        value={value ?? "hostile"}
        disabled={disabled}
        onChange={(event) => onChange({ disposition: event.target.value as NpcDisposition })}
        style={{
          width: "100%",
          padding: "4px",
          background: "#111",
          color: "var(--jrpg-white)",
          border: "1px solid var(--jrpg-border-gold)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {STANCES.map((stance) => (
          <option key={stance} value={stance}>
            {npcDispositionLook(stance).label}
          </option>
        ))}
      </select>
    </div>
  );
}
