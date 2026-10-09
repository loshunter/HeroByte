// ============================================================================
// COLOUR RULE — no two players share a colour (personal-colour-arc-plan §3.2)
// ============================================================================
// Every player's colour holds a zone of radius r(N) around it, measured in
// OKLab, and nobody else's colour may land inside it. N is the number of
// non-DM players with a PC, so zones shrink as a table fills. The rule only
// runs when a colour CHANGES: a placed colour is never invalidated by someone
// joining, and nobody is moved when someone leaves.
//
// Who blocks whom: other non-DM players' PCs. A player's own characters never
// block each other (they may share a colour), NPCs never count, and the DM is
// exempt both ways (their picks are not checked, their colours block no one).
//
// One module for the server (the authority) and the picker (the help), so
// the two can never disagree about where a zone is.

import { colorToOkLab, deltaE, normalizeColor, type OkLab } from "./colorSpace.js";
import {
  cellIndexAt,
  windowCellLabs,
  windowCells,
  windowDistance,
  windowSize,
  type WindowCell,
  type WindowPoint,
} from "./colorWindow.js";

export const COLOR_RULE = {
  /** Share of the window the zones may fill between them, leaving room to move. */
  fill: 0.5,
  /**
   * ΔE bounds on the zone radius (ΔE 0.02 is about a just-noticeable step). The
   * cap sits above r(2) = 0.222, so zones shrink from the second player on.
   */
  radiusMin: 0.03,
  radiusMax: 0.25,
  /** A recolour lands at least this far from where it started. */
  recolorStepMin: 0.05,
} as const;

/** r(N) = clamp(sqrt(A · fill / (π · N)), radiusMin, radiusMax). */
export function ruleRadius(playerCount: number): number {
  const players = Math.max(1, Math.floor(playerCount));
  const { width, height } = windowSize();
  const radius = Math.sqrt((width * height * COLOR_RULE.fill) / (Math.PI * players));
  return Math.min(COLOR_RULE.radiusMax, Math.max(COLOR_RULE.radiusMin, radius));
}

/** A PC's colour as the rule sees it: whose it is and, for messages, its name. */
export interface ColorHolder {
  ownerUid: string;
  color: string;
  name?: string;
  characterId?: string;
}

export interface BlockingColor extends ColorHolder {
  lab: OkLab;
}

export interface ColorRuleInputs {
  /** Colours that block the requester: other non-DM players' PCs. */
  others: BlockingColor[];
  /** N: distinct non-DM players with a PC, the requester counted. */
  playerCount: number;
  radius: number;
}

/**
 * The rule's inputs for one requester. `holders` is every PC colour at the
 * table (one per PC with a token); `isDM` says who is exempt. Unparseable
 * colours block nothing (they will be reassigned the next time they change).
 */
export function colorRuleInputs(
  holders: readonly ColorHolder[],
  isDM: (uid: string) => boolean,
  requesterUid: string,
): ColorRuleInputs {
  const owners = new Set<string>();
  const others: BlockingColor[] = [];
  for (const holder of holders) {
    if (isDM(holder.ownerUid)) continue;
    owners.add(holder.ownerUid);
    if (holder.ownerUid === requesterUid) continue;
    const lab = colorToOkLab(holder.color);
    if (lab) others.push({ ...holder, lab });
  }
  if (!isDM(requesterUid)) owners.add(requesterUid);
  return { others, playerCount: owners.size, radius: ruleRadius(owners.size) };
}

/** The stored form's OKLab: a colour is judged as the #rrggbb it will be saved as. */
function storedLab(color: string): OkLab | null {
  const normalized = normalizeColor(color);
  return normalized ? colorToOkLab(normalized) : null;
}

/** Blocking colours packed as [L, a, b, L, a, b, …] for the per-cell loops. */
function packed(others: readonly { lab: OkLab }[]): Float64Array {
  const values = new Float64Array(others.length * 3);
  others.forEach((other, index) => {
    values[index * 3] = other.lab.L;
    values[index * 3 + 1] = other.lab.a;
    values[index * 3 + 2] = other.lab.b;
  });
  return values;
}

