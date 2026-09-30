// The desktop card's INIT opens the shared dialog with the table's fight
// state: with no fight running it says that saving starts one, on this
// character's turn; in a fight it says nothing about starting one.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import { DM_UID, entitiesPanelProps, npc, seat, showCards } from "./entitiesPanel.fixtures";

afterEach(cleanup);

describe("EntitiesPanel — the card's dialog and the fight", () => {
  it.each([
    [false, true],
    [true, false],
  ])("combat on: %s — the dialog names the auto-start: %s", (combatActive, named) => {
    render(
      <EntitiesPanel
        {...entitiesPanelProps({
          players: [seat(DM_UID, "The DM", { isDM: true })],
          characters: [npc("npc-ogre", "Ogre")],
          uid: DM_UID,
          currentIsDM: true,
          combatActive,
        })}
      />,
    );
    showCards();
    const card = screen.getByText("Ogre").closest(".player-card") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Set Initiative" }));

    expect(screen.getByText("Initiative: Ogre")).toBeTruthy();
    expect(
      screen.queryByText(
        "No fight is running: saving an initiative starts combat, on Ogre's turn.",
      ) !== null,
    ).toBe(named);
  });
});
