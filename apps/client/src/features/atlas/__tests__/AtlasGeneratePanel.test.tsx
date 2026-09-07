import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AtlasActions } from "../useAtlasActions";
import { AtlasGeneratePanel } from "../AtlasGeneratePanel";

function actionsMock(): AtlasActions {
  return {
    createNode: vi.fn(),
    renameNode: vi.fn(),
    setDiscovered: vi.fn(),
    deleteNode: vi.fn(),
    linkMap: vi.fn(),
    generateNode: vi.fn(),
    travel: vi.fn(),
    deleteLink: vi.fn(),
  };
}

describe("AtlasGeneratePanel", () => {
  it("fires generateNode with the chosen params and the shown seed", () => {
    const actions = actionsMock();
    render(<AtlasGeneratePanel nodeId="n1" nodeName="The Docks" actions={actions} />);

    fireEvent.change(screen.getByLabelText("Theme for The Docks"), { target: { value: "wood" } });
    fireEvent.change(screen.getByLabelText("Density for The Docks"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Size for The Docks"), { target: { value: "large" } });
    fireEvent.change(screen.getByLabelText("Seed for The Docks"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "🎲 GENERATE" }));

    expect(actions.generateNode).toHaveBeenCalledWith("n1", 1234567, {
      recipeId: "dungeon",
      theme: "wood",
      density: "high",
      size: "large",
    });
  });

  it("cashes a promise as a BUILDING — the other generate door, and the one nothing covered", () => {
    // K4's Tests list promised "both panels render the picker and send the
    // right shape", and only the KICK panel ever got a building test. This is
    // the Atlas tab's door: the same shared RecipeDials, a different caller.
    const actions = actionsMock();
    render(<AtlasGeneratePanel nodeId="n1" nodeName="The Docks" actions={actions} />);

    fireEvent.change(screen.getByLabelText("Recipe for The Docks"), {
      target: { value: "building" },
    });
    // The dungeon's dials are GONE, not merely ignored — a panel that still
    // showed Theme would be sending a shape the server rejects.
    expect(screen.queryByLabelText("Theme for The Docks")).toBeNull();
    expect(screen.queryByLabelText("Density for The Docks")).toBeNull();

    fireEvent.change(screen.getByLabelText("Kind for The Docks"), {
      target: { value: "warehouse" },
    });
    fireEvent.change(screen.getByLabelText("Size for The Docks"), { target: { value: "medium" } });
    fireEvent.change(screen.getByLabelText("Seed for The Docks"), { target: { value: "77" } });
    fireEvent.click(screen.getByRole("button", { name: "🎲 GENERATE" }));

    expect(actions.generateNode).toHaveBeenCalledWith("n1", 77, {
      recipeId: "building",
      kind: "warehouse",
      size: "medium",
    });
  });

  it("offers a phone a numeric keypad for a digits-only field", () => {
    // The Atlas arc's mobile lens recorded this against THIS panel and the
    // note said K2 would fold it in. K2 built a new panel and left this one
    // untouched, so the gap outlived the fix — and K3's touch sweep now opens
    // this very surface on a phone.
    const actions = actionsMock();
    render(<AtlasGeneratePanel nodeId="n1" nodeName="The Docks" actions={actions} />);
    expect(screen.getByTestId("atlas-generate-seed")).toHaveAttribute("inputmode", "numeric");
  });

  it("reroll mints a different seed", () => {
    const actions = actionsMock();
    render(<AtlasGeneratePanel nodeId="n1" nodeName="The Docks" actions={actions} />);
    const seedInput = screen.getByTestId("atlas-generate-seed") as HTMLInputElement;
    fireEvent.change(seedInput, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "⟳ Reroll" }));
    expect(seedInput.value).not.toBe("42");
  });
});
