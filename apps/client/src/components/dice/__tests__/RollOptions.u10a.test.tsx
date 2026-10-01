// U10a — who sees a roll is said in words, and the words match the server's rule.
//
// recipientFilter.visibleRollsFor: a `self` roll reaches only the roller's own
// socket — a DM is NOT a recipient (pinned by diceSecrecy.contract.test.ts) — and
// a `dm` roll reaches the roller and the DM. The ME tooltip used to say the
// opposite ("the DM included"). A phone has no hover, so the audience of the
// chosen option is also printed.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollOptions } from "../RollOptions";

const renderOptions = (visibility: "public" | "dm" | "self", compact = false) =>
  render(
    <RollOptions
      mode="normal"
      onModeChange={vi.fn()}
      visibility={visibility}
      onVisibilityChange={vi.fn()}
      compact={compact}
    />,
  );

describe("RollOptions — who sees this roll", () => {
  it("ME says no other player or DM is sent it, short and without absolutes, and never that the DM is included", () => {
    renderOptions("public");
    const title = screen.getByRole("button", { name: "ME" }).getAttribute("title") ?? "";
    expect(title).toBe("Only you see this roll. No other player or DM is sent it.");
    expect(title).not.toMatch(/included|secure|never/i);
  });

  it("a phone prints the audience once: its buttons carry no tooltip to be read a second time", () => {
    renderOptions("self", true);
    for (const name of ["TABLE", "DM", "ME"]) {
      expect(screen.getByRole("button", { name })).not.toHaveAttribute("title");
    }
  });

  it("DM names the roller and whoever is in DM mode, and TABLE names everyone at the table", () => {
    renderOptions("public");
    expect(screen.getByRole("button", { name: "DM" })).toHaveAttribute(
      "title",
      expect.stringMatching(/you and whoever is in DM mode, now or later/i),
    );
    expect(screen.getByRole("button", { name: "TABLE" })).toHaveAttribute(
      "title",
      expect.stringMatching(/everyone at the table/i),
    );
  });

  it.each([
    ["self", /Only you see this roll\. No other player or DM is sent it\./],
    ["dm", /Only you and whoever is in DM mode, now or later, see this roll\./],
    ["public", /Everyone at the table sees this roll\./],
  ] as const)("prints the audience of the chosen option (%s), on both layouts", (value, text) => {
    for (const compact of [false, true]) {
      const { unmount } = renderOptions(value, compact);
      expect(screen.getByTestId("roll-audience")).toHaveTextContent(text);
      unmount();
    }
  });
});
