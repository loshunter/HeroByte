// A die or modifier chip's remove badge was a bare "×": with several chips on screen a screen
// reader said "times, button" for each (found in the U10c review).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiceToken } from "../DiceToken";

afterEach(cleanup);

describe("DiceToken remove badge names the chip it removes", () => {
  it("names a die chip by its count and die", () => {
    render(<DiceToken token={{ id: "t1", kind: "die", die: "d20", qty: 2 }} onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove 2d20" })).toBeInTheDocument();
  });

  it("names a modifier chip by its signed value", () => {
    const { rerender } = render(
      <DiceToken token={{ id: "t2", kind: "mod", value: 3 }} onRemove={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Remove modifier +3" })).toBeInTheDocument();
    rerender(<DiceToken token={{ id: "t2", kind: "mod", value: -2 }} onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove modifier -2" })).toBeInTheDocument();
  });
});