/** Squared ΔE from one OKLab point to the nearest packed blocker (Infinity if none). */
function nearestSquared(L: number, a: number, b: number, blockers: Float64Array): number {
  let nearest = Infinity;
  for (let index = 0; index < blockers.length; index += 3) {
    const dL = L - blockers[index]!;
    const da = a - blockers[index + 1]!;
    const db = b - blockers[index + 2]!;
    const squared = dL * dL + da * da + db * db;
    if (squared < nearest) nearest = squared;
  }
  return nearest;
}

function minDistance(lab: OkLab, others: readonly { lab: OkLab }[]): number {
  return Math.sqrt(nearestSquared(lab.L, lab.a, lab.b, packed(others)));
}

/**
 * Every cell's room: its distance to the nearest blocking colour. One pass over
 * packed arrays with squared distances: the rule runs on every colour write, so
 * it costs cells × blockers and must stay cheap at a full table.
 */
function cellScores(others: readonly { lab: OkLab }[]): Float64Array {
  const cells = windowCellLabs();
  const blockers = packed(others);
  const scores = new Float64Array(cells.length / 3);
  for (let cell = 0; cell < scores.length; cell += 1) {
    scores[cell] = Math.sqrt(
      nearestSquared(cells[cell * 3]!, cells[cell * 3 + 1]!, cells[cell * 3 + 2]!, blockers),
    );
  }
  return scores;
}

/** The blocking colour nearest to `color`, with its distance, or null. */
export function closestBlocker<T extends { lab: OkLab }>(
  color: string,
  others: readonly T[],
): { holder: T; distance: number } | null {
  const lab = storedLab(color);
  if (!lab || others.length === 0) return null;
  let best: { holder: T; distance: number } | null = null;
  for (const holder of others) {
    const distance = deltaE(lab, holder.lab);
    if (!best || distance < best.distance) best = { holder, distance };
  }
  return best;
}

/**
 * At least r(N) from every blocking colour, measured on the #rrggbb it would be
 * stored as. Unparseable colours are not allowed.
 */
export function isColorAllowed(
  color: string,
  others: readonly { lab: OkLab }[],
  radius: number,
): boolean {
  const lab = storedLab(color);
  return lab !== null && minDistance(lab, others) >= radius;
}

/**
 * Farthest-point choice: the window colour with the most room around it. With
 * an `rng`, a draw among the cells within 8% of the best keeps two joins at an
 * empty table from landing on the same spot; without one, the best cell. Given
 * a `radius`, the draw stays among allowed cells whenever any exist. Never
 * fails: the "never block a join" fallback is this same function.
 */
export function farthestColor(
  others: readonly { lab: OkLab }[],
  rng?: () => number,
  radius = 0,
): string {
  const cells = windowCells();
  if (others.length === 0) {
    return cells[rng ? Math.floor(rng() * cells.length) : Math.floor(cells.length / 2)]!.hex;
  }
  const scores = cellScores(others);
  let bestIndex = 0;
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index]! > scores[bestIndex]!) bestIndex = index;
  }
  if (!rng) return cells[bestIndex]!.hex;
  const best = scores[bestIndex]!;
  const floor = best >= radius ? Math.max(radius, best * 0.92) : best * 0.92;
  const near: number[] = [];
  scores.forEach((score, index) => {
    if (score >= floor) near.push(index);
  });
  return cells[near[Math.floor(rng() * near.length)]!]!.hex;
}

/**
 * The colour a requested one becomes: itself (normalised) when allowed, else
 * the allowed window colour nearest to it; an unreadable request gets the most
 * open allowed colour; with no allowed colour anywhere, the farthest point.
 */
