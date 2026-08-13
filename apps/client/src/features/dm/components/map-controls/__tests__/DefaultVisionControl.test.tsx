import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DefaultVisionControl } from "../DefaultVisionControl";

function renderControl(overrides: Partial<Parameters<typeof DefaultVisionControl>[0]> = {}) {
  const onDefaultVisionRadiusChange = vi.fn();
  render(
    <DefaultVisionControl
      defaultVisionRadius={undefined}
      onDefaultVisionRadiusChange={onDefaultVisionRadiusChange}
      fogEnabled
      {...overrides}
    />,
  );
  return { onDefaultVisionRadiusChange };
}

describe("DefaultVisionControl", () => {
  // The field is shared with the per-token control, so the copy has to say
  // which one this is — "This token sees 60 feet" would be a lie here.
  it("names the TABLE as the subject, not a token", () => {
    renderControl();

    expect(screen.getByText("Default Sight Radius")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "60 ft" })).toHaveAttribute(
      "title",
      "A token with no radius of its own sees 60 feet",
    );
  });

  // Two of these can share a screen with the entities panel's per-token field;
  // an accessible name they both answered to would make either locator
  // ambiguous, which is how an e2e starts failing for the wrong reason.
  it("gives its input an accessible name distinct from the per-token field", () => {
    renderControl();

    expect(screen.getByLabelText("Default sight radius in feet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });

  it("shows the current default as the active preset", () => {
    renderControl({ defaultVisionRadius: 60 });

    expect(screen.getByRole("button", { name: "60 ft" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("treats no default as Unlimited rather than as blind", () => {
    renderControl();

    expect(screen.getByRole("button", { name: "Unlimited" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Blind" })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends a radius when a preset is pressed", () => {
    const { onDefaultVisionRadiusChange } = renderControl();

    fireEvent.click(screen.getByRole("button", { name: "60 ft" }));
    expect(onDefaultVisionRadiusChange).toHaveBeenCalledWith(60);
  });

  // 0 is a real table setting, and the one most at risk of being swallowed by
  // a truthiness check somewhere between here and the room state.
  it("sends 0 for Blind rather than clearing the default", () => {
    const { onDefaultVisionRadiusChange } = renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Blind" }));
    expect(onDefaultVisionRadiusChange).toHaveBeenCalledWith(0);
  });

  it("sends null to clear the default", () => {
    const { onDefaultVisionRadiusChange } = renderControl({ defaultVisionRadius: 60 });

    fireEvent.click(screen.getByRole("button", { name: "Unlimited" }));
    expect(onDefaultVisionRadiusChange).toHaveBeenCalledWith(null);
  });

  it("explains that the setting is inert while fog is off", () => {
    renderControl({ fogEnabled: false });

    expect(screen.getByText(/Turn fog on/i)).toBeInTheDocument();
  });
});
