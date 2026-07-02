// ============================================================================
// JUICE MENU BUTTON
// ============================================================================
// Self-contained header button that toggles a small popover with the game-feel
// settings. No props, so it can be dropped into the toolbar without threading
// any state through the layout.

import React, { useEffect, useRef, useState } from "react";
import { JRPGButton, JRPGPanel } from "../../components/ui/JRPGPanel";
import { JuiceSettingsControl } from "./JuiceSettingsControl";
import { useJuiceSettings } from "./useJuiceSettings";

export const JuiceMenuButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { muted } = useJuiceSettings();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <JRPGButton
        onClick={() => setOpen((v) => !v)}
        variant={open ? "primary" : "default"}
        style={{ fontSize: "8px", padding: "4px 10px" }}
        title="Game feel: motion & sound settings"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {muted ? "🔇" : "🔊"} Juice
      </JRPGButton>

      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "6px", zIndex: 200 }}>
          <JRPGPanel variant="bevel" style={{ padding: "10px", minWidth: "200px" }}>
            <JuiceSettingsControl />
          </JRPGPanel>
        </div>
      )}
    </div>
  );
};
