// The desktop party panel's movement-budget reset (F2): the DM viewing a
// PLAYER's card gets the readout and a reset bound to that character; a
// player never does; and the control exists where the plate shows a budget —
// in combat, for a combatant in the order — or wherever there is a spend to
// clear. The DM's own character (F3): in the ACTIVE order (rolled, combat on)
// it is a combatant and renders in the order like anyone else; otherwise —
// unrolled, or rolled after END COMBAT — it sits on the bench (the DM group),
// where the only live arm is the spend clause — the server charges its token
// like any other, and this is the only lever that clears that spend.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";

const DM = "dm-uid";
const ALICE = "alice-uid";

const players = [
  { uid: DM, name: "The DM", isDM: true, hp: 10, maxHp: 10 },
  { uid: ALICE, name: "Alice", isDM: false, hp: 10, maxHp: 10 },
] as unknown as Player[];

const alice = {
  id: "char-alice",
  name: "Alice",
  type: "pc",
  ownedByPlayerUID: ALICE,
  hp: 10,
  maxHp: 10,
  initiative: 12,
  movementUsed: 10,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
  return {
    players,
    characters: [alice],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: DM,
    micEnabled: false,
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    editingTempHpUID: null,
    tempHpInput: "",
    onNameInputChange: vi.fn(),
    onNameEdit: vi.fn(),
    onNameSubmit: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    onToggleMic: vi.fn(),
    onCharacterHpChange: vi.fn(),
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onTempHpInputChange: vi.fn(),
    onTempHpEdit: vi.fn(),
    onTempHpSubmit: vi.fn(),
    currentIsDM: true,
    onToggleDMMode: vi.fn(),
    onTokenImageChange: vi.fn(),
    onApplyPlayerState: vi.fn(),
    _onStatusEffectsChange: vi.fn(),
    onCharacterStatusEffectsChange: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onCharacterSpeedChange: vi.fn(),
    onCharacterBudgetReset: vi.fn(),
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
    onFocusToken: vi.fn(),
    combatActive: true,
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    ...overrides,
  };
}

function openSettingsOf(name: string) {
  const card = screen.getByText(name).closest(".player-card-shell")!;
  fireEvent.click(card.querySelector('button[aria-label="Change portrait"]')!);
}
const openAliceSettings = () => openSettingsOf("Alice");

// The DM's OWN character: out of the active order it renders through the DM
// section (the bench); in it, through the ordered grid below — each site with
// its own gate.
const sidekick = {
  ...alice,
  id: "char-sidekick",
  name: "Sidekick",
  ownedByPlayerUID: DM,
} as unknown as SnapshotCharacter;

