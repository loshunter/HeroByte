import { describe, expect, it } from "vitest";
import { colorToOkLab, deltaE, normalizeColor, type OkLab } from "../colorSpace.js";
import {
  COLOR_RULE,
  closestBlocker,
  colorRuleInputs,
  farthestColor,
  isColorAllowed,
  nearestAllowedColor,
  nearestFreeCell,
  randomAllowedColor,
  ruleRadius,
  suggestedColors,
  zoneMap,
} from "../colorRule.js";
import { cellIndexAt, windowCells, windowColorAt, windowPointOf } from "../colorWindow.js";
import { createSeededRng } from "../rng.js";

const blocker = (color: string) => ({ lab: colorToOkLab(color)! });
const labOf = (color: string): OkLab => colorToOkLab(color)!;
const RED = windowColorAt({ u: 0.08, v: 0.5 }).hex;
const BLUE = windowColorAt({ u: 0.7, v: 0.5 }).hex;

describe("ruleRadius", () => {
  it("is capped for one player and floored for huge tables", () => {
    expect(ruleRadius(1)).toBe(COLOR_RULE.radiusMax);
    expect(ruleRadius(10_000)).toBe(COLOR_RULE.radiusMin);
  });

  it("shrinks the zones from the second player on (the owner's model)", () => {
    expect(ruleRadius(2)).toBeLessThan(ruleRadius(1));
    expect(ruleRadius(3)).toBeLessThan(ruleRadius(2));
    expect(ruleRadius(4)).toBeLessThan(ruleRadius(3));
  });

  it("never grows as players join", () => {
    for (let n = 1; n < 40; n += 1) expect(ruleRadius(n + 1)).toBeLessThanOrEqual(ruleRadius(n));
  });

  it("treats zero or negative counts as one player", () => {
    expect(ruleRadius(0)).toBe(ruleRadius(1));
    expect(ruleRadius(-5)).toBe(ruleRadius(1));
  });
});

describe("colorRuleInputs", () => {
  const isDM = (uid: string) => uid === "dm";
  const holders = [
    { ownerUid: "dm", color: "#ff0000", name: "DM's hero" },
    { ownerUid: "me", color: "#00ff00", name: "Mine" },
    { ownerUid: "me", color: "#00ff10", name: "Mine too" },
    { ownerUid: "sam", color: "#0000ff", name: "Sam's" },
    { ownerUid: "kit", color: "not a colour", name: "Kit's" },
  ];

  it("blocks with other non-DM players' colours only", () => {
    const { others } = colorRuleInputs(holders, isDM, "me");
    expect(others.map((other) => other.name)).toEqual(["Sam's"]);
  });

  it("counts every non-DM player with a PC, the requester included", () => {
    expect(colorRuleInputs(holders, isDM, "me").playerCount).toBe(3);
    expect(colorRuleInputs(holders, isDM, "newcomer").playerCount).toBe(4);
    expect(colorRuleInputs(holders, isDM, "dm").playerCount).toBe(3);
  });

  it("sizes the radius from that count", () => {
    const inputs = colorRuleInputs(holders, isDM, "newcomer");
    expect(inputs.radius).toBe(ruleRadius(inputs.playerCount));
  });
});

describe("isColorAllowed / closestBlocker", () => {
  const others = [blocker(RED)];

  it("refuses a colour inside the zone and allows one outside", () => {
    expect(isColorAllowed(RED, others, 0.1)).toBe(false);
    expect(isColorAllowed(BLUE, others, 0.1)).toBe(true);
    expect(isColorAllowed("junk", others, 0.1)).toBe(false);
    expect(isColorAllowed(RED, [], 0.1)).toBe(true);
  });

  it("wraps hue: a colour just across the seam from a zone is inside it", () => {
    const left = windowColorAt({ u: 0.002, v: 0.5 }).hex;
    const right = windowColorAt({ u: 0.998, v: 0.5 }).hex;
    expect(isColorAllowed(right, [blocker(left)], 0.05)).toBe(false);
  });

  it("names the nearest blocker", () => {
    const named = [
      { ...blocker(RED), name: "red" },
      { ...blocker(BLUE), name: "blue" },
    ];
    expect(closestBlocker(BLUE, named)!.holder.name).toBe("blue");
    expect(closestBlocker(BLUE, [])).toBeNull();
    expect(closestBlocker("junk", named)).toBeNull();
  });
});

