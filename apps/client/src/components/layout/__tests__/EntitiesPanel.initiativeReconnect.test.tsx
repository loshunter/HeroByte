// A reconnect is not a deletion. ANY socket close nulls the snapshot while the
// app stays mounted behind "Reconnecting…", so for the blip the Party reads no
// seats, no characters and not-DM. The dialog took that for its character
// being gone (or its permission lost) and closed for good: the typed value was
// lost, and a save in flight vanished with neither its confirm nor its failure.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import { RoleKnownContext } from "../../../features/table/roleKnown";
import {
  ALICE_UID,
  DM_UID,
  entitiesPanelProps,
  npc,
  pc,
  seat,
  showCards,
  type EntitiesPanelTestProps,
} from "./entitiesPanel.fixtures";

afterEach(cleanup);

const hero = pc("pc-hero", "Hero", ALICE_UID);
const ogre = npc("npc-ogre", "Ogre");
const seats = [seat(DM_UID, "The DM", { isDM: true }), seat(ALICE_UID, "Alice")];
// What the Party receives while the socket is down: the layout's `?? []`.
const offline = { players: [], characters: [], currentIsDM: false };

function renderPanel(props: EntitiesPanelTestProps) {
  const view = render(<EntitiesPanel {...props} />);
  showCards();
  return (next: Partial<EntitiesPanelTestProps>) =>
    view.rerender(<EntitiesPanel {...props} {...next} />);
}

function typeByHand(name: string, value: string) {
  const card = screen.getByText(name).closest(".player-card") as HTMLElement;
  fireEvent.click(within(card).getByRole("button", { name: "Set Initiative" }));
  fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
  fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value } });
}

describe("EntitiesPanel — the initiative dialog through a reconnect", () => {
  it("a player's dialog stays open with what was typed, and is still theirs after", () => {
    const update = renderPanel(
      entitiesPanelProps({ players: seats, characters: [hero], uid: ALICE_UID }),
    );
    typeByHand("Hero", "14");

    update(offline);
    expect(screen.getByText("Initiative: Hero")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter roll...")).toHaveValue(14);

    update({ players: seats, characters: [hero], currentIsDM: false });
    expect(screen.getByText("Initiative: Hero")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter roll...")).toHaveValue(14);
  });

  it("a DM's dialog on an NPC is not closed by the blip's not-DM", () => {
    const update = renderPanel(
      entitiesPanelProps({ players: seats, characters: [ogre], uid: DM_UID, currentIsDM: true }),
    );
    typeByHand("Ogre", "9");

    update(offline);
    update({ players: seats, characters: [ogre], currentIsDM: true });

    expect(screen.getByText("Initiative: Ogre")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter roll...")).toHaveValue(9);
  });

  it("a save in flight when the socket drops reports its failure in the dialog", () => {
    const update = renderPanel(
      entitiesPanelProps({ players: seats, characters: [hero], uid: ALICE_UID }),
    );
    typeByHand("Hero", "14");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    update({ isSettingInitiative: true });

    update({ ...offline, isSettingInitiative: true });
    update({
      ...offline,
      isSettingInitiative: false,
      initiativeError: "Initiative update timed out. Please try again.",
    });

    expect(screen.getByText("Initiative: Hero")).toBeTruthy();
    expect(screen.getByText(/timed out/)).toBeTruthy();
  });

  it("once the snapshot is back, a character deleted meanwhile closes its dialog", () => {
    const update = renderPanel(
      entitiesPanelProps({ players: seats, characters: [ogre], uid: DM_UID, currentIsDM: true }),
    );
    typeByHand("Ogre", "9");

    update(offline);
    update({ players: seats, characters: [], currentIsDM: true });

    expect(screen.queryByText("Initiative: Ogre")).toBeNull();
  });

  it("once the snapshot is back, a player who lost the right to it sees it close", () => {
    const update = renderPanel(
      entitiesPanelProps({ players: seats, characters: [hero], uid: ALICE_UID }),
    );
    typeByHand("Hero", "14");

    update(offline);
    // The DM moved Hero to another seat while Alice was away.
    update({ players: seats, characters: [{ ...hero, ownedByPlayerUID: DM_UID }] });

    expect(screen.queryByText("Initiative: Hero")).toBeNull();
  });

  // The DM's layout keeps the CACHED roster through the blip (App's layoutSnapshot),
  // so the seats are there while the DM flag reads false: only the role says "blip".
  it("a DM's dialog on an NPC survives a blip that keeps the cached roster", () => {
    const props = entitiesPanelProps({
      players: seats,
      characters: [ogre],
      uid: DM_UID,
      currentIsDM: true,
    });
    const view = (known: boolean, currentIsDM: boolean) => (
      <RoleKnownContext.Provider value={known}>
        <EntitiesPanel {...props} currentIsDM={currentIsDM} />
      </RoleKnownContext.Provider>
    );
    const { rerender } = render(view(true, true));
    showCards();
    typeByHand("Ogre", "9");

    rerender(view(false, false));
    expect(screen.getByText("Initiative: Ogre")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter roll...")).toHaveValue(9);

    rerender(view(true, false));
    expect(screen.queryByText("Initiative: Ogre")).toBeNull();
  });
});
