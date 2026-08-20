/**
 * RollEntry — the label
 *
 * `DiceRoll.label` is what a roll was FOR, when the server said. It exists
 * because `playerName` answers "who rolled", which for initiative is not the
 * interesting question: a DM rolling for five goblins would otherwise produce
 * five identical rows under their own name.
 *
 * NOTE these render a hand-built RollLogEntry, so they prove the RENDERING
 * only. That the field survives the wire -> client mapping is asserted in
 * hooks/__tests__/useDiceRolling.test.ts, because that mapper enumerates the
 * fields it copies and would otherwise drop this one in silence.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollEntry } from "../RollEntry";
import type { RollLogEntry } from "../rollLogTypes";

function createRoll(overrides: Partial<RollLogEntry> = {}): RollLogEntry {
  return {
    id: "roll-1",
    playerUid: "dm-uid",
    playerName: "Dungeon Master",
    formula: "d20 + 2",
    perDie: [{ tokenId: "t0", die: "d20", rolls: [13], subtotal: 13 }],
    total: 15,
    timestamp: 1000,
    ...overrides,
  };
}

describe("RollEntry - label", () => {
  const onViewRoll = vi.fn();

  it("shows what the roll was for", () => {
    render(
      <RollEntry roll={createRoll({ label: "Goblin A — initiative" })} onViewRoll={onViewRoll} />,
    );

    expect(screen.getByTestId("roll-label")).toHaveTextContent("Goblin A — initiative");
  });

  it("keeps the roller's name alongside it, not instead of it", () => {
    // Both questions matter for a DM sweep: who pressed the button, and which
    // creature this row belongs to.
    render(
      <RollEntry roll={createRoll({ label: "Goblin A — initiative" })} onViewRoll={onViewRoll} />,
    );

    expect(screen.getByText("Dungeon Master")).toBeInTheDocument();
    expect(screen.getByTestId("roll-label")).toBeInTheDocument();
  });

  it("renders nothing extra for an ordinary dice roll", () => {
    render(<RollEntry roll={createRoll()} onViewRoll={onViewRoll} />);

    expect(screen.queryByTestId("roll-label")).not.toBeInTheDocument();
  });

  it("tells two creatures apart in the same DM's sweep", () => {
    // The failure this whole field exists to prevent: five identical rows.
    const { rerender } = render(
      <RollEntry roll={createRoll({ label: "Goblin A — initiative" })} onViewRoll={onViewRoll} />,
    );
    expect(screen.getByTestId("roll-label")).toHaveTextContent("Goblin A — initiative");

    rerender(
      <RollEntry
        roll={createRoll({ id: "roll-2", label: "Goblin B — initiative" })}
        onViewRoll={onViewRoll}
      />,
    );
    expect(screen.getByTestId("roll-label")).toHaveTextContent("Goblin B — initiative");
  });

  it("sanitizes the label rather than trusting it", () => {
    // Server-set today, but it reaches the DOM through the same path as every
    // other piece of roll text, all of which is sanitized.
    render(
      <RollEntry
        roll={createRoll({ label: "<img src=x onerror=alert(1)> — initiative" })}
        onViewRoll={onViewRoll}
      />,
    );

    const label = screen.getByTestId("roll-label");
    expect(label.querySelector("img")).toBeNull();
  });
});