describe("nearestAllowedColor", () => {
  it("judges a colour as the hex it will be stored as, not the unrounded request", () => {
    // hsl(16.56, 70%, 50%) is a hair over r from Annika's colour before rounding
    // and a hair under it as the #rrggbb it would be stored as.
    const annika = [blocker("#e0864a")];
    const request = "hsl(16.56, 70%, 50%)";
    const unrounded = colorToOkLab(request)!;
    const stored = colorToOkLab(normalizeColor(request)!)!;
    expect(deltaE(unrounded, annika[0]!.lab)).toBeGreaterThanOrEqual(0.1);
    expect(deltaE(stored, annika[0]!.lab)).toBeLessThan(0.1);
    expect(isColorAllowed(request, annika, 0.1)).toBe(false);
    const snapped = nearestAllowedColor(request, annika, 0.1);
    expect(deltaE(labOf(snapped), annika[0]!.lab)).toBeGreaterThanOrEqual(0.1);
  });

  it("keeps an allowed colour exactly (normalised)", () => {
    expect(nearestAllowedColor(BLUE.toUpperCase(), [blocker(RED)], 0.1)).toBe(BLUE);
  });

  it("snaps a colour inside a zone to just outside it", () => {
    const snapped = nearestAllowedColor(RED, [blocker(RED)], 0.1);
    const distance = deltaE(labOf(snapped), labOf(RED));
    expect(distance).toBeGreaterThanOrEqual(0.1);
    expect(distance).toBeLessThan(0.13);
  });

  it("reassigns an unparseable colour to an allowed one", () => {
    const others = [blocker(RED)];
    expect(isColorAllowed(nearestAllowedColor("junk", others, 0.1), others, 0.1)).toBe(true);
  });

  it("never fails: a fully covered window still yields the farthest point", () => {
    const others = [blocker(RED), blocker(BLUE)];
    expect(nearestAllowedColor(RED, others, 10)).toBe(farthestColor(others));
  });
});

describe("farthestColor", () => {
  it("lands far from every colour already taken", () => {
    const others = [blocker(RED), blocker(BLUE)];
    const chosen = labOf(farthestColor(others));
    expect(deltaE(chosen, others[0]!.lab)).toBeGreaterThan(0.15);
    expect(deltaE(chosen, others[1]!.lab)).toBeGreaterThan(0.15);
  });

  it("draws among the near-best cells when given an rng, deterministically per seed", () => {
    const others = [blocker(RED)];
    const first = farthestColor(others, createSeededRng(7));
    expect(farthestColor(others, createSeededRng(7))).toBe(first);
    const best = farthestColor(others);
    const room = (hex: string) => deltaE(labOf(hex), others[0]!.lab);
    expect(room(first)).toBeGreaterThanOrEqual(room(best) * 0.92 - 1e-9);
  });

  it("draws only among allowed colours when any exist, even inside the 8% spread", () => {
    // One player's twenty colours on a sparse lattice: the best open spot is just
    // over r, and cells within 8% of it would fall inside zones.
    const lattice = windowCells()
      .filter((cell) => cell.column % 19 === 0 && cell.row % 40 === 10)
      .map((cell) => ({ lab: cell.lab }));
    const radius = 0.1;
    expect(windowCells().some((cell) => isColorAllowed(cell.hex, lattice, radius))).toBe(true);
    for (let draw = 0; draw < 60; draw += 1) {
      const chosen = farthestColor(lattice, () => (draw + 0.5) / 60, radius);
      expect(isColorAllowed(chosen, lattice, radius)).toBe(true);
    }
  });

  it("picks any window colour at an empty table", () => {
    const cells = windowCells();
    expect(farthestColor([])).toBe(cells[Math.floor(cells.length / 2)]!.hex);
    expect(cells.map((cell) => cell.hex)).toContain(farthestColor([], createSeededRng(3)));
  });
});

