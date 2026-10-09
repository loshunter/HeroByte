import { describe, expect, it } from "vitest";
import { colorToOkLab, deltaE, type OkLab } from "../colorSpace.js";
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
import { windowCells, windowColorAt, windowPointOf } from "../colorWindow.js";
import { createSeededRng } from "../rng.js";

const blocker = (color: string) => ({ lab: colorToOkLab(color)! });
const labOf = (color: string): OkLab => colorToOkLab(color)!;
const RED = windowColorAt({ u: 0.08, v: 0.5 }).hex;
const BLUE = windowColorAt({ u: 0.7, v: 0.5 }).hex;

describe("ruleRadius", () => {
  it("is capped for small tables and floored for huge ones", () => {
    expect(ruleRadius(1)).toBe(COLOR_RULE.radiusMax);
    expect(ruleRadius(2)).toBe(COLOR_RULE.radiusMax);
    expect(ruleRadius(10_000)).toBe(COLOR_RULE.radiusMin);
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

  it("uses the recolour step when the radius is smaller", () => {
    const next = randomAllowedColor([], 0.01, createSeededRng(2), BLUE);
    expect(deltaE(labOf(next), labOf(BLUE))).toBeGreaterThanOrEqual(COLOR_RULE.recolorStepMin);
  });

  it("falls back to the farthest point when nothing is allowed", () => {
    const others = [blocker(RED)];
    const rng = createSeededRng(5);
    expect(randomAllowedColor(others, 10, rng)).toBe(farthestColor(others, createSeededRng(5)));
  });

  it("keeps any allowed colour when every allowed one is near the current", () => {
    const rng = createSeededRng(9);
    const next = randomAllowedColor([], 0.03, rng, BLUE);
    expect(next).toMatch(/^#[0-9a-f]{6}$/);
    // A radius so large around everything but the current colour's own area:
    const crowded = windowCells()
      .filter((cell) => deltaE(cell.lab, labOf(BLUE)) > 0.06)
      .filter((_, index) => index % 40 === 0)
      .map((cell) => ({ lab: cell.lab }));
    const result = randomAllowedColor(crowded, 0.05, createSeededRng(4), BLUE);
    expect(isColorAllowed(result, crowded, 0.05)).toBe(true);
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

  it("leaves a free point where it is", () => {
    const point = windowPointOf(farthestColor(others))!;
    expect(zones[cells.indexOf(nearestFreeCell(point, zones)!)]).toBe(-1);
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
