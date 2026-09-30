// Encounter (U8): each control sends the message the old tabs sent, the
// participant rows are shortcuts into the ONE initiative state, and the two
// server rules it names — auto-start on the first initiative, start-combat
// mid-fight — are said before the press.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EncounterTab } from "../EncounterTab";
import type { EncounterControls } from "../encounterControls";
import { ALICE_UID, DM_UID, encounterControls, npc, pc, seat } from "./encounterFixtures";

vi.mock("../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const players = [seat(DM_UID, "The DM", true), seat(ALICE_UID, "Alice")];

function renderTab(overrides: Partial<EncounterControls> = {}) {
  const controls = encounterControls({ players, ...overrides });
  const onOpenTab = vi.fn();
  const toast = { success: vi.fn(), error: vi.fn() };
  const view = render(
    <EncounterTab controls={controls} isDM={true} onOpenTab={onOpenTab} toast={toast} />,
  );
  return { controls, onOpenTab, toast, view };
}

const rowOf = (name: string) =>
  screen.getByText(name, { selector: ".encounter-row__name" }).closest("li") as HTMLElement;

describe("EncounterTab — the three parts", () => {
  it("has Setup, Initiative and Run encounter, in that order", () => {
    renderTab();
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(["Setup", "Initiative", "Run encounter"]);
  });

  it("+ Add NPCs… forwards to NPCs & Monsters, and the hand-entry policy links to Session", () => {
    const { onOpenTab } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "+ Add NPCs…" }));
    expect(onOpenTab).toHaveBeenLastCalledWith("npcs");
    fireEvent.click(screen.getByRole("button", { name: "Change in Session" }));
    expect(onOpenTab).toHaveBeenLastCalledWith("session");
  });

  it("says what the hand-entry policy is, both ways", () => {
    renderTab({ playersMayEnterByHand: false });
    expect(screen.getByText(/Players may not enter a roll by hand/)).toBeTruthy();
    cleanup();
    renderTab({ playersMayEnterByHand: true });
    expect(screen.getByText(/Players may enter a roll by hand/)).toBeTruthy();
  });
});

describe("EncounterTab — Monster HP (moved from Players)", () => {
  it("each button dispatches its real mode string", () => {
    const { controls } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Bloodied" }));
    expect(controls.onMonsterHpDisplayChange).toHaveBeenLastCalledWith("bloodied");
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    expect(controls.onMonsterHpDisplayChange).toHaveBeenLastCalledWith("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Exact" }));
    expect(controls.onMonsterHpDisplayChange).toHaveBeenLastCalledWith("exact");
  });

  it("marks the current mode from the snapshot-fed value", () => {
    renderTab({ monsterHpDisplay: "bloodied" });
    expect(screen.getByRole("button", { name: "Bloodied" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Exact" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Bloodied" })).toHaveClass("jrpg-button-primary");
    expect(screen.getByRole("button", { name: "Exact" })).not.toHaveClass("jrpg-button-primary");
  });
});

describe("EncounterTab — Initiative", () => {
  it("Roll missing NPC initiative sends ONE bulk roll and names how many it asked for", () => {
    const { controls, toast } = renderTab({
      characters: [
        npc("gob-1", "Goblin 1"),
        npc("gob-2", "Goblin 2"),
        npc("ogre", "Ogre", { initiative: 11 }),
      ],
    });
    expect(screen.getByText(/Rolls now for the 2 NPCs without one; nobody else/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Roll missing NPC initiative/ }));

    expect(controls.initiative.rollAllInitiative).toHaveBeenCalledTimes(1);
    expect(controls.initiative.rollInitiative).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Rolled initiative for 2 NPCs");
  });

  it("is disabled, with its reason, when every NPC already has one", () => {
    const { controls } = renderTab({ characters: [npc("ogre", "Ogre", { initiative: 11 })] });
    const button = screen.getByRole("button", { name: /Roll missing NPC initiative/ });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Every NPC has an initiative/)).toBeTruthy();
    fireEvent.click(button);
    expect(controls.initiative.rollAllInitiative).not.toHaveBeenCalled();
  });

  it("with no NPCs at all, says so rather than claiming every NPC has one", () => {
    renderTab({ characters: [pc("alice", "Alice PC", ALICE_UID)] });
    expect(screen.getByText(/There are no NPCs yet/)).toBeTruthy();
    expect(screen.queryByText(/Every NPC has an initiative/)).toBeNull();
    expect(screen.getByRole("button", { name: /Roll missing NPC initiative/ })).toBeDisabled();
  });

  it("Clear all initiative sends clear-all (moved from Players)", () => {
    const { controls } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Clear all initiative/ }));
    expect(controls.onClearAllInitiative).toHaveBeenCalledTimes(1);
  });
});

