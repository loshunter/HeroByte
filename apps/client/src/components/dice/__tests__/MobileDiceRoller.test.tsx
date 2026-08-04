/**
 * Component tests for MobileDiceRoller
 *
 * Regression focus: after rolling, the result must be visible inside the
 * roller itself (players previously had to close the roller and open the
 * roll log because the result panel rendered with zero height).
 *
 * S5 focus: the roll is now a ROUND TRIP. The component sends a formula and
 * the answer arrives later as a new `latestOwnRoll` prop off the snapshot —
 * so these tests drive the real asynchronous path by rerendering with the
 * server's reply, not by mocking a local roller that no longer exists.
 *
 * Source: apps/client/src/components/dice/MobileDiceRoller.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MobileDiceRoller } from "../MobileDiceRoller";
import type { RollLogEntry } from "../rollLogTypes";

function serverRoll(id: string, total = 10): RollLogEntry {
  return {
    id,
    playerUid: "me",
    playerName: "Me",
    formula: "d20",
    perDie: [{ tokenId: "t0", die: "d20", rolls: [total], subtotal: total }],
    total,
    timestamp: 0,
  };
}

describe("MobileDiceRoller", () => {
  const mockOnClose = vi.fn();
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Build a d20, press ROLL, then let the server answer and the dice land. */
  function rollAndAnswer(
    rerender: (ui: React.ReactElement) => void,
    answer: RollLogEntry,
    previous: RollLogEntry | null = null,
  ) {
    fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
    fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
    rerender(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={answer} onClose={mockOnClose} />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    return previous;
  }

  describe("Rolling", () => {
    it("asks the server for a formula and sends no result of its own", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      expect(mockOnRoll).toHaveBeenCalledTimes(1);
      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "d20",
        mode: "normal",
        visibility: "public",
      });
    });

    it("shows the SERVER's total inside the roller once it arrives", () => {
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      rollAndAnswer(rerender, serverRoll("r1", 17));

      expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("17");
    });

    it("should not show a result before rolling", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      expect(screen.queryByTestId("mobile-roll-result")).not.toBeInTheDocument();
    });

    it("does not mistake an existing roll of mine for the answer to this one", () => {
      // The panel opens with a roll already in history. Pressing ROLL must
      // wait for a NEW one — otherwise the previous total flashes up as if it
      // were this roll's.
      const stale = serverRoll("old", 3);
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={stale} onClose={mockOnClose} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.queryByTestId("mobile-roll-result")).not.toBeInTheDocument();

      rerender(
        <MobileDiceRoller
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("new", 19)}
          onClose={mockOnClose}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("roll-result-total").textContent).toBe("19");
    });

    it("gives the roll button back when the server never answers", () => {
      // A refused roll produces no reply at all. Without the failsafe, ROLL
      // stays disabled until the panel is reopened.
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      expect(screen.getByRole("button", { name: /roll dice/i })).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.getByRole("button", { name: /roll dice/i })).not.toBeDisabled();
    });
  });

  describe("Roll options", () => {
    it("sends advantage and a private visibility when they are selected", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: "ADV" }));
      fireEvent.click(screen.getByRole("button", { name: "ME" }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "d20",
        mode: "advantage",
        visibility: "self",
      });
    });

    it("rolls a built-in macro without touching the build strip", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: "2d6" }));

      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "2d6",
        mode: "normal",
        visibility: "public",
      });
    });
  });

  describe("Dismissing the result", () => {
    it("should hide the result when its close button is tapped", () => {
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      rollAndAnswer(rerender, serverRoll("r1"));
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(screen.queryByTestId("mobile-roll-result")).not.toBeInTheDocument();
    });

    it("should keep the build after dismissing so the player can re-roll", () => {
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      rollAndAnswer(rerender, serverRoll("r1"));
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(screen.getByRole("button", { name: /roll dice/i })).not.toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      rerender(
        <MobileDiceRoller
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("r2", 12)}
          onClose={mockOnClose}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
      expect(mockOnRoll).toHaveBeenCalledTimes(2);
    });

    it("should not close the whole roller when dismissing the result", () => {
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      rollAndAnswer(rerender, serverRoll("r1"));
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /roll dice/i })).toBeInTheDocument();
    });
  });

  describe("a roll the server would refuse", () => {
    // The build strip can assemble more terms and more dice than the server
    // accepts. Before it was checked here, the request went out, the server
    // dropped it in silence, and ROLL sat dead for six seconds.
    it("says why instead of sending a roll that would vanish", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      // Seventeen +1 chips: one term each, over the 16-term ceiling.
      for (let i = 0; i < 17; i++) {
        fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));
      }
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      expect(mockOnRoll).not.toHaveBeenCalled();
      expect(screen.getByTestId("dice-error")).toHaveTextContent("more than 16 terms");
      // ...and the button is still usable, not stuck mid-animation.
      expect(screen.getByRole("button", { name: /roll dice/i })).not.toBeDisabled();
    });

    it("clears the message once the build changes", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />);

      for (let i = 0; i < 17; i++) {
        fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));
      }
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      expect(screen.getByTestId("dice-error")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      expect(screen.queryByTestId("dice-error")).not.toBeInTheDocument();
    });
  });

  describe("a slow answer", () => {
    it("gives the button back at the timeout but still shows a late result", () => {
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByRole("button", { name: /roll dice/i })).not.toBeDisabled();

      // The answer finally arrives. The request was never abandoned.
      rerender(
        <MobileDiceRoller
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("late", 11)}
          onClose={mockOnClose}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("roll-result-total").textContent).toBe("11");
    });

    it("shows the NEWEST answer, not a stale one, when both land", () => {
      // roll #1 times out, the player rolls again, then #1's answer arrives
      // followed by #2's. Capturing the roll that woke the effect would show
      // #1's numbers as #2's result and throw #2's away.
      const { rerender } = render(
        <MobileDiceRoller onRoll={mockOnRoll} latestOwnRoll={null} onClose={mockOnClose} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      rerender(
        <MobileDiceRoller
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("first", 2)}
          onClose={mockOnClose}
        />,
      );
      rerender(
        <MobileDiceRoller
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("second", 18)}
          onClose={mockOnClose}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("roll-result-total").textContent).toBe("18");
    });
  });
});
