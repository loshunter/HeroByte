import { describe, expect, it } from "vitest";
import { BAR_GAP, selectionBarLeft, selectionBarPlacement } from "../selectionBarPlacement";

describe("selectionBarLeft", () => {
  it("centres the bar when nothing overlaps its strip", () => {
    expect(selectionBarLeft(300, 1024, [])).toBe(362);
    // A window off to the side, clear of the centred bar, changes nothing.
    expect(selectionBarLeft(300, 1024, [{ left: 700, right: 1000 }])).toBe(362);
  });

  it("steps left of Chat & Rolls docked at the right of a 1024 px screen", () => {
    // Chat & Rolls: x = innerWidth - 420, 400 wide.
    const chat = { left: 604, right: 1004 };
    const left = selectionBarLeft(300, 1024, [chat]);
    expect(left! + 300).toBeLessThanOrEqual(chat.left - BAR_GAP);
    expect(left).toBe(chat.left - BAR_GAP - 300);
  });

  it("takes the gap nearest the centre when windows sit on both sides", () => {
    const left = selectionBarLeft(200, 1200, [
      { left: 100, right: 450 },
      { left: 700, right: 1100 },
    ]);
    // The only gap that fits is between them: 458..692, and its middle-most spot is centred.
    expect(left).toBeGreaterThanOrEqual(458);
    expect(left! + 200).toBeLessThanOrEqual(692);
  });

  it("finds no one-row place when no gap holds the bar", () => {
    expect(selectionBarLeft(300, 700, [{ left: 150, right: 600 }])).toBeNull();
  });

  it("wraps into the widest gap when none holds it on one row (922 px beside Chat)", () => {
    // Chat & Rolls at 502..914 leaves 8..494: 486 px, a little under the bar's one row.
    expect(selectionBarPlacement(500, 922, [{ left: 502, right: 914 }])).toEqual({
      left: BAR_GAP,
      maxWidth: 494 - BAR_GAP,
    });
  });

  it("stays centred when even the widest gap is too narrow to wrap into", () => {
    expect(selectionBarPlacement(300, 700, [{ left: 150, right: 600 }])).toEqual({
      left: 200,
      maxWidth: null,
    });
  });

  it("never pushes the bar off the screen's edge", () => {
    const left = selectionBarLeft(300, 1024, [{ left: 200, right: 1020 }]);
    expect(left).toBeNull(); // no gap holds it (8..192 is 184 wide)
    const roomy = selectionBarLeft(150, 1024, [{ left: 200, right: 1020 }]);
    expect(roomy).toBeGreaterThanOrEqual(BAR_GAP);
    expect(roomy! + 150).toBeLessThanOrEqual(200 - BAR_GAP);
  });
});
