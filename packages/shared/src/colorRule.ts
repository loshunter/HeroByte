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
  windowCells,
  windowDistance,
  windowSize,
  type WindowCell,
  type WindowPoint,
} from "./colorWindow.js";

export const COLOR_RULE = {
  /** Share of the window the zones may fill between them, leaving room to move. */
  fill: 0.5,
  /** ΔE bounds on the zone radius (ΔE 0.02 is about a just-noticeable step). */
  radiusMin: 0.03,
  radiusMax: 0.1,
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

function minDistance(lab: OkLab, others: readonly { lab: OkLab }[]): number {
  let nearest = Infinity;
  for (const other of others) nearest = Math.min(nearest, deltaE(lab, other.lab));
  return nearest;
}

/** The blocking colour nearest to `color`, with its distance, or null. */
export function closestBlocker<T extends { lab: OkLab }>(
  color: string,
  others: readonly T[],
): { holder: T; distance: number } | null {
  const lab = colorToOkLab(color);
  if (!lab || others.length === 0) return null;
  let best: { holder: T; distance: number } | null = null;
  for (const holder of others) {
    const distance = deltaE(lab, holder.lab);
    if (!best || distance < best.distance) best = { holder, distance };
  }
  return best;
}

/** At least r(N) from every blocking colour. Unparseable colours are not allowed. */
export function isColorAllowed(
  color: string,
  others: readonly { lab: OkLab }[],
  radius: number,
): boolean {
  const lab = colorToOkLab(color);
  return lab !== null && minDistance(lab, others) >= radius;
}

function scoredCells(others: readonly { lab: OkLab }[]): { cell: WindowCell; score: number }[] {
  return windowCells().map((cell) => ({ cell, score: minDistance(cell.lab, others) }));
}

/**
 * Farthest-point choice: the window colour with the most room around it. With
 * an `rng`, a draw among the cells within 8% of the best keeps two joins at an
 * empty table from landing on the same spot; without one, the best cell.
 * Never fails — the "never block a join" fallback is this same function.
 */
export function farthestColor(others: readonly { lab: OkLab }[], rng?: () => number): string {
  const scored = scoredCells(others);
  if (others.length === 0) {
    const cells = windowCells();
    return cells[rng ? Math.floor(rng() * cells.length) : Math.floor(cells.length / 2)]!.hex;
  }
  const best = scored.reduce((top, entry) => (entry.score > top.score ? entry : top));
  if (!rng) return best.cell.hex;
  const near = scored.filter((entry) => entry.score >= best.score * 0.92);
  return near[Math.floor(rng() * near.length)]!.cell.hex;
}

/**
 * The colour a requested one becomes: itself (normalised) when allowed, else
 * the allowed window colour nearest to it, else the farthest point.
 */
export function nearestAllowedColor(
  color: string,
  others: readonly { lab: OkLab }[],
  radius: number,
): string {
  const lab = colorToOkLab(color);
  if (lab && minDistance(lab, others) >= radius) return normalizeColor(color)!;
  let best: { hex: string; distance: number } | null = null;
  for (const { cell, score } of scoredCells(others)) {
    if (score < radius) continue;
    const distance = lab ? deltaE(lab, cell.lab) : -score;
    if (!best || distance < best.distance) best = { hex: cell.hex, distance };
  }
  return best ? best.hex : farthestColor(others);
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
  const from = current ? colorToOkLab(current) : null;
  const step = Math.max(radius, COLOR_RULE.recolorStepMin);
  const allowed = scoredCells(others).filter((entry) => entry.score >= radius);
  const moved = from ? allowed.filter((entry) => deltaE(entry.cell.lab, from) >= step) : allowed;
  const pool = moved.length > 0 ? moved : allowed;
  if (pool.length === 0) return farthestColor(others, rng);
  return pool[Math.floor(rng() * pool.length)]!.cell.hex;
}

/**
 * The most open spots, spread apart: each pick counts the earlier picks as
 * blockers, so three suggestions never bunch in the same gap. Deterministic.
 */
export function suggestedColors(others: readonly { lab: OkLab }[], count = 3): WindowCell[] {
  const picks: WindowCell[] = [];
  const blockers: { lab: OkLab }[] = [...others];
  for (let index = 0; index < count; index += 1) {
    const scored = scoredCells(blockers);
    const best = scored.reduce((top, entry) => (entry.score > top.score ? entry : top));
    picks.push(best.cell);
    blockers.push({ lab: best.cell.lab });
  }
  return picks;
}

/**
 * Per window cell: the index (into `others`) of the nearest blocking colour
 * whose zone covers it, or -1 when the cell is free. The picker draws zones
 * and labels from this, and bumps the handle against it.
 */
export function zoneMap(others: readonly { lab: OkLab }[], radius: number): Int16Array {
  const cells = windowCells();
  const zones = new Int16Array(cells.length).fill(-1);
  cells.forEach((cell, index) => {
    let nearest = radius;
    others.forEach((other, owner) => {
      const distance = deltaE(cell.lab, other.lab);
      if (distance < nearest) {
        nearest = distance;
        zones[index] = owner;
      }
    });
  });
  return zones;
}

/**
 * Bump-at-the-edge: the free cell nearest (in window distance, hue wrapping)
 * to where the pointer is, or the pointer's own cell when it is free. Null
 * when the whole window is covered (the server will choose).
 */
export function nearestFreeCell(point: WindowPoint, zones: Int16Array): WindowCell | null {
  const cells = windowCells();
  const own = cells[cellIndexAt(point)]!;
  if (zones[cellIndexAt(point)] === -1) return own;
  let best: { cell: WindowCell; distance: number } | null = null;
  cells.forEach((cell, index) => {
    if (zones[index] !== -1) return;
    const distance = windowDistance(point, cell);
    if (!best || distance < best.distance) best = { cell, distance };
  });
  return best ? (best as { cell: WindowCell }).cell : null;
}
