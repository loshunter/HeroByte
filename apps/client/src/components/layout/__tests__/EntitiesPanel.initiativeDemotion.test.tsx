// A DM who loses DM rights (a deploy, a restart) must not keep a window open
// whose every control the server now refuses. The initiative dialog for a
// monster or another player's character stayed open after demotion, and its
// Set sent a `set-initiative` the server rejects. The owner's own dialog is
// theirs either way.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import {
  ALICE_UID,
  DM_UID,
  entitiesPanelProps,
  npc,
  pc,
  seat,
  type EntitiesPanelTestProps,
  showCards,
} from "./entitiesPanel.fixtures";

const players = [seat(DM_UID, "The DM", { isDM: true }), seat(ALICE_UID, "Alice")];
const characters = [pc("char-alice", "Alice", ALICE_UID), npc("npc-ogre", "Ogre")];

afterEach(cleanup);

function renderAs(uid: string, currentIsDM: boolean) {
  const props = entitiesPanelProps({ players, characters, uid, currentIsDM });
  const view = render(<EntitiesPanel {...props} />);
  showCards(); // every card at once: the compact roster hides them
  const rerenderAs = (next: Partial<EntitiesPanelTestProps>) =>
    view.rerender(<EntitiesPanel {...props} {...next} />);
  return { rerenderAs };
}

const openInitiative = (name: string) => {
  const card = screen.getByText(name).closest(".player-card") as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: "Set Initiative" }));
};
const dialog = (name: string) => screen.queryByText(`Initiative: ${name}`);

describe("EntitiesPanel — the initiative dialog after losing DM rights", () => {
  it("a monster's dialog closes, and does not come back on re-elevation", () => {
    const { rerenderAs } = renderAs(DM_UID, true);
    openInitiative("Ogre");
    expect(dialog("Ogre")).not.toBeNull();

    rerenderAs({ currentIsDM: false });
    expect(dialog("Ogre")).toBeNull();

    rerenderAs({ currentIsDM: true });
    expect(dialog("Ogre")).toBeNull();
  });

  it("another player's character's dialog closes too", () => {
    const { rerenderAs } = renderAs(DM_UID, true);
    openInitiative("Alice");
    expect(dialog("Alice")).not.toBeNull();

    rerenderAs({ currentIsDM: false });
    expect(dialog("Alice")).toBeNull();
  });

  it("the owner's own dialog stays open when they give up DM", () => {
    const { rerenderAs } = renderAs(ALICE_UID, true);
    openInitiative("Alice");

    rerenderAs({ currentIsDM: false });
    expect(dialog("Alice")).not.toBeNull();
  });
});
