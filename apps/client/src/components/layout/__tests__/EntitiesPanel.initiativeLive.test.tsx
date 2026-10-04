// The initiative dialog is about ONE character, and it must follow that
// character's record rather than hold the copy it was opened with. It held the
// copy: a character deleted (or renamed) while its dialog was open kept a
// dialog whose Save sent a `set-initiative` for an id the server no longer has
// — the server answers nothing, so the press waited five seconds and reported
// a timeout.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import { DM_UID, entitiesPanelProps, npc, seat, showCards } from "./entitiesPanel.fixtures";

const players = [seat(DM_UID, "The DM", { isDM: true })];

afterEach(cleanup);

function renderWith(characters: ReturnType<typeof npc>[]) {
  const props = entitiesPanelProps({ players, characters, uid: DM_UID, currentIsDM: true });
  const view = render(<EntitiesPanel {...props} />);
  showCards();
  return (next: ReturnType<typeof npc>[]) =>
    view.rerender(<EntitiesPanel {...props} characters={next} />);
}

const openInitiative = (name: string) => {
  const card = screen.getByText(name).closest(".player-card") as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: "Set Initiative" }));
};

describe("EntitiesPanel — the initiative dialog follows its character", () => {
  it("closes when its character is deleted", () => {
    const ogre = npc("npc-ogre", "Ogre");
    const rerenderWith = renderWith([ogre, npc("npc-rat", "Rat")]);
    openInitiative("Ogre");
    expect(screen.queryByText("Initiative: Ogre")).not.toBeNull();

    rerenderWith([npc("npc-rat", "Rat")]);

    expect(screen.queryByText("Initiative: Ogre")).toBeNull();
  });

  it("names the character as it is now, after a broadcast renames it", () => {
    const rerenderWith = renderWith([npc("npc-ogre", "Ogre")]);
    openInitiative("Ogre");

    rerenderWith([npc("npc-ogre", "Ogre Chief")]);

    expect(screen.queryByText("Initiative: Ogre Chief")).not.toBeNull();
  });
});
