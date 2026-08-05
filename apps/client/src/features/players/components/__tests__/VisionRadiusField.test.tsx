// The one control a DM uses to make a dungeon dark. It holds a local draft so a
// half-typed number does not broadcast, which is exactly the kind of state that
// goes wrong quietly — so these pin the edges: 0 versus undefined (both falsy,
// meaning opposite things), a value that is not a preset, and a second DM
// changing the same token while this one has it open.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisionRadiusField } from "../VisionRadiusField";

function field(value?: number) {
  const onChange = vi.fn();
  const view = render(<VisionRadiusField value={value} onChange={onChange} />);
  return { onChange, view };
}

function input() {
  return screen.getByLabelText("Sight radius in feet");
}

function preset(name: string) {
  return screen.getByRole("button", { name });
}

describe("VisionRadiusField presets", () => {
  it("sends null for Unlimited and a number for each other preset", () => {
    const { onChange } = field(undefined);

    fireEvent.click(preset("60 ft"));
    expect(onChange).toHaveBeenLastCalledWith(60);

    fireEvent.click(preset("Blind"));
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.click(preset("Unlimited"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  // 0 and undefined are both falsy and mean opposite things — blind, and
  // unlimited. A naive truthiness check would light the wrong chip.
  it("marks Unlimited active only when the value is unset", () => {
    field(undefined);
    expect(preset("Unlimited")).toHaveAttribute("aria-pressed", "true");
    expect(preset("Blind")).toHaveAttribute("aria-pressed", "false");
  });

  it("marks Blind active for zero, and NOT Unlimited", () => {
    field(0);
    expect(preset("Blind")).toHaveAttribute("aria-pressed", "true");
    expect(preset("Unlimited")).toHaveAttribute("aria-pressed", "false");
  });

  it("marks the matching preset active", () => {
    field(60);
    expect(preset("60 ft")).toHaveAttribute("aria-pressed", "true");
    expect(preset("30 ft")).toHaveAttribute("aria-pressed", "false");
  });

  it("marks nothing active for a value that is not a preset", () => {
    field(15);
    for (const name of ["Unlimited", "30 ft", "60 ft", "120 ft", "Blind"]) {
      expect(preset(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(input()).toHaveValue(15);
  });
});

describe("VisionRadiusField custom value", () => {
  it("does not broadcast a half-typed number", () => {
    const { onChange } = field(undefined);

    fireEvent.change(input(), { target: { value: "6" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(6);
  });

  it("commits on blur", () => {
    const { onChange } = field(undefined);

    fireEvent.change(input(), { target: { value: "45" } });
    fireEvent.blur(input());

    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("commits on Enter", () => {
    const { onChange } = field(undefined);

    fireEvent.change(input(), { target: { value: "45" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("treats an emptied field as Unlimited", () => {
    const { onChange } = field(60);

    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Every send re-filters a room snapshot for every client and rewrites the
  // state file — TokenService reports success whenever the token exists, not
  // when the value moved — so tapping into the box and out again must be free.
  it("stays silent when a blur changed nothing", () => {
    const { onChange } = field(60);

    fireEvent.blur(input());

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays silent when the field is retyped to the value it already had", () => {
    const { onChange } = field(60);

    fireEvent.change(input(), { target: { value: "60" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays silent when an already-unlimited field is blurred empty", () => {
    const { onChange } = field(undefined);

    fireEvent.blur(input());

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps a value beyond the range rather than sending it to the geometry", () => {
    const { onChange } = field(undefined);

    fireEvent.change(input(), { target: { value: "-40" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.change(input(), { target: { value: "999999" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(1000);
  });

  // A number input REJECTS letters outright — the browser leaves the field
  // empty rather than holding the text — so "sixty" arrives here as "", and an
  // empty field means Unlimited. That is what the DM sees, so it is what it
  // does. (`commit` still guards non-finite input; with type="number" that
  // branch is unreachable, and it is cheap insurance if the input ever changes.)
  it("treats unparseable text as an emptied field, i.e. Unlimited", () => {
    const { onChange } = field(60);

    fireEvent.change(input(), { target: { value: "sixty" } });
    expect(input()).toHaveValue(null);

    fireEvent.blur(input());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Two DMs, one token. The draft must follow the authoritative value rather
  // than pinning whatever this DM last saw.
  it("re-syncs when the value changes underneath it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VisionRadiusField value={30} onChange={onChange} />);
    expect(input()).toHaveValue(30);

    rerender(<VisionRadiusField value={120} onChange={onChange} />);

    expect(input()).toHaveValue(120);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an empty field, not a zero, when sight is unlimited", () => {
    field(undefined);
    expect(input()).toHaveValue(null);
    expect(input()).toHaveAttribute("placeholder", "Unlimited");
  });
});
