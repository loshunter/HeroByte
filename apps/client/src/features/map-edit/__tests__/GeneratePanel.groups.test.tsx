// The desktop Generate panel's two choice rows are NAMED groups with a visible label, as
// the phone's Theme and Density rows already are (U10b), and every choice says whether it
// is the pressed one (Stone and Wood used to look pressed only to the eye).
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { GeneratePanel } from "../GeneratePanel";

afterEach(() => cleanup());

const panel = (theme: "stone" | "wood" = "stone") =>
  render(
    <GeneratePanel
      params={{ theme, density: "medium", seed: "abc" } as never}
      onChange={vi.fn()}
      onRerollSeed={vi.fn()}
      onGenerate={vi.fn()}
      canGenerate
      busy={false}
      region={null}
      hint={null}
    />,
  );

it("names the theme and density rows as groups with a visible label", () => {
  panel();
  const theme = screen.getByRole("group", { name: "Theme" });
  const density = screen.getByRole("group", { name: "Density" });
  expect(screen.getByText("Theme")).toBeVisible();
  expect(screen.getByText("Density")).toBeVisible();
  expect(within(theme).getAllByRole("button")).toHaveLength(2);
  expect(within(density).getAllByRole("button")).toHaveLength(3);
});

it("says which theme is pressed", () => {
  panel("wood");
  const theme = screen.getByRole("group", { name: "Theme" });
  expect(within(theme).getByRole("button", { name: /Wood/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(within(theme).getByRole("button", { name: /Stone/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
