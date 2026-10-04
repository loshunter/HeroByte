import { useCallback, useId, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { JRPGPanel } from "../../../components/ui/JRPGPanel";

export function useCharacterEscapeGuard(isOpen: boolean) {
  const suppressBlur = useRef(false);
  useLayoutEffect(() => {
    if (isOpen) suppressBlur.current = false;
  }, [isOpen]);
  const beforeEscape = useCallback(() => {
    suppressBlur.current = true;
  }, []);
  return { suppressBlur, beforeEscape };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  suppressBlur: MutableRefObject<boolean>;
}

export function CharacterNameField({ value, onChange, onSubmit, suppressBlur }: Props) {
  // The label names its input (IA-20): it once sat beside it unassociated, so
  // a screen reader announced an unnamed text field.
  const inputId = useId();
  return (
    <JRPGPanel
      variant="simple"
      style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}
    >
      <label htmlFor={inputId} className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        Character Name
      </label>
      <input
        id={inputId}
        className="jrpg-input"
        type="text"
        value={value}
        placeholder="Enter Name"
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (!suppressBlur.current) onSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
      />
    </JRPGPanel>
  );
}
