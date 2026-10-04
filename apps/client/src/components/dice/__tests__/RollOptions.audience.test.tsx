// The roll audience line (U10b): said once, not twice, and announced. The pressed audience
// button no longer repeats the line as a desktop tooltip (the unpressed ones keep theirs:
// they say what pressing them will do), the line is a status so a change of audience is
// announced, and the pressed button is described by it.
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RollOptions } from "../RollOptions";

afterEach(() => cleanup());

const options = (visibility: "public" | "dm" | "self", compact = false) =>
  render(
    <RollOptions
      mode="normal"
      onModeChange={vi.fn()}
      visibility={visibility}
      onVisibilityChange={vi.fn()}
      compact={compact}
    />,
  );

const audience = () => screen.getByRole("group", { name: "Who sees this roll" });

it("desktop: the pressed audience button has no tooltip; the others keep theirs", () => {
  options("dm");
  const buttons = Array.from(audience().querySelectorAll("button"));
  const pressed = buttons.filter((b) => b.getAttribute("aria-pressed") === "true");
  expect(pressed).toHaveLength(1);
  expect(pressed[0]).not.toHaveAttribute("title");
  for (const other of buttons.filter((b) => b !== pressed[0])) {
    expect(other.getAttribute("title")).toMatch(/\S/);
  }
});

it("phone: no audience button carries a tooltip at all", () => {
  options("dm", true);
  for (const button of Array.from(audience().querySelectorAll("button"))) {
    expect(button).not.toHaveAttribute("title");
  }
});

it.each([false, true])(
  "the line is a status and the pressed button is described by it (compact: %s)",
  (compact) => {
    options("self", compact);
    const line = screen.getByTestId("roll-audience");
    expect(line).toHaveAttribute("role", "status");
    const pressed = Array.from(audience().querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-pressed") === "true",
    )!;
    expect(pressed).toHaveAttribute("aria-describedby", line.id);
    expect(line.id).not.toBe("");
    const unpressed = Array.from(audience().querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-pressed") === "false",
    )!;
    expect(unpressed).not.toHaveAttribute("aria-describedby");
  },
);
