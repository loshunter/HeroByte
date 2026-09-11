// The DM's controls over a character's movement budget: the speed (commits on blur
// or Enter, clamps to the shared bounds, and never sends an unchanged or
// unparseable value — the vision-radius field's discipline) and, with a
// `budget`, the spend's readout and its Reset (F2).

import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MOVEMENT_SPEED_MAX_FEET } from "@herobyte/shared";
import { MovementSpeedField, OVERSPENT_COLOR, clampSpeed } from "../MovementSpeedField";

function field(value?: number, compact = false) {
  const onChange = vi.fn();
  render(<MovementSpeedField value={value} onChange={onChange} compact={compact} />);
  return { onChange, input: screen.getByLabelText("Movement speed in feet per turn") };
}

describe("MovementSpeedField", () => {
  it("shows the value, and an unset character reads as the default", () => {
    expect(field(25).input).toHaveValue(25);
    cleanup();
    expect(field(undefined).input).toHaveAttribute("placeholder", "Default — 30 ft");
  });

  it("commits on blur and on Enter, only when the number changed", () => {
    const { onChange, input } = field(30);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(25);

    // Enter commits by blurring the field itself.
    input.focus();
    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(40);
    expect(onChange).toHaveBeenCalledTimes(2);

    // The prop is still 30 here, so the same 40 is unchanged only once the
    // parent catches up; what must NOT re-send is the value the parent holds.
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clamps to the shared bounds and drops an unparseable entry", () => {
    const { onChange, input } = field(30);
    fireEvent.change(input, { target: { value: "5000" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(MOVEMENT_SPEED_MAX_FEET);
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(0);
    // An emptied field returns the character to the default — sent as null.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(clampSpeed("abc")).toBeNull();
    // Emptying a field that is ALREADY at the default sends nothing.
    cleanup();
    const unset = field(undefined);
    fireEvent.change(unset.input, { target: { value: "" } });
    fireEvent.blur(unset.input);
    expect(unset.onChange).not.toHaveBeenCalled();
  });

  it("an unparseable entry snaps the field back to the value on file, and sends nothing", () => {
    const onChange = vi.fn();
    render(<MovementSpeedField value={30} onChange={onChange} />);
    const input = screen.getByLabelText("Movement speed in feet per turn") as HTMLInputElement;
    // A number input reports "" for a rejected entry, with `validity.badInput`
    // set — jsdom sanitises to "" without the flag, so the flag is supplied.
    fireEvent.change(input, { target: { value: "abc" } });
    Object.defineProperty(input, "validity", { value: { badInput: true }, configurable: true });
    fireEvent.blur(input);
    expect(input).toHaveValue(30);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("with a budget: the spend reads, Reset is inert at 0 and fires the reset otherwise — outside the label, and not through the input", () => {
    const onReset = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <MovementSpeedField value={30} onChange={onChange} budget={{ used: 0, onReset }} />,
    );
    expect(screen.getByText("Used 0 ft")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Reset movement budget" });
    expect(reset).toBeDisabled();
    rerender(<MovementSpeedField value={30} onChange={onChange} budget={{ used: 15, onReset }} />);
    // One face in both homes: the NPC editor's body font must not shrink it.
    expect(screen.getByText("Used 15 ft")).toHaveStyle({ fontSize: "11px" });
    expect(reset).toBeEnabled();
    // Not inside the <label>: activating the button must not activate the input.
    expect(reset.closest("label")).toBeNull();
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    // (jsdom moves no focus and label activation fires a click, not a change —
    // the structural `closest("label")` above is the one live pin here.)
    // No INLINE 44px floor without `compact` — jsdom loads no stylesheet, so
    // this sees the inline style only; the phone's floor is herobyte.css's
    // coarse-pointer rule, pinned by the mobile e2e.
    expect(reset).not.toHaveStyle({ minHeight: "44px" });
  });

  it("the readout goes red past the speed, as the plate does — and by the default speed when none is set", () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <MovementSpeedField value={30} onChange={vi.fn()} budget={{ used: 30, onReset }} />,
    );
    expect(screen.getByText("Used 30 ft")).toHaveStyle({ color: "var(--jrpg-gold)" });
    rerender(<MovementSpeedField value={30} onChange={vi.fn()} budget={{ used: 35, onReset }} />);
    expect(screen.getByText("Used 35 ft")).toHaveStyle({ color: OVERSPENT_COLOR });
    // No speed on file: the default (30 ft) is the line.
    rerender(<MovementSpeedField onChange={vi.fn()} budget={{ used: 35, onReset }} />);
    expect(screen.getByText("Used 35 ft")).toHaveStyle({ color: OVERSPENT_COLOR });
    rerender(<MovementSpeedField onChange={vi.fn()} budget={{ used: 30, onReset }} />);
    expect(screen.getByText("Used 30 ft")).toHaveStyle({ color: "var(--jrpg-gold)" });
  });

  it("without a budget there is no reset — a player's own field carries none", () => {
    field(30);
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("compact puts the reset on the 44px floor too", () => {
    render(
      <MovementSpeedField
        value={30}
        onChange={vi.fn()}
        budget={{ used: 5, onReset: vi.fn() }}
        compact
      />,
    );
    expect(screen.getByRole("button", { name: "Reset movement budget" })).toHaveStyle({
      minHeight: "44px",
    });
  });

  it("compact puts the input on the 44px floor", () => {
    expect(field(30, true).input).toHaveStyle({ minHeight: "44px" });
    cleanup();
    expect(field(30, false).input).not.toHaveStyle({ minHeight: "44px" });
  });

  it("follows a value changed elsewhere — another DM, or the server", () => {
    const onChange = vi.fn();
    const view = render(<MovementSpeedField value={30} onChange={onChange} />);
    view.rerender(<MovementSpeedField value={45} onChange={onChange} />);
    expect(screen.getByLabelText("Movement speed in feet per turn")).toHaveValue(45);
  });
});
