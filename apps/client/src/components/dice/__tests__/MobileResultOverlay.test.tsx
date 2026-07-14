/**
 * Component tests for MobileResultOverlay
 *
 * Purpose: centered, tap-to-dismiss roll result card for touch devices.
 *
 * Source: apps/client/src/components/dice/MobileResultOverlay.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileResultOverlay } from "../MobileResultOverlay";
import type { RollResult } from "../types";

function createResult(): RollResult {
  return {
    id: "result-1",
    tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
    perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
    total: 15,
    timestamp: 0,
  };
}

describe("MobileResultOverlay", () => {
  it("should render nothing when result is null", () => {
    const { container } = render(<MobileResultOverlay result={null} onClose={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it("should render the total when a result is provided", () => {
    render(<MobileResultOverlay result={createResult()} onClose={vi.fn()} />);

    expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
    expect(screen.getByTestId("roll-result-total").textContent).toBe("15");
  });

  it("should call onClose when the close button is tapped", () => {
    const onClose = vi.fn();
    render(<MobileResultOverlay result={createResult()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when the backdrop is tapped", () => {
    const onClose = vi.fn();
    render(<MobileResultOverlay result={createResult()} onClose={onClose} />);

    const backdrop = screen.getByTestId("mobile-roll-result");
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not close when tapping inside the card", () => {
    const onClose = vi.fn();
    render(<MobileResultOverlay result={createResult()} onClose={onClose} />);

    const total = screen.getByTestId("roll-result-total");
    fireEvent.pointerDown(total);
    fireEvent.click(total);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not close when a press starts on the card and the click retargets to the backdrop", () => {
    // Drag-selecting breakdown text and releasing over the backdrop fires a
    // click whose target is the backdrop; the press-origin guard must block it.
    const onClose = vi.fn();
    render(<MobileResultOverlay result={createResult()} onClose={onClose} />);

    fireEvent.pointerDown(screen.getByTestId("roll-result-total"));
    fireEvent.click(screen.getByTestId("mobile-roll-result"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
