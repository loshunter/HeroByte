// ============================================================================
// HAND ENTRY — "this is what I actually rolled"
// ============================================================================
// One control, three mount points: both rollers (type a result instead of
// asking the server for one) and the result panel (correct one the server
// already gave). They are the same interaction — a number and a confirm — and
// three copies would be three chances for them to disagree about bounds,
// disabled states, or what Escape does.
//
// It lives beside the other dice molecules rather than in ui/ because the
// wording and the danger colouring are specific to this feature: everything
// about it exists to say "a person typed this", and a generic numeric prompt
// would lose exactly that.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { JRPGButton } from "../ui/JRPGPanel";

interface HandEntryProps {
  /** The closed button's text, e.g. "✋ I ROLLED IT". */
  label: string;
  /** Asked once open, e.g. "What did 2d6 + 3 come to?". */
  prompt: string;
  /** Called with a finite integer. Closing is handled here. */
  onSubmit: (total: number) => void;
  disabled?: boolean;
  /** Distinguishes the roller's control from the result panel's in tests. */
  testId: string;
  compact?: boolean;
}

export const HandEntry: React.FC<HandEntryProps> = ({
  label,
  prompt,
  onSubmit,
  disabled = false,
  testId,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Opening without focus makes this a two-tap control on a phone for no
  // reason — the keyboard is the next thing wanted either way.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setValue("");
  }, []);

  const submit = useCallback(() => {
    // Number("") is 0 and Number(" ") is 0, so an empty box would quietly
    // record a zero — a real result at some tables, and never the one meant.
    const trimmed = value.trim();
    if (trimmed === "") return;
    const total = Number(trimmed);
    if (!Number.isFinite(total) || !Number.isInteger(total)) return;
    onSubmit(total);
    close();
  }, [value, onSubmit, close]);

  if (!open) {
    return (
      <JRPGButton
        onClick={() => setOpen(true)}
        disabled={disabled}
        variant="danger"
        data-testid={`${testId}-open`}
      >
        {label}
      </JRPGButton>
    );
  }

  return (
    <div
      data-testid={`${testId}-form`}
      style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}
    >
      <label
        htmlFor={`${testId}-input`}
        className="jrpg-text-small"
        style={{ color: "var(--hero-danger)" }}
      >
        {prompt}
      </label>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          id={`${testId}-input`}
          ref={inputRef}
          data-testid={`${testId}-input`}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // Enter commits and Escape abandons, because a numeric box the user
          // is already typing in is the one place a keyboard beats a tap.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          style={{
            // 44px is the mobile touch floor, and this control ships to a phone
            // in the same slice — see the shared selector list in herobyte.css.
            minHeight: "44px",
            width: compact ? "72px" : "88px",
            padding: "4px 8px",
            border: "2px solid var(--hero-danger)",
            background: "var(--hero-navy-dark)",
            color: "var(--hero-text-light)",
            fontFamily: "var(--font-pixel)",
          }}
        />
        <JRPGButton onClick={submit} variant="danger" data-testid={`${testId}-submit`}>
          RECORD
        </JRPGButton>
        <JRPGButton onClick={close} data-testid={`${testId}-cancel`}>
          CANCEL
        </JRPGButton>
      </div>
    </div>
  );
};