describe("EntitiesPanel — the movement-budget reset on a player's card", () => {
  it("the DM reads the spend and the reset names the character", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openAliceSettings();
    expect(screen.getByText("Used 10 ft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset movement budget" }));
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-alice");
  });

  it("a player viewing the same card never sees it, handler or not", () => {
    render(<EntitiesPanel {...panelProps({ currentIsDM: false, uid: ALICE })} />);
    openAliceSettings();
    // The menu did open (its name field is there) — the absence is the gate's,
    // not a closed menu's.
    expect(screen.getByText("Character Name")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("only where the plate shows a budget: not out of combat, not without an initiative", () => {
    const { unmount } = render(<EntitiesPanel {...panelProps({ combatActive: false })} />);
    openAliceSettings();
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    unmount();
    render(
      <EntitiesPanel
        {...panelProps({ characters: [{ ...alice, initiative: undefined, movementUsed: 0 }] })}
      />,
    );
    openAliceSettings();
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("… but a SPEND with no initiative still gets it: the server charges any token moved in combat", () => {
    const props = panelProps({
      characters: [{ ...alice, initiative: undefined, movementUsed: 20 }],
    });
    render(<EntitiesPanel {...props} />);
    openAliceSettings();
    expect(screen.getByText("Used 20 ft")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Reset movement budget" });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-alice");
  });
});

describe("EntitiesPanel — the DM's own character: the bench and the order (F3)", () => {
  it("rolled, it is a combatant: it renders in the ORDER, not the DM group, with the control (inert at 0)", () => {
    render(
      <EntitiesPanel
        {...panelProps({
          // With a token: the menu's token controls are the observable
          // difference between a DM's card and a player's.
          tokens: [{ id: "tok-s", owner: DM, x: 0, y: 0, color: "red" }] as unknown as Token[],
          characters: [{ ...sidekick, tokenId: "tok-s", initiative: 20, movementUsed: 0 }],
        })}
      />,
    );
    expect(screen.getByText("Sidekick").closest(".entities-panel-dm-group")).toBeNull();
    expect(screen.getByText("Sidekick").closest(".entities-panel-card-grid")).not.toBeNull();
    openSettingsOf("Sidekick");
    // The DM's own card's affordances travel with it into the order: the
    // DM-mode section (gated on ownership, isMe) and the token controls the
    // menu once hid for any DM's card — it no longer does (own commit), so
    // this card, like the bench card, can size its own token.
    expect(screen.getByText("Dungeon Master Mode")).toBeInTheDocument();
    expect(screen.getByText(/Token Size/i)).toBeInTheDocument();
    // And "+ Add Character" — the DM\'s card offers it now (own commit), on the
    // bench and in the order alike.
    expect(screen.getByText(/Add Character/i)).toBeInTheDocument();
    expect(screen.getByText("Used 0 ft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset movement budget" })).toBeDisabled();
  });

  it("a PLAYER sees the rolled DM character in the order too — wearing the DM face, carrying no DM-only control", () => {
    render(
      <EntitiesPanel
        {...panelProps({
          currentIsDM: false,
          uid: ALICE,
          characters: [alice, { ...sidekick, initiative: 20, movementUsed: 10 }],
        })}
      />,
    );
    const card = screen.getByText("Sidekick").closest(".player-card-shell")!;
    expect(card.closest(".entities-panel-dm-group")).toBeNull();
    expect(card.closest(".entities-panel-card-grid")).not.toBeNull();
    expect(card.querySelector(".player-card--dm")).not.toBeNull();
    // Not the player's to edit: no settings entry at all (the portrait is a
    // plain "Player portrait"), so no speed field and no reset can exist.
    expect(card.querySelector('button[aria-label="Change portrait"]')).toBeNull();
    expect(card.querySelector('button[aria-label="Player portrait"]')).not.toBeNull();
  });

  it("after END COMBAT (initiative kept) the DM's character is home on the bench", () => {
    render(
      <EntitiesPanel
        {...panelProps({
          combatActive: false,
          characters: [alice, { ...sidekick, initiative: 20, movementUsed: 0 }],
        })}
      />,
    );
    expect(screen.getByText("Sidekick").closest(".entities-panel-dm-group")).not.toBeNull();
  });

  it("unrolled and nothing spent: the bench (the DM group), and no control", () => {
    render(
      <EntitiesPanel
        {...panelProps({ characters: [{ ...sidekick, initiative: undefined, movementUsed: 0 }] })}
      />,
    );
    expect(screen.getByText("Sidekick").closest(".entities-panel-dm-group")).not.toBeNull();
    openSettingsOf("Sidekick");
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("out of combat the bench card carries none even with a spend (a file's stray spend is the handler's road, not a card's)", () => {
    render(
      <EntitiesPanel
        {...panelProps({
          combatActive: false,
          characters: [{ ...sidekick, initiative: undefined, movementUsed: 15 }],
        })}
      />,
    );
    openSettingsOf("Sidekick");
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("unrolled with a spend: the bench card gets the lever — the only thing that clears it short of ending combat", () => {
    const props = panelProps({
      characters: [{ ...sidekick, initiative: undefined, movementUsed: 15 }],
    });
    render(<EntitiesPanel {...props} />);
    expect(screen.getByText("Sidekick").closest(".entities-panel-dm-group")).not.toBeNull();
    openSettingsOf("Sidekick");
    expect(screen.getByText("Used 15 ft")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Reset movement budget" });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-sidekick");
  });
});
