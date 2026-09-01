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
      theme: "wood",
      density: "high",
      size: "large",
    });
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
