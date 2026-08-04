// ============================================================================
// SAVED MACROS — a formula you roll often, one tap away
// ============================================================================
// Deliberately CLIENT-LOCAL (localStorage), not room state. A macro is a
// personal shortcut, like a browser bookmark: it changes nothing another
// player can observe, and putting it in RoomState would mean a new persisted
// collection, a snapshot limit, and a per-player namespace inside shared state
// — real cost for something whose whole value is that it is yours.
//
// The consequence, and it is the honest trade: macros do not follow you to
// another browser or device. Say so rather than pretending otherwise.

import type { DiceRollMode } from "@herobyte/shared";
import { parseDiceFormula } from "@herobyte/shared";

export interface DiceMacro {
  id: string;
  label: string;
  formula: string;
  mode: DiceRollMode;
}

const STORAGE_KEY = "herobyte.dice.macros";
const MAX_MACROS = 12;
const MAX_LABEL = 24;

/** Always present, never editable — the rolls every table makes. */
export const BUILTIN_MACROS: readonly DiceMacro[] = [
  { id: "builtin-d20", label: "d20", formula: "d20", mode: "normal" },
  // Labelled "ADV d20", not "ADV": the mode toggle beside this bar already
  // has an ADV button, and two same-named controls in one panel is a footgun
  // for a player and an ambiguous query for a test.
  { id: "builtin-adv", label: "ADV d20", formula: "d20", mode: "advantage" },
  { id: "builtin-dis", label: "DIS d20", formula: "d20", mode: "disadvantage" },
  { id: "builtin-2d6", label: "2d6", formula: "2d6", mode: "normal" },
];

/**
 * localStorage is not guaranteed present (private modes, embedded webviews,
 * SSR-ish test environments). Every accessor goes through this, so a missing
 * or throwing store degrades to "no saved macros" rather than a crash on
 * panel open — same defensive shape as DraggableWindow's position storage.
 */
function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isMacro(value: unknown): value is DiceMacro {
  if (typeof value !== "object" || value === null) return false;
  const macro = value as Partial<DiceMacro>;
  return (
    typeof macro.id === "string" &&
    typeof macro.label === "string" &&
    typeof macro.formula === "string" &&
    parseDiceFormula(macro.formula).ok
  );
}

/**
 * The player's own macros, newest last.
 *
 * Entries are re-validated on read, not just on write: the value is
 * user-editable through devtools, and a stored formula the server would refuse
 * should disappear from the bar rather than sit there failing every time it is
 * tapped.
 */
export function loadMacros(): DiceMacro[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMacro).slice(0, MAX_MACROS);
  } catch {
    return [];
  }
}

function persist(macros: DiceMacro[]): DiceMacro[] {
  const store = storage();
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(macros));
  } catch {
    // A full or disabled store must not lose the roll the player is making.
  }
  return macros;
}

/**
 * Save a macro and return the new list.
 *
 * Saving the same formula+mode under a new name REPLACES the old entry rather
 * than stacking a duplicate, because the common gesture is "rename the one I
 * just made".
 */
export function saveMacro(label: string, formula: string, mode: DiceRollMode): DiceMacro[] {
  const trimmed = label.trim().slice(0, MAX_LABEL);
  if (!trimmed || !parseDiceFormula(formula).ok) return loadMacros();

  const existing = loadMacros().filter(
    (macro) => !(macro.formula === formula && macro.mode === mode) && macro.label !== trimmed,
  );
  const macro: DiceMacro = {
    id: `macro-${trimmed}-${formula}-${mode}`,
    label: trimmed,
    formula,
    mode,
  };
  return persist([...existing, macro].slice(-MAX_MACROS));
}

/** Forget one macro and return the new list. Built-ins are not removable. */
export function deleteMacro(id: string): DiceMacro[] {
  return persist(loadMacros().filter((macro) => macro.id !== id));
}
