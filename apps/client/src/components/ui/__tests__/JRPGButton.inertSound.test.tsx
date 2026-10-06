// A button the lock stops (lockGuard: aria-disabled, still clickable so it can
// say why) must not play the click blip — that sounded like it had worked.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const play = vi.fn();
vi.mock("../../../features/juice/useSfx", () => ({ useSfx: () => ({ play }) }));

import { JRPGButton } from "../JRPGPanel";

describe("JRPGButton and an inert (aria-disabled) press", () => {
  it("runs the press but plays no blip", () => {
    const onClick = vi.fn();
    render(
      <JRPGButton aria-disabled onClick={onClick}>
        Delete
      </JRPGButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
  });

  it("control: a live button blips", () => {
    play.mockClear();
    render(<JRPGButton onClick={vi.fn()}>Go</JRPGButton>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(play).toHaveBeenCalledWith("buttonBlip");
  });
});