describe("EncounterTab — the participant list", () => {
  const characters = [
    npc("gob", "Goblin", { tokenId: "t-gob" }),
    pc("alice", "Alice PC", ALICE_UID, { initiative: 14, tokenId: "t-alice" }),
    npc("ambush", "Assassin", { initiative: 9, visibleToPlayers: false }),
  ];

  it("lists the order and who has not rolled, with a hidden NPC tagged", () => {
    renderTab({ characters });
    const order = screen.getByRole("list", { name: "In the order" });
    expect(
      within(order)
        .getAllByRole("listitem")
        .map((li) => li.dataset.characterId),
    ).toEqual(["alice", "ambush"]);
    const waiting = screen.getByRole("list", { name: "Not rolled yet" });
    expect(
      within(waiting)
        .getAllByRole("listitem")
        .map((li) => li.dataset.characterId),
    ).toEqual(["gob"]);
    expect(within(rowOf("Assassin")).getByText("hidden")).toBeTruthy();
    expect(within(rowOf("Alice PC")).getByText("Player · Alice")).toBeTruthy();
  });

  it("an unrolled row rolls d20 now with the stored modifier; a rolled row leaves the order", () => {
    const { controls } = renderTab({ characters });
    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now for Goblin" }));
    expect(controls.initiative.rollInitiative).toHaveBeenCalledWith("gob");

    fireEvent.click(screen.getByRole("button", { name: "Remove Alice PC from the order" }));
    expect(controls.initiative.clearInitiative).toHaveBeenCalledWith("alice");
    // Only a rolled row can leave the order.
    expect(screen.queryByRole("button", { name: "Remove Goblin from the order" })).toBeNull();
  });

  it("Focus shows only for a token on this map, and centres THAT token", () => {
    const { controls } = renderTab({ characters, mapTokenIds: new Set(["t-gob"]) });
    expect(screen.queryByRole("button", { name: "Focus Alice PC" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus Goblin" }));
    expect(controls.onFocusToken).toHaveBeenCalledWith("t-gob");
  });

  it("Set… opens the shared initiative dialog; its Save goes through the ONE initiative instance", () => {
    const withModifier = characters.map((c) =>
      c.id === "gob" ? { ...c, initiativeModifier: 2 } : c,
    );
    const { controls } = renderTab({ characters: withModifier, combatActive: true });
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Goblin" }));
    expect(screen.getByText("Initiative: Goblin")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Raise the modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter a roll by hand" }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));

    expect(controls.initiative.setInitiative).toHaveBeenCalledTimes(1);
    expect(controls.initiative.setInitiative).toHaveBeenCalledWith("gob", 16, 3);
  });

  it("the dialog shows the layout's pending state and failure for ITS save, and closes on the confirm", () => {
    const controls = encounterControls({ players, characters, combatActive: true });
    const tab = (initiative: Partial<EncounterControls["initiative"]>) => (
      <EncounterTab
        controls={{ ...controls, initiative: { ...controls.initiative, ...initiative } }}
        isDM={true}
        onOpenTab={vi.fn()}
      />
    );
    const view = render(tab({}));
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Goblin" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter a roll by hand" }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));

    view.rerender(tab({ isSetting: true }));
    expect(screen.getByRole("button", { name: "Setting..." })).toBeDisabled();
    view.rerender(
      tab({ isSetting: false, error: "Initiative update timed out. Please try again." }),
    );
    expect(screen.getByText(/timed out/)).toBeTruthy();
    expect(screen.getByText("Initiative: Goblin")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));
    view.rerender(tab({ isSetting: true, error: null }));
    view.rerender(tab({ isSetting: false, error: null }));
    expect(screen.queryByText("Initiative: Goblin")).toBeNull();
  });

  it("the DM keeps hand entry in that dialog even where players may not type a roll", () => {
    renderTab({ characters, playersMayEnterByHand: false });
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Goblin" }));
    expect(screen.getByRole("button", { name: "Enter a roll by hand" })).toBeTruthy();
    expect(screen.queryByText(/Entering a roll by hand is off/)).toBeNull();
  });

  it("a rolled row's Init button opens the same dialog for that character", () => {
    renderTab({ characters });
    fireEvent.click(screen.getByRole("button", { name: "Initiative 14: set for Alice PC" }));
    expect(screen.getByText("Initiative: Alice PC")).toBeTruthy();
  });
});