export function nearestAllowedColor(
  color: string,
  others: readonly { lab: OkLab }[],
  radius: number,
): string {
  const lab = storedLab(color);
  if (lab && minDistance(lab, others) >= radius) return normalizeColor(color)!;
  const cells = windowCells();
  const scores = cellScores(others);
  let bestIndex = -1;
  let bestDistance = Infinity;
  scores.forEach((score, index) => {
    if (score < radius) return;
    const distance = lab ? deltaE(lab, cells[index]!.lab) : -score;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex >= 0 ? cells[bestIndex]!.hex : farthestColor(others);
}

/**
 * A random allowed colour visibly different from `current` (the double-click
 * recolour). Falls back to any allowed colour, then to the farthest point.
 */
export function randomAllowedColor(
  others: readonly { lab: OkLab }[],
  radius: number,
  rng: () => number,
  current?: string,
): string {
  const cells = windowCells();
  const from = current ? storedLab(current) : null;
  const step = Math.max(radius, COLOR_RULE.recolorStepMin);
  const scores = cellScores(others);
  const allowed: number[] = [];
  scores.forEach((score, index) => {
    if (score >= radius) allowed.push(index);
  });
  const moved = from ? allowed.filter((index) => deltaE(cells[index]!.lab, from) >= step) : allowed;
  const pool = moved.length > 0 ? moved : allowed;
  if (pool.length === 0) return farthestColor(others, rng);
  return cells[pool[Math.floor(rng() * pool.length)]!]!.hex;
}

/**
 * The most open spots, spread apart: each pick counts the earlier picks as
 * blockers, so three suggestions never bunch in the same gap. Deterministic.
 */
export function suggestedColors(others: readonly { lab: OkLab }[], count = 3): WindowCell[] {
  const cells = windowCells();
  const scores = cellScores(others);
  const picks: WindowCell[] = [];
  for (let pick = 0; pick < count; pick += 1) {
    let bestIndex = 0;
    for (let index = 1; index < scores.length; index += 1) {
      if (scores[index]! > scores[bestIndex]!) bestIndex = index;
    }
    const chosen = cells[bestIndex]!;
    picks.push(chosen);
    // The pick becomes a blocker: each cell's room is now at most its distance to it.
    scores.forEach((score, index) => {
      scores[index] = Math.min(score, deltaE(cells[index]!.lab, chosen.lab));
    });
  }
  return picks;
}

/**
 * Per window cell: the index (into `others`) of the nearest blocking colour
 * whose zone covers it, or -1 when the cell is free. The picker draws zones
 * and labels from this, and bumps the handle against it.
 */
export function zoneMap(others: readonly { lab: OkLab }[], radius: number): Int16Array {
  const cells = windowCellLabs();
  const blockers = packed(others);
  const zones = new Int16Array(cells.length / 3).fill(-1);
  const limit = radius * radius;
  for (let cell = 0; cell < zones.length; cell += 1) {
    let nearest = limit;
    for (let index = 0; index < blockers.length; index += 3) {
      const dL = cells[cell * 3]! - blockers[index]!;
      const da = cells[cell * 3 + 1]! - blockers[index + 1]!;
      const db = cells[cell * 3 + 2]! - blockers[index + 2]!;
      const squared = dL * dL + da * da + db * db;
      if (squared < nearest) {
        nearest = squared;
        zones[cell] = index / 3;
      }
    }
  }
  return zones;
}

/**
 * Bump-at-the-edge: the free cell nearest to where the pointer is (hue
 * wrapping), or the pointer's own cell when it is free; null when the whole
 * window is covered (the server will choose). Distance is in ΔE units by
 * default; a picker drawn at another aspect passes its width / height so the
 * handle stops at the edge that LOOKS nearest.
 */
export function nearestFreeCell(
  point: WindowPoint,
  zones: Int16Array,
  aspect?: number,
): WindowCell | null {
  const cells = windowCells();
  const own = cells[cellIndexAt(point)]!;
  if (zones[cellIndexAt(point)] === -1) return own;
  const u = ((point.u % 1) + 1) % 1;
  const distance = (cell: WindowCell): number => {
    if (aspect === undefined) return windowDistance(point, cell);
    const across = Math.abs(u - cell.u);
    return Math.hypot(Math.min(across, 1 - across) * aspect, point.v - cell.v);
  };
  let best: WindowCell | null = null;
  let bestDistance = Infinity;
  cells.forEach((cell, index) => {
    if (zones[index] !== -1) return;
    const away = distance(cell);
    if (away < bestDistance) {
      bestDistance = away;
      best = cell;
    }
  });
  return best;
}
