// The DM may erase anyone's drawing: a whole shape (deleteDrawing) always went, but a
// cut through a player's freehand line (erase-partial) was silently refused — the
// owner-only rule had no DM exemption. The cut pieces stay the player's.
import { describe, expect, it } from "vitest";
import { ALICE, BOB, DM, drawing, historyFixture, segment } from "./history.fixtures.js";

describe("a partial erase of someone else's freehand line", () => {
  it("goes for the DM, and the pieces stay their owner's", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("line"), ALICE);
    expect(
      service.handlePartialErase(state, "line", [segment(0, 5), segment(15, 20)], DM, true),
    ).toBe(true);
    expect(state.drawings.map((d) => d.owner)).toEqual([ALICE, ALICE]);
    // The DM's own Undo puts the line back.
    expect(service.undoDrawing(state, DM)).toBe(true);
    expect(state.drawings.map((d) => [d.id, d.owner])).toEqual([["line", ALICE]]);
  });

  it("is still refused to another player", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("line"), ALICE);
    expect(service.handlePartialErase(state, "line", [segment(0, 5)], BOB)).toBe(false);
    expect(state.drawings.map((d) => d.id)).toEqual(["line"]);
  });
});
