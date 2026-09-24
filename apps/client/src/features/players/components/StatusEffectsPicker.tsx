import { StatusEffectsPopover } from "./StatusEffectsPopover";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { STATUS_OPTIONS } from "../constants/statusOptions";
import type { StatusEffectsPickerState } from "./useStatusEffectsPicker";

export function StatusEffectsPicker({
  dropdownOpen,
  setDropdownOpen,
  dropdownRef,
  localEffects,
  handleToggleEffect,
}: StatusEffectsPickerState): JSX.Element {
  return (
    <JRPGPanel
      variant="simple"
      style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
    >
      <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        Status Effects
      </span>
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <JRPGButton
          onClick={() => setDropdownOpen(!dropdownOpen)}
          variant="default"
          style={{ width: "100%", fontSize: "10px", padding: "6px 8px" }}
        >
          {localEffects.length === 0
            ? "No Effects"
            : `${localEffects.length} Active Effect${localEffects.length === 1 ? "" : "s"}`}
        </JRPGButton>
        {dropdownOpen && (
          <StatusEffectsPopover onClose={() => setDropdownOpen(false)}>
            {STATUS_OPTIONS.map((option) => {
              const isSelected = localEffects.includes(option.value);
              return (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    transition: "background 0.2s, border 0.2s",
                    fontSize: "12px",
                    color: isSelected ? "var(--jrpg-gold)" : "var(--jrpg-white)",
                    background: isSelected ? "rgba(255, 215, 0, 0.15)" : "transparent",
                    border: isSelected
                      ? "1px solid rgba(255, 215, 0, 0.4)"
                      : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 215, 0, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {/* The label carries NO click handler. It wraps the
                      input, so a click on the text is already forwarded
                      to the checkbox by the browser; handling it here as
                      well toggled twice and netted zero, leaving the
                      whole row dead to everything but a direct hit on
                      the 16px box (UX-03). One handler, on the input,
                      also makes Space work. */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleEffect(option.value)}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                    }}
                  />
                  <span>
                    {option.emoji} {option.label}
                  </span>
                </label>
              );
            })}
          </StatusEffectsPopover>
        )}
      </div>
    </JRPGPanel>
  );
}
