// The Monster HP Display control (S4): the buttons must drive the real
// callback with the real mode strings, and the current mode must read from
// the snapshot-fed prop — the wiring the review flagged as silently droppable.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlayersTab from "../PlayersTab";

vi.mock("../../../../juice", () => ({
  useSfx: () => ({ play: vi.fn() }),
}));

function renderTab(overrides: Partial<React.ComponentProps<typeof PlayersTab>> = {}) {
  const onMonsterHpDisplayChange = vi.fn();
  const utils = render(
    <PlayersTab
      players={[]}
      sceneObjects={[]}
      onSelectPlayerTokens={vi.fn()}
      onMonsterHpDisplayChange={onMonsterHpDisplayChange}
      {...overrides}
    />,
  );
  return { onMonsterHpDisplayChange, ...utils };
}

describe("PlayersTab — Monster HP Display", () => {
  it("each button dispatches its real mode string", () => {
    const { onMonsterHpDisplayChange } = renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Bloodied" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("bloodied");
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Exact" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("exact");
  });

  it("highlights the current mode from the snapshot-fed prop", () => {
    renderTab({ monsterHpDisplay: "bloodied" });
    expect(screen.getByRole("button", { name: "Bloodied" })).toHaveClass("jrpg-button-primary");
    expect(screen.getByRole("button", { name: "Exact" })).not.toHaveClass("jrpg-button-primary");
  });

  it("the whole section is absent without the handler — no dead controls", () => {
    renderTab({ onMonsterHpDisplayChange: undefined });
    expect(screen.queryByText("Monster HP Display")).not.toBeInTheDocument();
  });
});
