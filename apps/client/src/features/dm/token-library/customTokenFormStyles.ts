// Inline style objects for CustomTokenForm, lifted out when the form grew
// its Stance select and its Keep-a-copy checkbox and crossed the 350-line
// guard. Style only — no behaviour left this file.

export const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "8px",
  border: "1px dashed var(--jrpg-cyan, #00e0d1)",
  borderRadius: "4px",
} as const;

export const headingStyle = { margin: 0, fontSize: "10px", color: "var(--jrpg-cyan, #00e0d1)" };

export const rowStyle = { display: "flex", gap: "8px", flexWrap: "wrap" } as const;

export const fieldGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  flex: "1 1 160px",
  fontSize: "10px",
} as const;

export const fieldStyle = { fontSize: "11px", padding: "4px 6px", minWidth: 0 } as const;

export const chipRowStyle = { display: "flex", gap: "4px", flexWrap: "wrap" } as const;

// Tag chips are compact on a desktop. No inline min-*, so the phone's
// coarse-pointer floor can lift them — but that sweep sets min-HEIGHT only,
// which left these 44px tall and as narrow as their word (elf measured 27px).
// `.custom-token-tag` in herobyte.css carries the min-width; they wrap.
export const suggestedTagStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "10px",
  padding: "3px 7px",
  background: "var(--jrpg-panel, #232638)",
  color: "var(--jrpg-white)",
  border: "1px solid var(--jrpg-border-gold, #8a7445)",
  borderRadius: "10px",
  cursor: "pointer",
} as const;

export const chosenTagStyle = {
  ...suggestedTagStyle,
  background: "var(--jrpg-cyan, #00e0d1)",
  color: "var(--jrpg-navy, #0f0e1e)",
  border: "1px solid var(--jrpg-cyan, #00e0d1)",
} as const;

export const addStyle = { fontSize: "10px", padding: "6px 12px", alignSelf: "flex-start" } as const;

// Gold, not red: every one of these says the token WAS added and something
// optional was skipped. A red line would read as a failure it is not.
export const keepCopyHintStyle = { opacity: 0.8 } as const;

export const noteStyle = {
  margin: 0,
  fontSize: "10px",
  lineHeight: 1.35,
  color: "var(--jrpg-gold)",
} as const;