describe("EncounterTab — Run encounter", () => {
  const ordered = [
    npc("gob", "Goblin", { initiative: 3 }),
    npc("ogre", "Ogre", { initiative: 19 }),
  ];

  it("with no fight: Start combat, naming who takes the first turn and the auto-start rule", () => {
    const { controls } = renderTab({ characters: ordered });
    expect(screen.getByText(/The turn goes to the top of the order: Ogre/)).toBeTruthy();
    expect(
      screen.getByText(/any initiative saved while no fight is running starts one/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /End combat/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start combat/ }));
    expect(controls.onStartCombat).toHaveBeenCalledTimes(1);
  });

  it("in a fight: whose turn, prev/next, end — and Start at top sends start-combat", () => {
    const { controls } = renderTab({
      characters: ordered,
      combatActive: true,
      currentTurnCharacterId: "ogre",
    });
    expect(screen.getByRole("status").textContent).toContain("Turn 1 of 2: Ogre");
    expect(screen.queryByText(/is at the top of the order/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next turn" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous turn" }));
    expect(controls.onNextTurn).toHaveBeenCalledTimes(1);
    expect(controls.onPreviousTurn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Start at top of order/ }));
    expect(controls.onStartCombat).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        /Moves the turn to Ogre, starts the round over and refills everyone's movement/,
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /End combat/ }));
    expect(controls.onEndCombat).toHaveBeenCalledTimes(1);
  });

  it("says when the turn sits below the top of the order, and how a fight can start there", () => {
    renderTab({ characters: ordered, combatActive: true, currentTurnCharacterId: "gob" });
    expect(screen.getByRole("status").textContent).toContain("Turn 2 of 2: Goblin");
    expect(
      screen.getByText(
        "It is Goblin's turn; Ogre is at the top of the order. A fight started by saving an initiative begins on that character's turn, not at the top.",
      ),
    ).toBeTruthy();
  });

  it("says so when nobody holds the turn", () => {
    renderTab({ characters: ordered, combatActive: true, currentTurnCharacterId: undefined });
    expect(screen.getByRole("status").textContent).toContain("nobody holds the turn");
  });

  it("with a fight on and nobody in the order: says so, and offers no Start at top", () => {
    renderTab({ characters: [npc("gob", "Goblin")], combatActive: true });
    expect(screen.getByRole("status").textContent).toContain("nobody is in the order yet");
    expect(screen.queryByRole("button", { name: /Start at top/ })).toBeNull();
  });
});

describe("EncounterTab — the dialog's auto-start note follows the fight", () => {
  it.each([
    [false, true],
    [true, false],
  ])("combat on: %s — Set…'s dialog names the auto-start: %s", (combatActive, named) => {
    renderTab({ characters: [npc("gob", "Goblin")], combatActive });
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Goblin" }));
    expect(
      screen.queryByText(
        "No fight is running: saving an initiative starts combat, on Goblin's turn.",
      ) !== null,
    ).toBe(named);
  });
});
