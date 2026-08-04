// ============================================================================
// DICE NOTATION — the shared vocabulary, and deliberately NOT the randomness
// ============================================================================
// This module owns what a dice formula MEANS: how "2d6 + 3" tokenizes, which
// dice exist, and how far a request may go before it is refused. It owns none
// of the rolling.
//
// That split is the point of S5. Before it, the client rolled and the server
// stored whatever arrived — playerUid, playerName and total included — so a
// devtools console could mint a 999 from another player's name (arc defect
// D2). Now the client sends a formula and nothing else; the server parses it
// with THIS code, rolls with its own RNG, and stamps the author from the
// connection.
//
// So: no rollFormula() here. A roller in a package both halves import is an
// invitation to roll on the client again, and the second caller is the one
// that reintroduces the bug. The evaluator lives in
// apps/server/src/domains/dice/roller.ts and has exactly one caller.

/** Every die the roller understands. The UI's palette is derived from this. */
export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

/** Face count per die. Also the membership test for "is this a real die?". */
export const DIE_FACES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export const DIE_TYPES = Object.keys(DIE_FACES) as DieType[];

/**
 * Advantage/disadvantage, first-class rather than "roll twice and eyeball it".
 *
 * It applies to the FIRST die term of the formula — for "d20 + 5" that is the
 * d20, which is what 5e means by the words. The term is rolled twice at its
 * full quantity and the better (or worse) SUBTOTAL is kept; the discarded set
 * survives in the breakdown so the log can show what was given up.
 */
export type DiceRollMode = "normal" | "advantage" | "disadvantage";

/**
 * Who is allowed to see a roll.
 *
 * - `public` — the whole table (the default; absent reads as public).
 * - `dm`     — the roller and any DM. A secret perception check.
 * - `self`   — the roller alone, DMs included.
 *
 * Enforced in the snapshot's recipient filter, so a hidden roll is never
 * serialized to a socket that should not have it — not hidden by the
 * renderer. Same bound as whispers, though: `uid` is client-asserted, so this
 * is privacy from the other people at your table, not from someone willing to
 * reconnect under their uid. See recipientFilter.ts.
 */
export type DiceVisibility = "public" | "dm" | "self";

/**
 * One term of a parsed formula.
 *
 * `sign` lives on die terms because "1d20 - 1d4" is real notation (Bane), and
 * a term that can only be added would refuse it. Modifiers keep their sign in
 * `value` instead — asymmetric, but it matches how the roller adds them and
 * how the client's build strip already models a modifier.
 */
export type DiceTerm =
  | { kind: "die"; die: DieType; qty: number; sign: 1 | -1 }
  | { kind: "mod"; value: number };

/**
 * Ceilings. These bound the SERVER's work and the snapshot's size, so they are
 * enforced at parse time — the one gate every formula passes through.
 *
 * `TOTAL_DICE_MAX` is the one that matters: roll history holds 100 rolls and
 * the whole thing ships in every snapshot, so 100 dice per roll is already
 * ~10k numbers on the wire in the worst case. A fireball is 8d6.
 */
export const DICE_LIMITS = {
  FORMULA_MAX: 128,
  TERMS_MAX: 16,
  QTY_MAX: 100,
  TOTAL_DICE_MAX: 100,
  MODIFIER_ABS_MAX: 9999,
} as const;

export type DiceParseResult = { ok: true; terms: DiceTerm[] } | { ok: false; error: string };

/**
 * Terms are matched one at a time, contiguously, from the start of the string.
 *
 * The die branch comes first so "2d6" is not read as the number 2 followed by
 * garbage. Contiguity is checked by the caller rather than by anchoring,
 * because /g + exec is what reports WHERE a formula stopped making sense.
 */
const TERM_PATTERN = /([+-]?)(?:(\d*)[dD](\d+)|(\d+))/g;

function fail(error: string): DiceParseResult {
  return { ok: false, error };
}

function dieTypeForFaces(faces: number): DieType | undefined {
  return DIE_TYPES.find((die) => DIE_FACES[die] === faces);
}

/**
 * Parse dice notation into terms, or say why it cannot.
 *
 * Accepts `d20`, `2d6+3`, `1d20 + 5 - 1d4`, `-2`, and whitespace anywhere.
 * Rejects everything else — including anything that would make the server do
 * more work than a table could possibly need.
 *
 * This is the ONLY gate between a client string and the roller, which is why
 * it validates rather than sanitizes: a formula the parser does not fully
 * understand is refused, never partially honoured.
 */
