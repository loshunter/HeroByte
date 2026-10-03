// ============================================================================
// MOBILE ROW CONDITIONS
// ============================================================================
// A phone Party row's conditions: the chips every viewer reads, and — for the
// owner or the DM — the Manage Status grid that toggles them. Its own module so
// MobilePlayerRow keeps room under the 350-line guard (U7 added Focus there).

import { useEffect, useState } from "react";
import { STATUS_OPTIONS } from "../../features/players/constants/statusOptions";
import { JRPGButton } from "../ui/JRPGPanel";
import { useRoleKnown } from "../../features/table/roleKnown";

interface MobileRowConditionsProps {
  activeEffects: string[];
  /** Present only where this viewer may change them (owner or DM). */
  onStatusEffectsChange?: (effects: string[]) => void;
}

export function MobileRowConditions({
  activeEffects,
  onStatusEffectsChange,
}: MobileRowConditionsProps): JSX.Element {
  const [isEditingEffects, setIsEditingEffects] = useState(false);
  const canEdit = Boolean(onStatusEffectsChange);
  // The grid is the editor's: when the handler goes (the DM lost DM rights)
  // it closes, and it does not reopen by itself when DM comes back. A reconnect
  // blip takes the handler too; that waits for the roster to say so.
  const roleKnown = useRoleKnown();
  useEffect(() => {
    if (!canEdit && roleKnown) setIsEditingEffects(false);
  }, [canEdit, roleKnown]);

  const handleToggleEffect = (value: string) => {
    if (!onStatusEffectsChange) return;
    const next = activeEffects.includes(value)
      ? activeEffects.filter((e) => e !== value)
      : [...activeEffects, value];
    onStatusEffectsChange(next);
  };

  return (
    <>
      {/* Status Effects Display */}
      {activeEffects.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "0 4px" }}>
          {activeEffects.map((effectVal) => {
            const opt = STATUS_OPTIONS.find((o) => o.value === effectVal);
            return (
              <div
                key={effectVal}
                style={{
                  fontSize: "12px",
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ddd",
                }}
              >
                {opt ? `${opt.emoji} ${opt.label}` : effectVal}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Effects Button (Only for owner/DM) */}
      {(canEdit || (!roleKnown && isEditingEffects)) && (
        <div style={{ padding: "0 4px" }}>
          <JRPGButton
            onClick={() => setIsEditingEffects(!isEditingEffects)}
            variant="default"
            style={{ width: "100%", fontSize: "12px", padding: "6px" }}
          >
            {isEditingEffects ? "Done Editing" : "⚡ Manage Status"}
          </JRPGButton>

          {/* Effects Selection Grid */}
          {isEditingEffects && (
            <div
              style={{
                marginTop: "8px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                background: "rgba(0,0,0,0.3)",
                padding: "8px",
                borderRadius: "4px",
              }}
            >
              {STATUS_OPTIONS.map((opt) => {
                const isActive = activeEffects.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleToggleEffect(opt.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: isActive ? "rgba(255, 215, 0, 0.2)" : "transparent",
                      border: isActive
                        ? "1px solid var(--hero-gold)"
                        : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      padding: "6px",
                      color: isActive ? "var(--hero-gold)" : "#aaa",
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
