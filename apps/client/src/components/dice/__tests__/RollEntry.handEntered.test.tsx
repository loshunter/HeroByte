/**
 * RollEntry — a number a person typed must not look like one the server rolled.
 *
 * This is the honesty half of the physical-dice feature, and the reason it is
 * worth its own file. A table that rolls real dice is not defrauded by a number
 * it watched someone throw; it is defrauded by that number being
 * indistinguishable from the server's. So the row carries the distinction in
 * three independent channels — a badge, a colour, and the superseded value
 * struck through — and losing any one of them silently is what these pin.
 *
 * NOTE these render a hand-built RollLogEntry, so they prove the RENDERING
 * only. That the fields survive the wire -> client mapping is asserted in
 * hooks/__tests__/useDiceRolling.test.ts, because that mapper enumerates the
 * fields it copies and would otherwise drop them in silence.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollEntry } from "../RollEntry";
import type { RollLogEntry } from "../rollLogTypes";

function createRoll(overrides: Partial<RollLogEntry> = {}): RollLogEntry {
  return {
    id: "roll-1",
    playerUid: "player-1",
    playerName: "Mara",
    formula: "14 + 3",
    perDie: [
      { tokenId: "t0", subtotal: 14 },
      { tokenId: "t1", subtotal: 3 },
    ],
    total: 17,
    timestamp: 1000,
    ...overrides,
  };
}

const onViewRoll = vi.fn();
const entered = (overrides: Partial<RollLogEntry> = {}) =>
  createRoll({ handEntered: true, ...overrides });

describe("RollEntry — hand-entered results", () => {
  it("says BY HAND on a typed result", () => {
    render(<RollEntry roll={entered()} onViewRoll={onViewRoll} />);

    expect(screen.getByTestId("roll-entered-badge")).toHaveTextContent("BY HAND");
  });

  it("says nothing of the kind on a server roll — the badge has to MEAN something", () => {
    render(<RollEntry roll={createRoll()} onViewRoll={onViewRoll} />);

    expect(screen.queryByTestId("roll-entered-badge")).toBeNull();
  });

  it("strikes the superseded total through, beside the one that replaced it", () => {
    render(<RollEntry roll={entered({ supersededTotal: 9 })} onViewRoll={onViewRoll} />);

    const struck = screen.getByTestId("roll-superseded");
    expect(struck).toHaveTextContent("9");
    // Struck, not merely present. Rendered plainly it reads as a second total.
    expect(struck).toHaveStyle({ textDecoration: "line-through" });
  });

  it("shows nothing struck on a FIRST entry, which is the common case", () => {
    // A table using physical dice for everything never has a server roll to
    // supersede — the row is the number alone, still badged.
    render(<RollEntry roll={entered()} onViewRoll={onViewRoll} />);

    expect(screen.queryByTestId("roll-superseded")).toBeNull();
    expect(screen.getByTestId("roll-entered-badge")).toBeInTheDocument();
  });

  it("never strikes a value through on a roll that was not hand-entered", () => {
    // supersededTotal without the marker would be a rolled result wearing the
    // override's clothes. The marker gates the whole treatment.
    render(<RollEntry roll={createRoll({ supersededTotal: 9 })} onViewRoll={onViewRoll} />);

    expect(screen.queryByTestId("roll-superseded")).toBeNull();
  });

  it("colours the total differently from a rolled one", () => {
    // The channel a reader takes in before any words. Asserted as a DIFFERENCE
    // rather than against a literal, so a palette change cannot make this test
    // wrong while the rows stay distinguishable — and cannot pass if the two
    // are ever collapsed to one colour.
    const { container: rolledView } = render(
      <RollEntry roll={createRoll()} onViewRoll={onViewRoll} />,
    );
    const rolledTotal = rolledView.querySelector(".jrpg-text-command") as HTMLElement;
    const rolledColor = rolledTotal.style.color;

    const { container: enteredView } = render(
      <RollEntry roll={entered()} onViewRoll={onViewRoll} />,
    );
    const enteredTotal = enteredView.querySelector(".jrpg-text-command") as HTMLElement;

    expect(enteredTotal.style.color).not.toBe("");
    expect(enteredTotal.style.color).not.toBe(rolledColor);
  });

  it("still shows the total itself, which the strikethrough must not crowd out", () => {
    render(<RollEntry roll={entered({ supersededTotal: 9 })} onViewRoll={onViewRoll} />);

    expect(screen.getByText("= 17")).toBeInTheDocument();
  });
});