export function parseDiceFormula(input: unknown): DiceParseResult {
  if (typeof input !== "string") return fail("formula must be text");

  const text = input.trim();
  if (text.length === 0) return fail("formula is empty");
  if (text.length > DICE_LIMITS.FORMULA_MAX) {
    return fail(`formula exceeds ${DICE_LIMITS.FORMULA_MAX} characters`);
  }

  // Strip whitespace before scanning so "2 d 6" and "2d6" parse alike. The
  // length cap above was measured on the original, which is the string a user
  // typed and the one an attacker controls.
  const compact = text.replace(/\s+/g, "");
  if (compact.length === 0) return fail("formula is empty");

  const terms: DiceTerm[] = [];
  let totalDice = 0;
  let cursor = 0;

  TERM_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TERM_PATTERN.exec(compact)) !== null) {
    // A gap means the text between `cursor` and here matched nothing — the
    // formula is malformed there. Report it rather than silently skipping.
    if (match.index !== cursor) {
      return fail(`unexpected "${compact.slice(cursor, match.index)}" in formula`);
    }
    cursor = TERM_PATTERN.lastIndex;

    const [, rawSign, rawQty, rawFaces, rawMod] = match;
    const sign: 1 | -1 = rawSign === "-" ? -1 : 1;

    if (rawFaces !== undefined) {
      const die = dieTypeForFaces(Number(rawFaces));
      if (!die) return fail(`unsupported die: d${rawFaces}`);

      const qty = rawQty === "" ? 1 : Number(rawQty);
      if (!Number.isSafeInteger(qty) || qty < 1) return fail("dice quantity must be at least 1");
      if (qty > DICE_LIMITS.QTY_MAX) {
        return fail(`dice quantity exceeds ${DICE_LIMITS.QTY_MAX}`);
      }

      totalDice += qty;
      if (totalDice > DICE_LIMITS.TOTAL_DICE_MAX) {
        return fail(`formula rolls more than ${DICE_LIMITS.TOTAL_DICE_MAX} dice`);
      }

      terms.push({ kind: "die", die, qty, sign });
    } else {
      const magnitude = Number(rawMod);
      if (!Number.isSafeInteger(magnitude)) return fail("modifier is not a whole number");
      if (magnitude > DICE_LIMITS.MODIFIER_ABS_MAX) {
        return fail(`modifier exceeds ${DICE_LIMITS.MODIFIER_ABS_MAX}`);
      }
      terms.push({ kind: "mod", value: sign * magnitude });
    }

    if (terms.length > DICE_LIMITS.TERMS_MAX) {
      return fail(`formula has more than ${DICE_LIMITS.TERMS_MAX} terms`);
    }
  }

  // Trailing junk: "2d6+" leaves the "+" unconsumed.
  if (cursor !== compact.length) {
    return fail(`unexpected "${compact.slice(cursor)}" in formula`);
  }
  if (terms.length === 0) return fail("formula has no dice or modifiers");

  return { ok: true, terms };
}

/**
 * Render terms back to canonical notation — "2d20 + 5 - 1d4".
 *
 * The server stores THIS string on the roll rather than the client's original,
 * so the log shows what was actually rolled. A client that sends "2 d 20+5"
 * and a client that sends "2d20 + 5" produce identical history.
 */
export function formatDiceTerms(terms: DiceTerm[]): string {
  return terms
    .map((term, index) => {
      const negative = term.kind === "die" ? term.sign === -1 : term.value < 0;
      const body =
        term.kind === "die"
          ? `${term.qty > 1 ? term.qty : ""}${term.die}`
          : `${Math.abs(term.value)}`;

      // The first term carries a bare "-"; later ones are joined with spaced
      // operators, which is how a person writes it.
      if (index === 0) return negative ? `-${body}` : body;
      return `${negative ? "- " : "+ "}${body}`;
    })
    .join(" ");
}

/** Narrow an untrusted value to a roll mode; anything else is "normal". */
export function coerceDiceRollMode(value: unknown): DiceRollMode {
  return value === "advantage" || value === "disadvantage" ? value : "normal";
}

/**
 * Narrow an untrusted value to a visibility.
 *
 * Absent means public — that is the wire default and what every roll from
 * before S5 is. Anything else present but unrecognized is NOT public: a
 * corrupt or forward-dated state file must not be able to turn a secret roll
 * into a broadcast one, so an unknown string collapses to the most private
 * setting.
 */
export function coerceDiceVisibility(value: unknown): DiceVisibility {
  if (value === undefined || value === null || value === "public") return "public";
  if (value === "dm") return "dm";
  return "self";
}
