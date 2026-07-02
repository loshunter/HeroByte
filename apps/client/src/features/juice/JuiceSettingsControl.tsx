// ============================================================================
// JUICE SETTINGS CONTROL
// ============================================================================
// Self-contained UI for game-feel preferences. Reads/writes the juice settings
// singleton directly, so it can be dropped anywhere without prop threading.

import React from "react";
import { useJuiceSettings } from "./useJuiceSettings";
import { setMotionLevel, setVolume, toggleMuted, type MotionLevel } from "./juiceSettings";
import { sfxEngine } from "./sfxEngine";

const MOTION_OPTIONS: { value: MotionLevel; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "subtle", label: "Subtle" },
  { value: "off", label: "Off" },
];

export const JuiceSettingsControl: React.FC = () => {
  const { motion, muted, volume } = useJuiceSettings();

  return (
    <div
      className="juice-settings"
      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
    >
      <div className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        ✦ GAME FEEL
      </div>

      <label
        className="jrpg-text-small"
        htmlFor="juice-motion"
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        Motion
        <select
          id="juice-motion"
          value={motion}
          onChange={(e) => setMotionLevel(e.target.value as MotionLevel)}
          style={{
            flex: 1,
            background: "var(--jrpg-navy)",
            color: "var(--jrpg-cyan)",
            border: "1px solid var(--jrpg-border-gold)",
            padding: "2px 4px",
          }}
        >
          {MOTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label
        className="jrpg-text-small"
        htmlFor="juice-mute"
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <input
          id="juice-mute"
          type="checkbox"
          checked={muted}
          onChange={() => {
            toggleMuted();
            sfxEngine.resume();
          }}
        />
        Mute sound effects
      </label>

      <label
        className="jrpg-text-small"
        htmlFor="juice-volume"
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        Volume
        <input
          id="juice-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={muted}
          onChange={(e) => setVolume(Number(e.target.value))}
          onMouseUp={() => sfxEngine.play("buttonBlip")}
          style={{ flex: 1 }}
        />
      </label>
    </div>
  );
};
