// The initiative dialog is ONE character's. The page behind an open dialog
// stayed focusable, so another card's INIT could be reached (Tab, then Space)
// and the SAME dialog instance re-rendered for the new character while keeping
// the first one's typed number and dial — its Save then wrote them onto the
// wrong character. A dialog for another character must start fresh.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import { DM_UID, entitiesPanelProps, npc, seat, showCards } from "./entitiesPanel.fixtures";

afterEach(cleanup);

const openInitiative = (name: string) => {
  const card = screen.getByText(name).closest(".player-card") as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: "Set Initiative" }));
};

describe("EntitiesPanel — switching the dialog to another character", () => {
  it("starts fresh: no hand entry carried over from the first character", () => {
    const props = entitiesPanelProps({
      players: [seat(DM_UID, "The DM", { isDM: true })],
      characters: [npc("npc-ogre", "Ogre"), npc("npc-rat", "Rat")],
      uid: DM_UID,
      currentIsDM: true,
    });
    render(<EntitiesPanel {...props} />);
    showCards();

    openInitiative("Ogre");
    fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "12" } });

    openInitiative("Rat");

    expect(screen.getByText("Initiative: Rat")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