describe("randomAllowedColor", () => {
  it("lands on an allowed colour visibly away from the current one", () => {
    const others = [blocker(RED)];
    const rng = createSeededRng(11);
    for (let draw = 0; draw < 20; draw += 1) {
      const next = randomAllowedColor(others, 0.1, rng, BLUE);
      expect(isColorAllowed(next, others, 0.1)).toBe(true);
      expect(deltaE(labOf(next), labOf(BLUE))).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("uses the recolour step when the radius is smaller, for every draw", () => {
    // Exhaustive over the generator's range: a sampled seed missed a filter that
    // used the radius instead of the step.
    for (let draw = 0; draw < 500; draw += 1) {
      const next = randomAllowedColor([], 0.01, () => (draw + 0.5) / 500, BLUE);
      expect(deltaE(labOf(next), labOf(BLUE))).toBeGreaterThanOrEqual(COLOR_RULE.recolorStepMin);
    }
  });

  it("falls back to the farthest point when nothing is allowed", () => {
    const others = [blocker(RED)];
    const rng = createSeededRng(5);
    expect(randomAllowedColor(others, 10, rng)).toBe(farthestColor(others, createSeededRng(5)));
  });

  it("keeps any allowed colour when every allowed one is near the current", () => {
    // Two colours taken and a radius just under the most open spot's room: the
    // allowed colours are a small patch around that spot, all within one recolour
    // step of it, so a recolour from there must fall back to any allowed colour.
    const others = [blocker(RED), blocker(BLUE)];
    const current = farthestColor(others);
    const room = Math.min(
      deltaE(labOf(current), others[0]!.lab),
      deltaE(labOf(current), others[1]!.lab),
    );
    const radius = room * 0.97;
    const allowed = windowCells().filter((cell) => isColorAllowed(cell.hex, others, radius));
    expect(allowed.length).toBeGreaterThan(5);
    expect(allowed.every((cell) => deltaE(cell.lab, labOf(current)) < radius)).toBe(true);
    const drawn = new Set<string>();
    for (let draw = 0; draw < 40; draw += 1) {
      const result = randomAllowedColor(others, radius, () => (draw + 0.5) / 40, current);
      expect(isColorAllowed(result, others, radius)).toBe(true);
      drawn.add(result);
    }
    expect(drawn.size).toBeGreaterThan(1);
  });
});

describe("suggestedColors", () => {
  it("offers three spread-out open spots", () => {
    const others = [blocker(RED), blocker(BLUE)];
    const spots = suggestedColors(others);
    expect(spots).toHaveLength(3);
    for (const spot of spots) expect(isColorAllowed(spot.hex, others, 0.1)).toBe(true);
    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        expect(deltaE(spots[i]!.lab, spots[j]!.lab)).toBeGreaterThan(0.1);
      }
    }
  });
});

describe("zoneMap and nearestFreeCell", () => {
  const others = [blocker(RED), blocker(BLUE)];
  const zones = zoneMap(others, 0.1);
  const cells = windowCells();

  it("marks each covered cell with its nearest blocker and leaves the rest free", () => {
    cells.forEach((cell, index) => {
      const toRed = deltaE(cell.lab, others[0]!.lab);
      const toBlue = deltaE(cell.lab, others[1]!.lab);
      const expected = Math.min(toRed, toBlue) >= 0.1 ? -1 : toRed <= toBlue ? 0 : 1;
      expect(zones[index]).toBe(expected);
    });
  });

  it("leaves a free point in its own cell", () => {
    const point = windowPointOf(farthestColor(others))!;
    expect(nearestFreeCell(point, zones)).toBe(cells[cellIndexAt(point)]);
  });

  it("stops at the edge that looks nearest in the picker's own aspect", () => {
    // A tall-drawn window (aspect 1) makes the side edge nearer than in ΔE units.
    const inside = windowPointOf(RED)!;
    const deltaEdge = nearestFreeCell(inside, zones)!;
    const drawnEdge = nearestFreeCell(inside, zones, 1)!;
    expect(zones[cells.indexOf(drawnEdge)]).toBe(-1);
    const screen = (cell: { u: number; v: number }) => {
      const across = Math.abs(inside.u - cell.u);
      return Math.hypot(Math.min(across, 1 - across), inside.v - cell.v);
    };
    const nearestOnScreen = Math.min(
      ...cells.filter((_, index) => zones[index] === -1).map((cell) => screen(cell)),
    );
    expect(screen(drawnEdge)).toBeCloseTo(nearestOnScreen, 12);
    expect(screen(deltaEdge)).toBeGreaterThan(nearestOnScreen);
  });

  it("bumps a point inside a zone to the zone's edge", () => {
    const inside = windowPointOf(RED)!;
    const edge = nearestFreeCell(inside, zones)!;
    const distance = deltaE(edge.lab, others[0]!.lab);
    expect(distance).toBeGreaterThanOrEqual(0.1);
    expect(distance).toBeLessThan(0.13);
  });

  it("has nowhere to go when every cell is covered", () => {
    expect(nearestFreeCell({ u: 0.5, v: 0.5 }, zoneMap(others, 10))).toBeNull();
  });
});
